---
name: 端到端测试能力设计
description: 为 Claude Code 提供完整的端到端测试能力（编写、运行、调试、验证）
type: project
---

# 端到端测试能力设计规格

## 目标

赋予 Claude Code 端到端测试全流程能力：
1. **编写测试** - 创建新的 E2E 测试代码
2. **运行测试** - 执行测试并分析结果
3. **调试测试** - 修复失败测试，分析失败原因
4. **验证功能** - 通过测试验证功能是否正常工作

## 技术选型

| 选择 | 理由 |
|------|------|
| Playwright | 微软开发，支持多浏览器，内置等待机制，调试工具完善，与 Next.js 集成良好 |
| 测试数据库 + 独立服务器 | 每次测试启动独立服务实例，使用内存 SQLite，测试隔离性好 |
| 混合认证策略 | 认证测试独立登录，其他测试复用认证状态，平衡真实性和速度 |
| 本地 + 可视化调试 | 支持命令行运行和 Playwright UI 模式 |

## 目录结构

```
packages/e2e/
├── playwright.config.ts          # Playwright 配置
├── global-setup.ts               # 全局初始化（启动测试服务器）
├── global-teardown.ts            # 全局清理（关闭测试服务器）
├── auth.setup.ts                 # 认证状态复用 setup
├── package.json                  # E2E 包配置
├── fixtures/
│   └── base.ts                   # 自定义 fixtures
├── tests/
│   ├── auth.spec.ts              # 认证流程测试
│   ├── projects.spec.ts          # 项目管理测试
│   ├── collaboration.spec.ts     # 协作功能测试
│   └── organizations.spec.ts     # 组织/仓库管理测试
└── helpers/
    ├── test-server.ts            # 测试服务器管理
    ├── test-db.ts                # 测试数据库管理
    └── api-helpers.ts            # API 辅助函数
```

## 核心组件设计

### 1. 测试服务器 (helpers/test-server.ts)

**职责**：
- 启动独立 Express 服务实例
- 动态分配端口避免冲突
- 返回服务器地址供测试使用

**实现要点**：
```typescript
// 伪代码示意
export async function startTestServer() {
  const port = await getAvailablePort();
  const db = getSqliteDb(':memory:');
  initSchema(db);
  const app = createApp(db);
  const server = app.listen(port);
  return { server, port, baseUrl: `http://localhost:${port}` };
}

export async function stopTestServer(server: Server) {
  await new Promise(resolve => server.close(resolve));
}
```

### 2. 测试数据库 (helpers/test-db.ts)

**职责**：
- 创建内存 SQLite 数据库
- 初始化 schema
- 提供种子数据（测试用户、测试组织等）

**实现要点**：
```typescript
export function createTestDb() {
  const db = getSqliteDb(':memory:');
  initSchema(db);
  return db;
}

export function seedTestUser(db: Database, overrides?: Partial<User>) {
  // 创建测试用户，默认密码 'testpassword'
  // 返回用户对象供测试使用
}

export function seedTestOrganization(db: Database, userId: string) {
  // 创建测试组织，关联用户
}
```

### 3. 认证状态复用 (auth.setup.ts)

**职责**：
- 在测试套件运行前预先登录
- 保存浏览器状态到 `playwright/.auth/user.json`
- 供非认证测试复用

**实现要点**：
```typescript
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  // 启动测试服务器
  // 使用种子用户登录
  // 保存状态
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
```

### 4. Playwright 配置 (playwright.config.ts)

**关键配置**：
- 全局 setup/teardown 启动/关闭测试服务器
- 定义 projects：认证 setup + 各测试项目
- 配置浏览器：Chromium（主要）、Firefox/WebKit（可选）
- 配置 reporter：HTML report 用于调试

```typescript
export default defineConfig({
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  projects: [
    { name: 'setup', testMatch: 'auth.setup.ts' },
    {
      name: 'chromium',
      use: { storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
      testMatch: 'tests/*.spec.ts',
    },
  ],
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
});
```

### 5. 自定义 fixtures (fixtures/base.ts)

**职责**：
- 扩展 Playwright test 对象
- 提供测试服务器地址
- 提供数据库操作方法
- 提供认证辅助函数

```typescript
import { test as base } from '@playwright/test';

type MyFixtures = {
  baseUrl: string;
  testDb: Database;
  authenticatedPage: Page;
};

export const test = base.extend<MyFixtures>({
  baseUrl: async ({}, use) => {
    // 从全局配置获取
  },
  testDb: async ({}, use) => {
    // 提供数据库实例
  },
  authenticatedPage: async ({ page }, use) => {
    // 已认证的 page
  },
});
```

## 测试场景覆盖

### 认证流程 (tests/auth.spec.ts) - 独立登录

| 测试用例 | 描述 |
|----------|------|
| 注册成功 | 填写表单，检查跳转到 dashboard |
| 注册失败 - 用户已存在 | 使用已存在用户名注册，检查错误提示 |
| 登录成功 | 使用正确凭证登录，检查跳转 |
| 登录失败 - 错误密码 | 使用错误密码，检查错误提示 |
| GitHub OAuth | 点击 GitHub 登录，模拟回调（需 mock 或跳过） |
| GitLab OAuth | 点击 GitLab 登录，模拟回调（需 mock 或跳过） |
| 登出 | 登录后登出，检查跳转到登录页 |
| 未认证访问保护 | 未登录访问 protected 页面，检查重定向 |

### 项目管理 (tests/projects.spec.ts) - 复用认证

| 测试用例 | 描述 |
|----------|------|
| 查看项目列表 | 登录后查看 dashboard，检查项目列表显示 |
| 创建新项目 | 点击创建，填写表单，检查项目创建成功 |
| 编辑项目名称 | 点击编辑，修改名称，检查保存成功 |
| 删除项目 | 点击删除，确认，检查项目消失 |
| 项目卡片点击跳转 | 点击项目卡片，检查跳转到项目详情 |
| 项目搜索/过滤 | 输入搜索词，检查结果过滤 |

### 协作功能 (tests/collaboration.spec.ts) - 复用认证

| 测试用例 | 描述 |
|----------|------|
| 消息面板显示 | 打开项目，检查消息面板渲染 |
| 发送消息 | 输入消息，发送，检查消息显示 |
| 草稿列表显示 | 检查草稿列表组件 |
| WebSocket 连接 | 检查 WebSocket 连接状态（需后端配合） |
| 实时消息接收 | 模拟发送消息，检查实时更新 |

### 组织/仓库管理 (tests/organizations.spec.ts) - 复用认证

| 测试用例 | 描述 |
|----------|------|
| 查看组织列表 | 检查组织列表页面显示 |
| 创建新组织 | 创建组织，检查创建成功 |
| 邀请成员 | 发送邀请，检查邀请列表 |
| 查看仓库列表 | 检查仓库列表组件 |
| 关联仓库到组织 | 添加仓库，检查关联成功 |
| 组织设置 | 检查组织设置页面 |

## 运行命令

在根目录 `package.json` 添加：

```json
{
  "scripts": {
    "test:e2e": "pnpm --filter @code-link/e2e test",
    "test:e2e:ui": "pnpm --filter @code-link/e2e test:ui",
    "test:e2e:debug": "pnpm --filter @code-link/e2e test:debug",
    "test:e2e:headed": "pnpm --filter @code-link/e2e test:headed"
  }
}
```

E2E 包 `packages/e2e/package.json`：

```json
{
  "name": "@code-link/e2e",
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:debug": "playwright test --debug",
    "test:headed": "playwright test --headed",
    "test:report": "playwright show-report"
  }
}
```

## OAuth 测试策略

OAuth 测试需要特殊处理：

**方案 A：跳过真实 OAuth 流程**
- 标记 OAuth 测试为 `@skip` 或使用 mock
- 仅测试回调后的处理逻辑

**方案 B：Mock OAuth Provider**
- 在测试服务器添加 mock OAuth endpoint
- 模拟 GitHub/GitLab 返回用户信息

**推荐方案 A**，因为 OAuth 流程涉及外部服务，难以在 E2E 测试中完整模拟。测试重点放在回调处理和状态管理。

## CI/CD 支持（可选扩展）

未来可添加 GitHub Actions 配置：

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Claude Code 工作流

当 Claude Code 执行端到端测试时：

1. **编写测试**
   - 阅读 `helpers/*.ts` 了解可用工具
   - 参考 `tests/*.spec.ts` 了解测试模式
   - 使用自定义 fixtures 编写测试

2. **运行测试**
   - 执行 `pnpm test:e2e` 运行全部测试
   - 执行 `pnpm test:e2e -- --grep "特定测试名"` 运行特定测试
   - 分析输出中的失败信息

3. **调试测试**
   - 使用 `pnpm test:e2e:ui` 打开 UI 模式
   - 使用 `pnpm test:e2e:debug` 逐步执行
   - 查看 HTML report 定位问题

4. **验证功能**
   - 确保所有测试通过后再确认功能完成
   - 使用测试作为功能验收标准

## 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 端口冲突 | 动态端口分配，失败后重试 |
| 数据库初始化失败 | 报错并终止测试 |
| WebSocket 连接失败 | 设置合理等待时间，超时后报错 |
| 浏览器启动失败 | 检查 Playwright 安装，重试安装浏览器 |

## 测试隔离

- 每个测试套件独立的数据库实例
- 测试之间不共享数据
- 使用 `test.beforeEach` 重置必要状态
- 测试结束后清理浏览器状态

## 实现优先级

1. **Phase 1**: 基础设施搭建
   - 创建 `packages/e2e` 目录结构
   - 配置 Playwright
   - 实现 `test-server.ts` 和 `test-db.ts`
   - 实现 `auth.setup.ts`

2. **Phase 2**: 认证测试
   - 实现注册/登录测试
   - 实现登出测试
   - 实现未认证访问保护测试

3. **Phase 3**: 项目管理测试
   - 实现项目列表/创建/编辑/删除测试

4. **Phase 4**: 协作功能测试
   - 实现消息面板测试
   - 实现 WebSocket 测试

5. **Phase 5**: 组织/仓库测试
   - 实现组织管理测试
   - 实现仓库关联测试

---

**Why**: 用户希望 Claude Code 具备完整的端到端测试能力，从编写到验证全流程覆盖，提高功能交付质量和可靠性。

**How to apply**: 实现此设计后，Claude Code 可以自主执行 E2E 测试任务，包括编写测试代码、运行测试分析结果、调试失败测试、验证功能完成。