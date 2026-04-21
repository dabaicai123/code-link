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

    await this.page.getByRole('tab', { name: 'Claude Code' }).click();

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
    await this.page.getByText('保存配置').click();
    await this.page.waitForSelector('text=配置保存成功', { timeout: 5000 });
  }

  // ============================================
  // Organization Operations
  // ============================================

  async createOrganization(params: { name: string }): Promise<TestOrganization> {
    await this.page.goto('/settings');
    await this.page.getByText('+ 创建组织').click();
    await this.page.getByPlaceholder('输入组织名称').fill(params.name);
    await this.page.getByRole('dialog').getByRole('button', { name: '创建组织' }).click();
    // Wait for the organization name to appear in the list
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getOrganizationByName(params.name);
  }

  async inviteMember(orgId: number, email: string): Promise<void> {
    const org = await this.api.getOrganizationById(orgId);
    await this.page.goto('/settings');

    // Click the organization in the left list
    await this.page.getByText(org!.name).first().click();

    // Wait for detail panel to load, then click invite button
    await this.page.getByText('邀请成员', { exact: true }).click();

    // Fill invite dialog - use locator within dialog
    const dialog = this.page.getByRole('dialog', { name: '邀请成员' });
    await dialog.locator('input[type="email"]').fill(email);
    await dialog.getByRole('button', { name: '发送邀请' }).click();

    // Wait a moment for the request to complete, then verify via API
    await this.page.waitForTimeout(2000);
  }

  // ============================================
  // Project Operations
  // ============================================

  async createProject(params: { name: string }): Promise<TestProject> {
    await this.page.goto('/dashboard');
    await this.page.getByText('+ 新建项目').click();
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
    // Accept redirects to /organizations, wait for navigation
    await this.page.waitForURL(/.*organizations|.*dashboard|.*settings/, { timeout: 10000 });
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