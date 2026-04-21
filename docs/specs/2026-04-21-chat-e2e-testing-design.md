# Chat UI E2E 测试设计文档

## 概述

为左屏聊天 UI（ChatWorkspace）设计完整的 e2e 测试框架，覆盖核心聊天功能、斜杠命令、附件上传、代理选择、权限模式和左右屏联动。测试使用真实 WebSocket 连接，依赖后端服务运行。

## 测试范围

| 功能模块 | 测试覆盖 |
|---------|---------|
| 消息发送与接收 | 用户消息、助手消息、Markdown 渲染 |
| 流式输出 | 文本增量更新、滚动跟随 |
| 工具调用展示 | 折叠块、状态指示、输出显示 |
| 斜杠命令 | `/` 菜单打开、命令选择、动态 skills 加载 |
| 图片附件 | 文件选择、粘贴上传、预览删除 |
| 代理选择 | Claude/Codex 切换 |
| 权限模式 | Default/Plan/YOLO 模式 |
| 左右屏联动 | 元素选择注入、项目切换重置 |

## TestApp 方法扩展

新增到 `packages/e2e/tests/support/test-app.ts`：

### Chat Operations

```typescript
/**
 * 发送聊天消息
 * @param text - 消息文本内容
 */
async sendChatMessage(text: string): Promise<void> {
  const input = this.page.getByPlaceholder(/输入消息|输入需求|描述修改/);
  await input.fill(text);
  await this.page.getByRole('button', { name: /发送|Send/ }).click();
}

/**
 * 验证聊天消息可见
 * @param content - 消息内容或部分内容
 * @param role - 'user' 或 'assistant'
 */
async assertChatMessageVisible(content: string, role?: 'user' | 'assistant'): Promise<void> {
  const locator = role
    ? this.page.locator(`[data-role="${role}"]`).filter({ hasText: content })
    : this.page.getByText(content);
  await expect(locator).toBeVisible({ timeout: 10000 });
}

/**
 * 等待流式输出完成
 * 通过检测停止按钮变为发送按钮来判断
 */
async waitForStreamingComplete(): Promise<void> {
  // 流式输出时显示"停止"按钮，完成后变为"发送"
  await expect(this.page.getByRole('button', { name: /发送|Send/ })).toBeEnabled({ timeout: 30000 });
}
```

### Slash Commands

```typescript
/**
 * 打开斜杠命令菜单
 */
async openSlashCommandMenu(): Promise<void> {
  const input = this.page.getByPlaceholder(/输入消息|\/ 打开命令菜单/);
  await input.fill('/');
  await expect(this.page.locator('.cmd-menu')).toBeVisible({ timeout: 5000 });
}

/**
 * 选择斜杠命令
 * @param command - 命令名称（不含 /）
 */
async selectSlashCommand(command: string): Promise<void> {
  await this.openSlashCommandMenu();
  await this.page.getByRole('button', { name: new RegExp(command) }).click();
}

/**
 * 验证斜杠命令菜单可见
 */
async assertSlashCommandMenuVisible(): Promise<void> {
  await expect(this.page.locator('.cmd-menu')).toBeVisible();
}

/**
 * 通过键盘导航选择命令
 * @param index - 命令索引（从 0 开始）
 */
async navigateSlashCommandMenu(index: number): Promise<void> {
  for (let i = 0; i < index; i++) {
    await this.page.keyboard.press('ArrowDown');
  }
  await this.page.keyboard.press('Enter');
}
```

### Attachments

```typescript
/**
 * 上传图片附件
 * @param filePath - 图片文件路径（相对于 fixtures 目录）
 */
async uploadImageAttachment(filePath: string): Promise<void> {
  const attachBtn = this.page.getByRole('button', { name: /上传图片|attach|Image/ });
  await attachBtn.click();

  // 等待文件选择器并上传
  const fileChooserPromise = this.page.waitForEvent('filechooser');
  await attachBtn.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
}

/**
 * 通过粘贴上传图片
 * @param imagePath - 图片文件路径
 */
async pasteImageAttachment(imagePath: string): Promise<void> {
  // 读取图片并构造 clipboard data
  const imageBuffer = await fs.readFile(imagePath);
  await this.page.evaluate(async (data) => {
    const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
    const clipboardItem = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([clipboardItem]);
  }, imageBuffer.toString('base64'));

  // 触发粘贴
  const input = this.page.getByPlaceholder(/输入消息/);
  await input.focus();
  await this.page.keyboard.press('Control+v');
}

/**
 * 移除图片附件
 * @param index - 图片索引（从 0 开始）
 */
async removeImageAttachment(index: number): Promise<void> {
  const removeButtons = this.page.locator('.attachment-chip button');
  await removeButtons.nth(index).click();
}

/**
 * 验证图片预览数量
 * @param count - 预期预览数量
 */
async assertImagePreviewVisible(count: number): Promise<void> {
  const previews = this.page.locator('.attachment-chip');
  await expect(previews).toHaveCount(count);
}
```

### Agent & Permission Mode

```typescript
/**
 * 选择代理
 * @param agent - 'claude' 或 'codex'
 */
async selectAgent(agent: 'claude' | 'codex'): Promise<void> {
  await this.page.getByRole('button', { name: /代理|Agent/ }).click();
  await this.page.getByRole('option', { name: new RegExp(agent, 'i') }).click();
}

/**
 * 选择权限模式
 * @param mode - 'default' | 'plan' | 'yolo'
 */
async selectPermissionMode(mode: 'default' | 'plan' | 'yolo'): Promise<void> {
  await this.page.getByRole('button', { name: /权限|Permission|模式/ }).click();
  await this.page.getByRole('option', { name: new RegExp(mode, 'i') }).click();
}

/**
 * 验证当前代理
 * @param agent - 代理名称
 */
async assertAgentSelected(agent: string): Promise<void> {
  const agentBtn = this.page.getByRole('button', { name: /代理|Agent/ });
  await expect(agentBtn).toContainText(agent);
}
```

### Tool Calls

```typescript
/**
 * 验证工具调用块可见
 * @param toolName - 工具名称
 */
async assertToolCallBlockVisible(toolName: string): Promise<void> {
  const toolBlock = this.page.locator('[data-tool-name]').filter({ hasText: toolName });
  await expect(toolBlock).toBeVisible({ timeout: 15000 });
}

/**
 * 展开/折叠工具调用块
 * @param toolName - 工具名称
 * @param expand - true 展开，false 折叠
 */
async toggleToolCallBlock(toolName: string, expand: boolean): Promise<void> {
  const toolBlock = this.page.locator('[data-tool-name]').filter({ hasText: toolName });
  const toggleBtn = toolBlock.getByRole('button', { name: /展开|折叠|expand|collapse/i });
  await toggleBtn.click();
}

/**
 * 验证工具调用状态
 * @param toolName - 工具名称
 * @param status - 'running' | 'completed' | 'error'
 */
async assertToolCallStatus(toolName: string, status: string): Promise<void> {
  const statusIndicator = this.page.locator(`[data-tool-name="${toolName}"] [data-status]`);
  await expect(statusIndicator).toHaveAttribute('data-status', status);
}
```

### Session Management

```typescript
/**
 * 重启聊天会话
 */
async restartChatSession(): Promise<void> {
  await this.page.getByRole('button', { name: /重启|Restart|重置/ }).click();
}

/**
 * 验证会话已重置（消息清空）
 */
async assertSessionReset(): Promise<void> {
  // 空状态欢迎页应该可见
  await expect(this.page.getByText(/开始对话|输入需求|Welcome/i)).toBeVisible();
}

/**
 * 验证连接状态
 * @param connected - true 已连接，false 断开
 */
async assertConnectionStatus(connected: boolean): Promise<void> {
  const statusDot = this.page.locator('.status-dot');
  await expect(statusDot).toHaveClass(new RegExp(connected ? 'running' : 'stopped'));
}
```

### Integration (Left-Right Panel)

```typescript
/**
 * 从右屏选择元素并注入到左屏聊天输入
 * @param expectedTag - 预期的元素标签名
 */
async injectElementFromRightPanel(expectedTag: string): Promise<void> {
  // 1. 右屏开启选择模式
  await this.toggleSelectMode();

  // 2. 点击预览中的元素
  await this.selectElementInPreview();

  // 3. 点击添加按钮
  await this.addSelectedElement();

  // 4. 验证左屏输入区出现元素标签
  await expect(this.page.locator('.element-tag').filter({ hasText: expectedTag })).toBeVisible();
}

/**
 * 项目切换并验证聊天重置
 */
async switchProjectAndVerifyReset(projectName: string): Promise<void> {
  // 切换项目
  await this.page.getByRole('button', { name: projectName }).click();

  // 验证聊天重置
  await this.assertSessionReset();
}
```

## 测试文件结构

```
packages/e2e/tests/
├── journeys/
│   ├── chat.journey.ts          # 聊天核心功能
│   ├── chat-commands.journey.ts # 斜杠命令和附件
│   ├── chat-session.journey.ts  # 会话管理
│   └── chat-integration.journey.ts # 左右屏联动
└── fixtures/
    └── sample-image.png         # 测试图片附件
```

## 测试用例详情

### chat.journey.ts

```typescript
test.describe('聊天核心功能', () => {
  test('发送消息并显示回复', async ({ app, api }) => {
    // 前置：创建用户、组织、项目
    const user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));
    await app.configureClaude({ authToken: 'sk-test-token' });
    const org = await app.createOrganization(createOrganizationParams());
    await app.createProject(createProjectParams({ organizationId: org!.id }));

    // 发送消息
    await app.sendChatMessage('你好，请列出当前目录的文件');

    // 验证用户消息可见
    await app.assertChatMessageVisible('你好，请列出当前目录的文件', 'user');

    // 等待流式输出完成
    await app.waitForStreamingComplete();

    // 验证助手回复可见
    await app.assertChatMessageVisible('ls', 'assistant');
  });

  test('流式输出实时显示', async ({ app, api }) => {
    // 前置准备...
    await app.sendChatMessage('写一个简单的 hello world 函数');

    // 流式输出过程中消息应该增量显示
    // 等待完成
    await app.waitForStreamingComplete();

    // 验证完整内容
    await app.assertChatMessageVisible('hello world');
  });

  test('工具调用展示', async ({ app, api }) => {
    // 前置准备...
    await app.sendChatMessage('读取 README.md 文件');

    // 验证工具调用块出现
    await app.assertToolCallBlockVisible('Read');
    await app.assertToolCallStatus('Read', 'completed');

    // 展开查看输出
    await app.toggleToolCallBlock('Read', true);
    await app.assertChatMessageVisible('README.md');
  });

  test('Markdown 代码块渲染', async ({ app, api }) => {
    // 前置准备...
    await app.sendChatMessage('写一个 TypeScript 函数');

    await app.waitForStreamingComplete();

    // 验证代码块语法高亮
    const codeBlock = app.page.locator('pre code.language-typescript');
    await expect(codeBlock).toBeVisible();
  });
});
```

### chat-commands.journey.ts

```typescript
test.describe('斜杠命令和附件', () => {
  test('斜杠命令菜单打开和选择', async ({ app, api }) => {
    // 前置准备...

    // 打开命令菜单
    await app.openSlashCommandMenu();
    await app.assertSlashCommandMenuVisible();

    // 验证系统命令存在
    await expect(app.page.getByText('/help')).toBeVisible();
    await expect(app.page.getByText('/clear')).toBeVisible();

    // 选择命令
    await app.navigateSlashCommandMenu(0);
  });

  test('动态 skills 加载', async ({ app, api }) => {
    // 前置准备...

    // 打开命令菜单
    await app.openSlashCommandMenu();

    // 验证 Skills 分组存在（从 API 加载）
    await expect(app.page.getByText('Skills')).toBeVisible();
  });

  test('图片上传和预览', async ({ app, api }) => {
    // 前置准备...

    // 上传图片
    await app.uploadImageAttachment('tests/fixtures/sample-image.png');
    await app.assertImagePreviewVisible(1);

    // 发送带图片的消息
    await app.sendChatMessage('分析这张图片');

    // 验证消息包含图片
    const messageImage = app.page.locator('[data-role="user"] img');
    await expect(messageImage).toBeVisible();
  });

  test('粘贴上传图片', async ({ app, api }) => {
    // 前置准备...

    // 粘贴图片
    await app.pasteImageAttachment('tests/fixtures/sample-image.png');
    await app.assertImagePreviewVisible(1);
  });

  test('移除图片附件', async ({ app, api }) => {
    // 前置准备...

    await app.uploadImageAttachment('tests/fixtures/sample-image.png');
    await app.assertImagePreviewVisible(1);

    // 移除
    await app.removeImageAttachment(0);
    await app.assertImagePreviewVisible(0);
  });
});
```

### chat-session.journey.ts

```typescript
test.describe('会话管理', () => {
  test('代理选择切换', async ({ app, api }) => {
    // 前置准备...

    // 默认是 Claude
    await app.assertAgentSelected('Claude');

    // 切换到 Codex
    await app.selectAgent('codex');
    await app.assertAgentSelected('Codex');
  });

  test('权限模式切换', async ({ app, api }) => {
    // 前置准备...

    // 默认是 Default 模式
    await app.selectPermissionMode('plan');

    // 发送消息验证模式生效（plan 模式应该先规划）
    await app.sendChatMessage('重构这个函数');
    await app.waitForStreamingComplete();
    // plan 模式的特征：先输出计划再执行
  });

  test('会话重启', async ({ app, api }) => {
    // 前置准备...

    // 发送一些消息
    await app.sendChatMessage('第一条消息');
    await app.waitForStreamingComplete();

    // 重启会话
    await app.restartChatSession();
    await app.assertSessionReset();
  });

  test('连接状态显示', async ({ app, api }) => {
    // 前置准备...

    // 验证已连接
    await app.assertConnectionStatus(true);
  });
});
```

### chat-integration.journey.ts

```typescript
test.describe('左右屏联动', () => {
  test('元素选择注入聊天输入', async ({ app, api }) => {
    // 前置准备...

    // 从右屏选择元素
    await app.injectElementFromRightPanel('div');

    // 发送带元素的消息
    await app.sendChatMessage('修改这个元素的样式');

    // 验证消息包含元素信息
    await app.assertChatMessageVisible('修改这个元素的样式', 'user');
  });

  test('项目切换重置聊天', async ({ app, api }) => {
    // 前置准备，创建两个项目
    const org = await app.createOrganization(createOrganizationParams());
    await app.createProject({ name: 'Project Alpha', organizationId: org!.id });
    await app.createProject({ name: 'Project Beta', organizationId: org!.id });

    // 在第一个项目中发送消息
    await app.sendChatMessage('这是项目 Alpha 的消息');
    await app.waitForStreamingComplete();

    // 切换到第二个项目
    await app.switchProjectAndVerifyReset('Project Beta');

    // 验证聊天清空
    await app.assertSessionReset();
  });
});
```

## 组件可测点映射

| 组件 | data 属性定位器 | 测试用途 |
|------|----------------|---------|
| `MessageItem` | `data-role="user"` / `data-role="assistant"` | 区分消息来源 |
| `ToolCallBlock` | `data-tool-name="Read"` / `data-status="running"` | 工具调用定位和状态 |
| `ChatInput` | `data-testid="chat-input"` | 输入区域定位 |
| `SlashCommandMenu` | `.cmd-menu` | 命令菜单容器 |
| `AttachmentTray` | `.attachment-tray` | 附件托盘容器 |
| `AttachmentChip` | `.attachment-chip` | 单个图片预览 |
| `ConnectionStatus` | `.status-dot` / `.status-running` | 连接状态指示 |

## 实现依赖

### 前端组件必须添加的 data 属性

```tsx
// MessageItem
<div data-role={message.role}>

// ToolCallBlock
<div data-tool-name={toolName} data-status={status}>
  <button data-action="toggle">

// ChatInput
<div data-testid="chat-input">

// AttachmentTray
<div className="attachment-tray">
  <div className="attachment-chip" data-index={index}>
```

### 后端 API 需要支持

- `/api/skills` — 返回可用 skills 列表（已实现）
- WebSocket `/terminal` namespace — 流式消息和工具调用事件（需扩展）

### 测试环境

- 需要 `./scripts/start-e2e.sh` 启动前后端服务
- 测试 fixtures 目录需要准备 `sample-image.png`

## 测试策略

1. **真实 WebSocket 连接** — 不使用 mock，依赖后端服务真实运行
2. **超时策略** — 流式输出等待 30s，工具调用等待 15s，普通操作 10s
3. **失败处理** — 使用 `test.skip()` 优雅跳过不可测场景（如 iframe 内容）
4. **并行控制** — 聊天测试串行执行（共享 WebSocket session）

## 后续步骤

1. 实现 `ChatWorkspace` 及其子组件
2. 添加必要的 data 属性到组件
3. 扩展 `test-app.ts` 方法
4. 编写测试文件
5. 准备测试 fixtures