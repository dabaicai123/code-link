# 架构迁移与旧代码清理设计文档

## 概述

完成 2026-04-19-backend-refactor-phase* 重构后，评估并删除旧代码，将应用完全迁移到新的模块化架构。

**Why:** 新模块架构已创建，需要完成集成并清理冗余代码。
**How to apply:** 按此设计文档执行迁移，逐步删除旧代码。

---

## 当前状态

### 新模块架构（modules/）

| 模块 | 文件 | 状态 |
|------|------|------|
| auth | controller, service, repository, routes, schemas | ✅ 完成 |
| organization | controller, service, repository, routes, schemas | ✅ 完成 |
| project | controller, service, repository, routes, schemas | ✅ 完成 |
| draft | controller, service, repository, routes, schemas | ✅ 完成 |
| build | controller, service, repository, routes, schemas | ✅ 完成 |
| gitprovider | controller, service, repository, routes, schemas | ✅ 完成 |
| claude-config | controller, service, repository, routes, schemas | ✅ 完成 |

### 需要新增的模块

| 模块 | 说明 |
|------|------|
| container | Docker 容器管理（启动、停止、删除） |

### 需要扩展的模块

| 模块 | 新增功能 |
|------|----------|
| project | 仓库管理 API（合并 repos.ts） |

---

## 旧代码目录分析

### routes/ 目录（将被删除）

| 文件 | 替代方案 | 状态 |
|------|----------|------|
| auth.ts | 不存在（已删除） | 需确认 |
| projects.ts | modules/project/routes.ts | 待迁移 |
| organizations.ts | modules/organization/routes.ts | 待迁移 |
| drafts.ts | modules/draft/routes.ts | 待迁移 |
| builds.ts | modules/build/routes.ts | 待迁移 |
| claude-config.ts | modules/claude-config/routes.ts | 待迁移 |
| github.ts | modules/gitprovider/routes.ts | 待迁移 |
| gitlab.ts | modules/gitprovider/routes.ts | 待迁移 |
| oauth-factory.ts | modules/gitprovider/oauth.ts | 待迁移 |
| containers.ts | 新建 modules/container | 待创建 |
| repos.ts | 合并到 modules/project | 待迁移 |
| invitations.ts | modules/organization/routes.ts | 待迁移 |

### services/ 目录（将被删除）

| 文件 | 替代方案 |
|------|----------|
| project.service.ts | modules/project/service.ts |
| organization.service.ts | modules/organization/service.ts |
| draft.service.ts | modules/draft/service.ts |
| permission.service.ts | shared/permission.service.ts（保留） |

### repositories/ 目录（将被删除）

| 文件 | 替代方案 |
|------|----------|
| user.repository.ts | modules/auth/repository.ts |
| organization.repository.ts | modules/organization/repository.ts |
| project.repository.ts | modules/project/repository.ts |
| draft.repository.ts | modules/draft/repository.ts |
| build.repository.ts | modules/build/repository.ts |
| claude-config.repository.ts | modules/claude-config/repository.ts |
| token.repository.ts | modules/gitprovider/repository.ts |

---

## 迁移计划

### Phase 1: 创建缺失模块

#### Task 1: 创建 container 模块

**文件结构：**
```
modules/container/
├── container.module.ts
├── controller.ts
├── service.ts
├── routes.ts
├── schemas.ts
└── types.ts
```

**功能：**
- POST `/api/projects/:id/container/start` - 启动容器
- POST `/api/projects/:id/container/stop` - 停止容器
- GET `/api/projects/:id/container` - 获取容器状态
- DELETE `/api/projects/:id/container` - 删除容器

#### Task 2: 扩展 project 模块（添加仓库 API）

**新增路由：**
- GET `/api/projects/:projectId/repos` - 获取仓库列表
- POST `/api/projects/:projectId/repos` - 添加仓库
- DELETE `/api/projects/:projectId/repos/:repoId` - 删除仓库

### Phase 2: 创建新的入口文件

#### Task 3: 创建 app-new.ts

**内容：**
1. 注册所有 TSyringe 模块
2. 导入所有新模块路由
3. 配置 Express 中间件
4. 配置错误处理

**关键代码结构：**
```typescript
import "reflect-metadata";
import { registerAuthModule, createAuthRoutes, AuthController } from './modules/auth/auth.module.js';
import { registerOrganizationModule, createOrganizationRoutes, OrganizationController } from './modules/organization/organization.module.js';
// ... 其他模块

// 注册所有模块
registerAuthModule();
registerOrganizationModule();
// ... 其他模块

// 创建路由
const authController = container.resolve(AuthController);
app.use('/api/auth', createAuthRoutes(authController));
// ... 其他路由
```

### Phase 3: 验证与切换

#### Task 4: 验证新架构

1. 启动服务器
2. 测试所有 API 端点
3. 确认 WebSocket 功能正常

#### Task 5: 替换 app.ts

1. 备份旧 app.ts
2. 将 app-new.ts 内容复制到 app.ts
3. 提交更改

### Phase 4: 清理旧代码

#### Task 6: 删除旧路由

删除 `routes/` 目录：
- routes/github.ts
- routes/gitlab.ts
- routes/oauth-factory.ts
- routes/organizations.ts
- routes/projects.ts
- routes/invitations.ts
- routes/repos.ts
- routes/builds.ts
- routes/claude-config.ts
- routes/containers.ts
- routes/drafts.ts

#### Task 7: 删除旧服务

删除 `services/` 目录（保留 shared/permission.service.ts）：
- services/project.service.ts
- services/organization.service.ts
- services/draft.service.ts
- services/index.ts

#### Task 8: 删除旧仓库

删除 `repositories/` 目录：
- repositories/user.repository.ts
- repositories/organization.repository.ts
- repositories/project.repository.ts
- repositories/draft.repository.ts
- repositories/build.repository.ts
- repositories/claude-config.repository.ts
- repositories/token.repository.ts
- repositories/index.ts

#### Task 9: 清理其他废弃代码

- `utils/errors.ts` - 使用 `core/errors` 替代
- 任何引用旧模块的导入

---

## 可直接删除的无用代码

以下代码确认无引用，可立即删除：

### 1. 数据库 Schema 清理

| 文件 | 内容 | 原因 |
|------|------|------|
| db/schema.ts | raw SQL schema | 使用 Drizzle schema 替代 |
| db/schema/messages.ts | messages 表 | 未使用 |

### 2. 未使用的方法

| 文件 | 方法 | 原因 |
|------|------|------|
| ai/commands.ts | getSupportedCommands | 未被调用 |

### 3. 未使用的类型定义

| 文件 | 内容 | 原因 |
|------|------|------|
| db/schema/projects.ts | projectMembers 表 | 未使用 |
| middleware/auth.ts | projectRole 字段 | 未使用 |

---

## 测试策略

### 单元测试

每个新模块需要：
- Repository 单元测试
- Service 单元测试
- Controller 单元测试

### 集成测试

- API 端点测试
- WebSocket 功能测试
- 权限验证测试

### 手动测试清单

- [ ] 用户注册/登录
- [ ] 创建/查看/删除项目
- [ ] 创建/查看/删除组织
- [ ] 添加/移除组织成员
- [ ] 启动/停止/删除容器
- [ ] 添加/删除仓库
- [ ] WebSocket 连接和消息

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 新模块功能不完整 | 逐模块对比测试 |
| 依赖注入配置错误 | 检查所有 @inject 和 registerSingleton |
| 路由路径不匹配 | 保持 API 路径不变 |
| 权限检查遗漏 | 复用 PermissionService |

---

## 执行顺序

1. **Phase 1:** 创建 container 模块，扩展 project 模块
2. **Phase 2:** 创建 app-new.ts，集成所有新模块
3. **Phase 3:** 验证功能，切换入口文件
4. **Phase 4:** 删除旧代码

---

## 成功标准

- [ ] 所有 API 端点正常工作
- [ ] 所有测试通过
- [ ] 无旧模块残留引用
- [ ] 代码结构符合新架构设计
