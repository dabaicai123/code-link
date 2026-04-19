# E2E 测试性能优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 E2E 测试运行时间从 >3分钟 优化到 30秒-1分钟

**Architecture:** 移除 global-setup 中的前端启动逻辑，改为预启动检查；测试时使用 build 版本（`pnpm build && pnpm start`）而非 dev 模式以减少性能开销；优化 playwright workers 配置；收紧超时设置实现快速失败

**Tech Stack:** Playwright, TypeScript, pnpm monorepo

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/e2e/global-setup.ts` | 重写 | 检查前端服务可用性，不再启动 |
| `packages/e2e/global-teardown.ts` | 简化 | 移除进程清理逻辑 |
| `packages/e2e/playwright.config.ts` | 修改 | 动态 workers + 收紧超时 |

---

## Task 1: 重写 global-setup.ts

**Files:**
- Modify: `packages/e2e/global-setup.ts`

- [ ] **Step 1: 重写 global-setup.ts 为服务可用性检查**

将文件内容替换为：

```typescript
// packages/e2e/global-setup.ts

export default async function globalSetup() {
  const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';

  console.log('检查前端服务可用性:', webBaseUrl);

  // 检查前端服务是否运行
  try {
    const response = await fetch(webBaseUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`前端服务返回错误状态: ${response.status}`);
    }
    console.log('前端服务已就绪:', webBaseUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`
前端服务未运行: ${errorMessage}

请先启动前端开发服务器:
  pnpm --filter @code-link/web dev

或者设置 WEB_BASE_URL 环境变量指向已运行的服务:
  WEB_BASE_URL=http://your-server:port pnpm --filter @code-link/e2e test
    `.trim());
  }
}
```

- [ ] **Step 2: 验证语法正确**

Run: `pnpm --filter @code-link/e2e exec tsc --noEmit global-setup.ts`
Expected: 无错误输出

---

## Task 2: 简化 global-teardown.ts

**Files:**
- Modify: `packages/e2e/global-teardown.ts`

- [ ] **Step 1: 简化 global-teardown.ts 移除进程清理逻辑**

将文件内容替换为：

```typescript
// packages/e2e/global-teardown.ts

export default async function globalTeardown() {
  // 前端服务由外部管理，无需在此清理
  console.log('E2E 测试清理完成');
}
```

- [ ] **Step 2: 验证语法正确**

Run: `pnpm --filter @code-link/e2e exec tsc --noEmit global-teardown.ts`
Expected: 无错误输出

---

## Task 3: 优化 playwright.config.ts

**Files:**
- Modify: `packages/e2e/playwright.config.ts`

- [ ] **Step 1: 修改 workers 配置为动态值**

找到 `workers: 6` 这一行，替换为：

```typescript
  // CI 环境使用较少 workers 保证稳定性，本地使用更多 workers 加速
  workers: process.env.CI ? 2 : 4,
```

- [ ] **Step 2: 收紧 actionTimeout 和 navigationTimeout**

找到 `use` 配置块中的超时设置，修改为：

```typescript
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
    // 收紧超时时间，快速失败
    actionTimeout: 3000,
    navigationTimeout: 8000,
  },
```

- [ ] **Step 3: 收紧 expect timeout**

找到 `expect` 配置块，修改为：

```typescript
  // 收紧 expect 超时，快速失败
  expect: {
    timeout: 3000,
  },
```

- [ ] **Step 4: 验证配置文件语法正确**

Run: `pnpm --filter @code-link/e2e exec tsc --noEmit playwright.config.ts`
Expected: 无错误输出

---

## Task 4: 提交变更

**Files:**
- Modify: `packages/e2e/global-setup.ts`
- Modify: `packages/e2e/global-teardown.ts`
- Modify: `packages/e2e/playwright.config.ts`

- [ ] **Step 1: 查看变更**

Run: `git -C /root/my/code-link diff packages/e2e/`

- [ ] **Step 2: 提交变更**

Run: `git -C /root/my/code-link add packages/e2e/global-setup.ts packages/e2e/global-teardown.ts packages/e2e/playwright.config.ts && git -C /root/my/code-link commit -m "$(cat <<'EOF'
perf(e2e): 优化测试性能配置

- global-setup.ts: 移除前端启动逻辑，改为服务可用性检查
- global-teardown.ts: 移除进程清理逻辑
- playwright.config.ts: 动态 workers 配置 + 收紧超时

预期效果: 测试时间从 >3分钟 优化到 <1分钟

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"`

---

## Task 5: 验证测试可运行

**Files:**
- Test: `packages/e2e/`

**前置条件:** 前端和后端需要先 build，然后启动前端生产服务器

- [ ] **Step 1: Build 前端和后端**

Run: `pnpm --filter @code-link/server build && pnpm --filter @code-link/web build`
Expected: 构建成功，无错误

- [ ] **Step 2: 启动前端生产服务器**

Run: `pnpm --filter @code-link/web start`
Expected: 服务启动在 http://localhost:3000

- [ ] **Step 3: 等待前端服务就绪**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: 返回 200

- [ ] **Step 4: 运行 E2E 测试验证**

Run: `pnpm --filter @code-link/e2e test --reporter=list`
Expected: 测试正常运行，总时间 < 60秒

- [ ] **Step 5: 记录实际运行时间**

观察测试输出中的总耗时，记录是否达到目标 (< 60秒)

---

## 验收标准

1. ✅ global-setup.ts 不再启动前端，只检查服务可用性
2. ✅ global-teardown.ts 简化为空操作
3. ✅ playwright.config.ts workers 动态配置 (CI=2, 本地=4)
4. ✅ 超时设置收紧 (actionTimeout=3000, expect=3000)
5. ✅ 测试可正常运行
6. ✅ 测试总时间 < 60秒
