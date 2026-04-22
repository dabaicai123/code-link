// packages/e2e/tests/support/test-app.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TestApi } from './test-api';
import type { TestUser, TestOrganization, TestProject } from './types';

export class TestApp {
  constructor(
    public readonly page: Page,
    public readonly api: TestApi
  ) {}

  // ============================================
  // Authentication Operations
  // ============================================

  async register(params: {
    email: string;
    name: string;
    password: string;
  }): Promise<TestUser> {
    await this.page.goto('/register');
    await this.page.getByPlaceholder('邮箱地址').fill(params.email);
    await this.page.getByPlaceholder('用户名').fill(params.name);
    await this.page.getByPlaceholder('密码').fill(params.password);
    await this.page.getByRole('button', { name: '注册' }).click();
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });

    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    if (token) {
      this.api.setToken(token);
    }

    return this.api.getCurrentUser();
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.getByPlaceholder('邮箱地址').fill(email);
    await this.page.getByPlaceholder('密码').fill(password);
    await this.page.getByRole('button', { name: '登录' }).click();
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });

    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    if (token) {
      this.api.setToken(token);
    }
  }

  async logout(): Promise<void> {
    // Navigate to dashboard for reliable logout
    await this.page.goto('/dashboard');

    // Dashboard sidebar has ⚙ logout icon with title "退出登录"
    const logoutBtn = this.page.locator('button[title="退出登录"]');
    await logoutBtn.waitFor({ state: 'visible', timeout: 5000 });
    await logoutBtn.click({ force: true });
    await this.page.waitForURL('**/login', { timeout: 10000 });
    this.api.clearToken();
  }

  // ============================================
  // Settings Operations
  // ============================================

  async configureClaude(params: { authToken: string }): Promise<void> {
    await this.page.goto('/settings');

    // Navigate to Claude Code page via sidebar
    await this.page.getByText('Claude Code', { exact: true }).click();

    const config = {
      env: {
        ANTHROPIC_BASE_URL: '',
        ANTHROPIC_AUTH_TOKEN: params.authToken,
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      },
      skipDangerousModePermissionPrompt: true,
    };

    await this.page.locator('textarea').fill(JSON.stringify(config, null, 2));
    await this.page.getByRole('button', { name: '保存配置' }).click();
    await this.page.waitForSelector('text=配置保存成功', { timeout: 5000 });
  }

  // ============================================
  // Organization Operations
  // ============================================

  async createOrganization(params: { name: string }): Promise<TestOrganization> {
    await this.page.goto('/settings');

    // Navigate to organization page via sidebar
    await this.page.getByText('组织管理', { exact: true }).click();

    // Click the "创建新组织" button
    await this.page.getByText('创建新组织').click();
    await this.page.getByPlaceholder('输入组织名称').fill(params.name);
    await this.page.getByRole('dialog').getByRole('button', { name: '创建组织' }).click();
    // Wait for the organization name to appear in the list
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getOrganizationByName(params.name);
  }

  async inviteMember(orgId: number, email: string): Promise<void> {
    const org = await this.api.getOrganizationById(orgId);
    await this.page.goto('/settings');

    // Navigate to organization page via sidebar
    await this.page.getByText('组织管理', { exact: true }).click();

    // Click the organization card in the list
    await this.page.getByText(org!.name).first().click();

    // Wait for detail panel to load, then click invite button
    await this.page.getByRole('button', { name: '邀请成员' }).click();

    // Fill invite dialog - use locator within dialog
    const dialog = this.page.getByRole('dialog', { name: '邀请成员' });
    await dialog.getByPlaceholder('输入成员邮箱').fill(email);
    await dialog.getByRole('button', { name: '发送邀请' }).click();

    // Wait a moment for the request to complete, then verify via API
    await this.page.waitForTimeout(2000);
  }

  // ============================================
  // Project Operations
  // ============================================

  async createProject(params: { name: string; organizationId?: number }): Promise<TestProject> {
    await this.page.goto('/dashboard');
    await this.page.getByText('+ 新建项目').click();

    // Select organization if specified — find org name via API for the dropdown
    if (params.organizationId) {
      const org = await this.api.getOrganizationById(params.organizationId);
      // The dropdown shows "OrgName (Owner)" or "OrgName (Developer)"
      const orgLabel = org ? `${org.name} (${org.role === 'owner' ? 'Owner' : 'Developer'})` : String(params.organizationId);
      await this.page.getByRole('combobox').click();
      await this.page.getByRole('option', { name: orgLabel }).click();
    }

    await this.page.getByPlaceholder('输入项目名称').fill(params.name);
    await this.page.getByRole('dialog').getByRole('button', { name: '创建项目' }).click();
    await this.page.waitForSelector('dialog', { state: 'hidden', timeout: 5000 });

    return this.api.getProjectByName(params.name);
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.api.deleteProject(projectId);
  }

  // ============================================
  // Invitation Operations
  // ============================================

  async goToInvitations(): Promise<void> {
    await this.page.goto('/invitations');
  }

  async acceptInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });
    await this.page.getByRole('button', { name: '接受' }).first().click();
    // After accept, the app may redirect — wait for landing on a valid page
    await this.page.waitForURL(/.*dashboard|.*settings|.*invitations/, { timeout: 10000 });
  }

  async declineInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });

    // Set up dialog handler before clicking
    this.page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await this.page.getByRole('button', { name: '拒绝' }).first().click();
    await this.page.waitForTimeout(1000);
  }

  // ============================================
  // Assertion Methods
  // ============================================

  async assertLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
  }

  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*login.*/);
  }

  async assertProjectVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 5000 });
  }

  async assertProjectNotVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.getByText(name)).not.toBeVisible({ timeout: 5000 });
  }

  async assertOrganizationVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.getByText(name)).toBeVisible({ timeout: 5000 });
  }

  async assertOrganizationNotVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.getByText(name)).not.toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Collaboration Operations
  // ============================================

  /**
   * Toggle select mode in the collaboration panel
   */
  async toggleSelectMode(): Promise<void> {
    // Click the select button in the collaboration panel toolbar
    await this.page.getByRole('button', { name: '🎯 选择' }).first().click();
    // Wait for select mode indicator text to appear
    await expect(this.page.getByText('选择模式已开启')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Click on an element in the iframe preview to select it
   * Note: The display panel has a transparent overlay that captures clicks
   */
  async selectElementInPreview(): Promise<void> {
    // Wait for select mode to be active (cancel button appears)
    await expect(this.page.getByRole('button', { name: '✕ 取消' })).toBeVisible({ timeout: 5000 });

    // The overlay is hidden but still captures clicks
    // Click on the preview area container
    const previewContainer = this.page.locator('.flex-1.relative').filter({
      has: this.page.locator('iframe')
    });

    // Click through the overlay to select an element
    await previewContainer.click({ position: { x: 200, y: 100 } });
  }

  /**
   * Add the selected element to the message
   */
  async addSelectedElement(): Promise<void> {
    // Click the "添加 <tag>" button that appears after selection
    const addButton = this.page.getByRole('button', { name: /添加 </ });
    await addButton.waitFor({ state: 'visible', timeout: 5000 });
    await addButton.click();
  }

  /**
   * Type a message in the message editor
   */
  async typeCollaborationMessage(text: string): Promise<void> {
    const input = this.page.getByPlaceholder('描述修改...');
    await input.fill(text);
  }

  /**
   * Send the collaboration message
   */
  async sendCollaborationMessage(): Promise<void> {
    await this.page.getByRole('button', { name: '发送' }).click();
  }

  /**
   * Cancel select mode
   */
  async cancelSelectMode(): Promise<void> {
    await this.page.getByRole('button', { name: '✕ 取消' }).click();
  }

  /**
   * Expand the collaboration panel
   */
  async expandCollaborationPanel(): Promise<void> {
    await this.page.getByRole('button', { name: '展示' }).click();
  }

  /**
   * Check if collaboration panel is visible
   */
  async assertCollaborationPanelVisible(): Promise<void> {
    await expect(this.page.getByText('协作面板')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Check if an element tag is visible in the message editor
   */
  async assertElementTagVisible(tagName: string): Promise<void> {
    await expect(this.page.locator(`text=<${tagName}>`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert select mode is active
   */
  async assertSelectModeActive(): Promise<void> {
    await expect(this.page.getByText('选择模式已开启')).toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Chat Operations
  // ============================================

  async sendChatMessage(text: string): Promise<void> {
    const input = this.page.locator('[data-testid="chat-input"] textarea');
    await input.fill(text);
    await this.page.getByRole('button', { name: /➤|发送|Send/ }).click();
  }

  async assertChatMessageVisible(content: string, role?: 'user' | 'assistant'): Promise<void> {
    const locator = role
      ? this.page.locator(`[data-role="${role}"]`).filter({ hasText: content })
      : this.page.getByText(content);
    await expect(locator).toBeVisible({ timeout: 10000 });
  }

  async waitForStreamingComplete(): Promise<void> {
    await expect(this.page.getByRole('button', { name: /➤|发送|Send/ })).toBeEnabled({ timeout: 30000 });
  }

  async assertChatWorkspaceVisible(): Promise<void> {
    await expect(this.page.locator('[data-testid="chat-workspace"]')).toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Slash Commands
  // ============================================

  async openSlashCommandMenu(): Promise<void> {
    const input = this.page.locator('[data-testid="chat-input"] textarea');
    await input.fill('/');
    await expect(this.page.locator('.cmd-menu')).toBeVisible({ timeout: 5000 });
  }

  async assertSlashCommandMenuVisible(): Promise<void> {
    await expect(this.page.locator('.cmd-menu')).toBeVisible();
  }

  async navigateSlashCommandMenu(index: number): Promise<void> {
    for (let i = 0; i < index; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    await this.page.keyboard.press('Enter');
  }

  async selectSlashCommand(command: string): Promise<void> {
    await this.openSlashCommandMenu();
    await this.page.locator('.cmd-item').filter({ hasText: command }).click();
  }

  // ============================================
  // Attachments
  // ============================================

  async uploadImageAttachment(filePath: string): Promise<void> {
    const attachBtn = this.page.getByRole('button', { name: /📎|attach|上传图片|Image/ });
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  async removeImageAttachment(index: number): Promise<void> {
    const chip = this.page.locator(`[data-index="${index}"]`);
    await chip.locator('span').filter({ hasText: '✕' }).click();
  }

  async assertImagePreviewVisible(count: number): Promise<void> {
    const previews = this.page.locator('.attachment-chip');
    await expect(previews).toHaveCount(count, { timeout: 5000 });
  }

  // ============================================
  // Agent & Permission Mode
  // ============================================

  async selectAgent(agent: 'claude' | 'codex'): Promise<void> {
    await this.page.locator('.chat-agent-btn').click();
  }

  async selectPermissionMode(mode: 'default' | 'plan' | 'yolo'): Promise<void> {
    await this.page.locator('.mode-select').selectOption(mode);
  }

  async assertAgentSelected(agent: string): Promise<void> {
    const agentBtn = this.page.locator('.chat-agent-btn');
    await expect(agentBtn).toContainText(agent);
  }

  // ============================================
  // Tool Calls
  // ============================================

  async assertToolCallBlockVisible(toolName: string): Promise<void> {
    const toolBlock = this.page.locator(`[data-tool-name="${toolName}"]`);
    await expect(toolBlock).toBeVisible({ timeout: 15000 });
  }

  async toggleToolCallBlock(toolName: string): Promise<void> {
    const toolBlock = this.page.locator(`[data-tool-name="${toolName}"]`);
    await toolBlock.locator('[data-action="toggle"]').click();
  }

  async assertToolCallStatus(toolName: string, status: 'running' | 'completed' | 'error'): Promise<void> {
    const toolBlock = this.page.locator(`[data-tool-name="${toolName}"]`);
    await expect(toolBlock).toHaveAttribute('data-status', status);
  }

  // ============================================
  // Session Management
  // ============================================

  async restartChatSession(): Promise<void> {
    await this.page.getByRole('button', { name: /重启|Restart|重置/ }).click();
  }

  async assertSessionReset(): Promise<void> {
    await expect(this.page.getByText(/欢迎使用|开始对话|Welcome/i)).toBeVisible({ timeout: 5000 });
  }

  async assertConnectionStatus(connected: boolean): Promise<void> {
    const statusDot = this.page.locator('.status-dot');
    const expectedClass = connected ? 'status-dot-running' : 'status-dot-stopped';
    await expect(statusDot).toHaveClass(new RegExp(expectedClass));
  }

  // ============================================
  // Utility Methods
  // ============================================

  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }
}