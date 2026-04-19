# 后端架构重构：引入轻量 DI 容器

## 背景

当前后端架构存在以下问题：

1. **依赖管理混乱**：每个 Service/Repository 方法内部创建依赖实例
2. **实例重复创建**：`new UserRepository()` 在多处重复调用
3. **测试困难**：无法注入 mock 依赖，单元测试必须依赖真实数据库
4. **权限逻辑重复**：`ROLE_HIERARCHY` 在 auth.ts 和 PermissionService 中重复定义
5. **数据库连接分散**：connection.ts 和 drizzle.ts 都有单例管理逻辑
6. **错误处理不一致**：部分路由使用 `handleRouteError`，部分使用字符串匹配

## 设计目标

- 统一依赖管理，支持依赖注入
- 简化测试，支持 mock 替换
- 统一错误处理和权限逻辑
- 保持轻量，避免引入复杂框架

## 架构设计

### 1. DI 容器核心

创建 `Container` 类管理所有依赖实例：

```typescript
// src/container.ts
export class Container {
  private instances: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();

  // 注册工厂函数
  register<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory);
  }

  // 获取单例实例
  get<T>(name: string): T {
    if (!this.instances.has(name)) {
      const factory = this.factories.get(name);
      if (!factory) throw new Error(`未注册依赖: ${name}`);
      this.instances.set(name, factory());
    }
    return this.instances.get(name);
  }

  // 创建临时实例（用于测试覆盖）
  create<T>(name: string): T {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`未注册依赖: ${name}`);
    return factory();
  }

  // 重置实例（用于测试）
  reset(): void {
    this.instances.clear();
  }

  // 覆盖实例（用于测试 mock）
  override<T>(name: string, instance: T): void {
    this.instances.set(name, instance);
  }
}
```

### 2. 默认容器配置

```typescript
// src/container.config.ts
export function configureContainer(container: Container): void {
  // 数据库连接（最底层）
  container.register('db', () => getDb());
  container.register('sqliteDb', () => getSqliteDb());

  // Repository 层
  container.register('UserRepository', () => new UserRepository(
    container.get('db')
  ));
  container.register('OrganizationRepository', () => new OrganizationRepository(
    container.get('db'),
    container.get('sqliteDb')
  ));
  container.register('ProjectRepository', () => new ProjectRepository(
    container.get('db')
  ));
  container.register('DraftRepository', () => new DraftRepository(
    container.get('db'),
    container.get('sqliteDb')
  ));
  container.register('TokenRepository', () => new TokenRepository(
    container.get('db')
  ));
  container.register('BuildRepository', () => new BuildRepository(
    container.get('db')
  ));
  container.register('ClaudeConfigRepository', () => new ClaudeConfigRepository(
    container.get('db')
  ));

  // Service 层
  container.register('PermissionService', () => new PermissionService(
    container.get('UserRepository'),
    container.get('OrganizationRepository'),
    container.get('ProjectRepository')
  ));
  container.register('AuthService', () => new AuthService(
    container.get('UserRepository')
  ));
  container.register('OrganizationService', () => new OrganizationService(
    container.get('OrganizationRepository'),
    container.get('UserRepository'),
    container.get('PermissionService')
  ));
  container.register('ProjectService', () => new ProjectService(
    container.get('ProjectRepository'),
    container.get('PermissionService')
  ));
  container.register('DraftService', () => new DraftService(
    container.get('DraftRepository'),
    container.get('ProjectRepository'),
    container.get('PermissionService')
  ));
}
```

### 3. Repository 改造

Repository 通过构造函数接收 db 实例：

```typescript
// repositories/user.repository.ts
export class UserRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findByEmail(email: string): Promise<SelectUser | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }
  // ... 其他方法不再调用 getDb()
}
```

### 4. Service 改造

Service 通过构造函数接收 Repository：

```typescript
// services/auth.service.ts
export class AuthService {
  constructor(private userRepo: UserRepository) {}

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(data.email);
    // ...
  }
}
```

### 5. 路由层改造

路由通过容器获取 Service：

```typescript
// routes/auth.ts
export function createAuthRouter(container: Container): Router {
  const router = Router();
  const authService = container.get<AuthService>('AuthService');

  router.post('/register', async (req, res) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(success(result));
    } catch (error: unknown) {
      handleRouteError(res, error, logger, '注册失败');
    }
  });
  // ...
}
```

### 6. 统一错误处理

所有路由统一使用 `handleRouteError`，移除字符串匹配方式。

Service 层抛出 `BusinessError` 子类，路由层自动映射 HTTP 状态码。

### 7. 统一权限层级

移除 auth.ts 中的 `ROLE_HIERARCHY`，统一使用 PermissionService 或提取为公共常量：

```typescript
// utils/roles.ts
export const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 3,
  developer: 2,
  member: 1,
};
```

### 8. 数据库连接统一

合并 connection.ts 和 drizzle.ts，统一单例管理：

```typescript
// db/index.ts（重写）
export { getDb, getSqliteDb, closeDb } from './drizzle.js';
// 移除 connection.ts，将其功能合并到 drizzle.ts
```

### 9. 应用启动

```typescript
// index.ts
export function createApp(container?: Container): express.Express {
  const app = express();

  // 使用默认容器或传入的自定义容器（测试用）
  const c = container || createDefaultContainer();

  app.use('/api/auth', createAuthRouter(c));
  app.use('/api/organizations', createOrganizationsRouter(c));
  // ...
}
```

## 文件改动清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/container.ts` | 新增 | DI 容器核心 |
| `src/container.config.ts` | 新增 | 默认容器配置 |
| `src/utils/roles.ts` | 新增 | 统一角色层级常量 |
| `src/db/drizzle.ts` | 修改 | 合并 connection.ts 功能 |
| `src/db/connection.ts` | 删除 | 功能合并到 drizzle.ts |
| `repositories/*.ts` | 修改 | 构造函数接收 db |
| `services/*.ts` | 修改 | 构造函数接收 Repository |
| `routes/*.ts` | 修改 | 从容器获取 Service |
| `middleware/auth.ts` | 修改 | 使用容器、统一角色层级 |
| `src/index.ts` | 修改 | 创建容器并传递给路由 |

## 测试改进

测试时可以注入 mock 依赖：

```typescript
// tests/auth.service.test.ts
const mockUserRepo = {
  findByEmail: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
};

const container = new Container();
container.override('UserRepository', mockUserRepo);

const authService = container.get<AuthService>('AuthService');
// 现可以测试 AuthService 而无需真实数据库
```

## 实施顺序

1. 创建 Container 核心类
2. 创建统一角色层级常量
3. 合并数据库连接管理
4. 改造 Repository 层
5. 改造 Service 层
6. 改造路由层
7. 创建默认容器配置
8. 更新应用启动入口
9. 更新测试代码

## 风险与对策

| 风险 | 对策 |
|------|------|
| 改动范围大 | 分阶段实施，每阶段确保测试通过 |
| 破坏现有功能 | 保持 API 接口不变，只改内部实现 |
| 测试覆盖不足 | 先写测试再重构，确保行为不变 |