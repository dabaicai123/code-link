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
    await this.page.getByLabel('邮箱地址').fill(params.email);
    await this.page.getByLabel('用户名').fill(params.name);
    await this.page.getByLabel('密码').fill(params.password);
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
    await this.page.getByLabel('邮箱地址').fill(email);
    await this.page.getByLabel('密码').fill(password);
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

  async configureClaude(params: {
    authToken: string;
    baseUrl?: string;
    opusModel?: string;
    sonnetModel?: string;
    haikuModel?: string;
  }): Promise<void> {
    await this.page.goto('/settings');

    // Navigate to Claude Code page via sidebar
    await this.page.getByText('Claude Code', { exact: true }).click();

    const config = {
      env: {
        ANTHROPIC_BASE_URL: params.baseUrl ?? '',
        ANTHROPIC_AUTH_TOKEN: params.authToken,
        ANTHROPIC_DEFAULT_OPUS_MODEL: params.opusModel ?? 'claude-opus-4-7',
        ANTHROPIC_DEFAULT_SONNET_MODEL: params.sonnetModel ?? 'claude-sonnet-4-6',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: params.haikuModel ?? 'claude-haiku-4-5',
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

  async selectProject(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    // Click the project in the sidebar to make it active
    await this.page.getByText(name, { exact: true }).first().click();
    // Wait for chat panel to appear (indicates project is active)
    await this.page.locator('[data-testid="chat-input"]').waitFor({ state: 'visible', timeout: 15000 });
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
  // Preview Element Selection Operations
  // ============================================

  /**
   * Switch to the preview tab in the right panel
   */
  async switchToPreviewTab(): Promise<void> {
    await this.page.getByRole('button', { name: '预览' }).click();
    await expect(this.page.getByText('预览', { exact: true }).first()).toBeVisible();
  }

  /**
   * Enter a URL in the preview panel's URL bar
   */
  async enterPreviewUrl(url: string): Promise<void> {
    const urlInput = this.page.getByPlaceholder('输入 URL 查看预览...');
    await urlInput.fill(url);
    await urlInput.press('Enter');
  }

  /**
   * Toggle select mode in the preview panel
   */
  async toggleSelectMode(): Promise<void> {
    await this.page.getByRole('button', { name: '选择元素' }).click();
    await expect(this.page.getByText('选择模式已开启')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Cancel select mode
   */
  async cancelSelectMode(): Promise<void> {
    await this.page.getByRole('button', { name: '取消选择' }).click();
  }

  /**
   * Assert select mode is active
   */
  async assertSelectModeActive(): Promise<void> {
    await expect(this.page.getByText('选择模式已开启')).toBeVisible({ timeout: 5000 });
  }

  /**
   * Click on an element in the iframe preview to select it
   * Note: The display panel has a transparent overlay that captures clicks
   */
  async selectElementInPreview(): Promise<void> {
    const overlay = this.page.locator('[data-testid="chat-workspace"]').locator('.absolute.inset-0.z-10');
    await overlay.waitFor({ state: 'visible', timeout: 5000 });
    await overlay.click({ position: { x: 200, y: 100 } });
  }

  /**
   * Add the selected element to the chat input
   */
  async addSelectedElement(): Promise<void> {
    const addButton = this.page.getByRole('button', { name: /添加 </ });
    await addButton.waitFor({ state: 'visible', timeout: 5000 });
    await addButton.click();
  }

  /**
   * Check if an element tag is visible in the chat input
   */
  async assertElementTagVisible(tagName: string): Promise<void> {
    const chatInput = this.page.locator('[data-testid="chat-input"]');
    await expect(chatInput.locator(`text=<${tagName}>`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Type a message in the chat input alongside element tags
   */
  async typeChatMessageWithElements(text: string): Promise<void> {
    const textarea = this.page.locator('[data-testid="chat-input"] textarea');
    await textarea.fill(text);
  }

  /**
   * Send the chat message with elements
   */
  async sendChatMessageWithElements(): Promise<void> {
    await this.page.locator('[data-testid="chat-input"]').getByRole('button', { name: '发送' }).click();
  }

  /**
   * Assert element tag appears inline in a sent user message
   */
  async assertInlineElementInMessage(tagName: string): Promise<void> {
    const userMsg = this.page.locator('[data-role="user"]').last();
    await expect(userMsg.locator(`text=<${tagName}>`)).toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Collaboration Panel Navigation
  // ============================================

  async ensureCollabTabActive(): Promise<void> {
    // Ensure RightPanel's "协作" tab is active
    const collabTab = this.page.getByRole('button', { name: '协作' });
    await collabTab.click();
  }

  async selectDraft(draftTitle: string): Promise<void> {
    // From DraftList click the specified Draft
    await this.ensureCollabTabActive();
    await this.page.getByText(draftTitle).click();
    // Wait for Timeline view to load — the "返回" back button appears
    await expect(this.page.getByText('返回')).toBeVisible({ timeout: 5000 });
  }

  async createDraftViaUI(title: string): Promise<void> {
    await this.ensureCollabTabActive();
    await this.page.getByText('新建协作').click();
    await this.page.getByPlaceholder('协作标题...').fill(title);
    await this.page.getByRole('button', { name: '创建' }).click();
    // Wait for DraftList to refresh and show the new draft
    await expect(this.page.getByText(title)).toBeVisible({ timeout: 5000 });
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
    // Slash command menu has no data-testid; identify by command text
    await expect(this.page.getByText('/clear').first()).toBeVisible({ timeout: 5000 });
  }

  async assertSlashCommandMenuVisible(): Promise<void> {
    await expect(this.page.getByText('/clear').first()).toBeVisible();
  }

  async navigateSlashCommandMenu(index: number): Promise<void> {
    for (let i = 0; i < index; i++) {
      await this.page.keyboard.press('ArrowDown');
    }
    await this.page.keyboard.press('Enter');
  }

  async selectSlashCommand(command: string): Promise<void> {
    await this.openSlashCommandMenu();
    await this.page.getByText(command).first().click();
  }

  // ============================================
  // Attachments
  // ============================================

  async uploadImageAttachment(filePath: string): Promise<void> {
    const attachBtn = this.page.locator('button[title="添加图片"]');
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await attachBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  async removeImageAttachment(index: number): Promise<void> {
    const chip = this.page.locator(`[data-index="${index}"]`);
    // The remove icon is an X SVG from lucide-react, click the last svg element
    await chip.locator('svg').last().click();
  }

  async assertImagePreviewVisible(count: number): Promise<void> {
    const previews = this.page.locator('[data-testid="attachment-tray"]').locator('[data-index]');
    await expect(previews).toHaveCount(count, { timeout: 5000 });
  }

  // ============================================
  // Agent & Permission Mode
  // ============================================

  async selectAgent(agent: 'claude' | 'codex'): Promise<void> {
    // Agent toggle button in chat input toolbar
    const agentBtn = this.page.locator('[data-testid="chat-input"]').locator('button').filter({ hasText: /Claude|Codex/ });
    await agentBtn.click();
  }

  async selectPermissionMode(mode: 'default' | 'plan' | 'yolo'): Promise<void> {
    // Permission mode dropdown in chat input toolbar
    const modeSelect = this.page.locator('[data-testid="chat-input"]').locator('select');
    await modeSelect.selectOption(mode);
  }

  async assertAgentSelected(agent: string): Promise<void> {
    const agentBtn = this.page.locator('[data-testid="chat-input"]').locator('button').filter({ hasText: new RegExp(`^${agent}$`, 'i') });
    await expect(agentBtn).toBeVisible();
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
  // Card Operations
  // ============================================

  async clickCard(shortId: string): Promise<void> {
    await this.page.getByTestId(`timeline-card-${shortId}`).click();
  }

  async rightClickCard(shortId: string): Promise<void> {
    await this.page.getByTestId(`timeline-card-${shortId}`).click({ button: 'right' });
  }

  async expandCardDetail(shortId: string): Promise<void> {
    await this.page.getByTestId(`timeline-card-${shortId}`).getByTestId('card-expand-detail').click();
  }

  async assertCardVisible(shortId: string): Promise<void> {
    await expect(this.page.getByTestId(`timeline-card-${shortId}`)).toBeVisible({ timeout: 5000 });
  }

  async assertCardDetailModalVisible(): Promise<void> {
    await expect(this.page.getByTestId('card-detail-modal')).toBeVisible({ timeout: 5000 });
  }

  async assertCardDetailModalNotVisible(): Promise<void> {
    await expect(this.page.getByTestId('card-detail-modal')).not.toBeVisible();
  }

  async assertContextMenuVisible(): Promise<void> {
    await expect(this.page.getByTestId('card-context-menu')).toBeVisible({ timeout: 5000 });
  }

  async clickContextMenuItem(itemText: string): Promise<void> {
    await this.page.getByTestId('card-context-menu').getByRole('button', { name: itemText }).click();
  }

  // ============================================
  // Session Management
  // ============================================

  async restartChatSession(): Promise<void> {
    // The restart button uses text "重启" (conditional render, may not exist)
    await this.page.getByRole('button', { name: '重启' }).click({ timeout: 5000 });
  }

  async assertSessionReset(): Promise<void> {
    // After restart, the welcome message reappears
    await expect(this.page.getByText(/欢迎使用|开始对话|Welcome/i)).toBeVisible({ timeout: 5000 });
  }

  async assertConnectionStatus(connected: boolean): Promise<void> {
    const statusDot = this.page.locator('[data-testid="chat-workspace"]').locator('.bg-status-running, .bg-status-stopped').first();
    if (connected) {
      await expect(statusDot).toHaveClass(/bg-status-running/);
    } else {
      await expect(statusDot).toHaveClass(/bg-status-stopped/);
    }
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