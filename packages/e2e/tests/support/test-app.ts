// packages/e2e/tests/support/test-app.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TestDatabase } from './database';
import type { TestApi } from './test-api';
import type { TestUser, TestOrganization, TestProject } from './types';

export class TestApp {
  constructor(
    public readonly page: Page,
    private readonly db: TestDatabase,
    public readonly api: TestApi
  ) {}

  // ============================================
  // Authentication Operations
  // ============================================

  /**
   * Register a new user
   */
  async register(params: {
    email: string;
    name: string;
    password: string;
  }): Promise<TestUser> {
    await this.page.goto('/register');
    await this.page.fill('input[type="email"]', params.email);
    await this.page.fill('input[placeholder="用户名"]', params.name);
    await this.page.fill('input[type="password"]', params.password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });

    // Get token from localStorage and set it on API
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    if (token) {
      this.api.setToken(token);
    }

    // Return user info from API
    return this.api.getCurrentUser();
  }

  /**
   * Login with existing credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });

    // Sync token to API
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    if (token) {
      this.api.setToken(token);
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.page.click('text=退出');
    await this.page.waitForURL('**/login', { timeout: 5000 });
    this.api.clearToken();
  }

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Configure Claude Code settings
   */
  async configureClaude(params: { authToken: string }): Promise<void> {
    await this.page.goto('/settings');
    
    // Click Claude Code tab
    await this.page.click('text=Claude Code');

    // Prepare config JSON
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

    // Fill and save
    await this.page.fill('textarea', JSON.stringify(config, null, 2));
    await this.page.click('text=保存配置');
    await this.page.waitForSelector('text=配置保存成功', { timeout: 5000 });
  }

  // ============================================
  // Organization Operations
  // ============================================

  /**
   * Create a new organization
   */
  async createOrganization(params: { name: string }): Promise<TestOrganization> {
    await this.page.goto('/settings');
    await this.page.click('text=创建组织');
    await this.page.fill('input[placeholder="组织名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getOrganizationByName(params.name);
  }

  /**
   * Invite a member to organization
   */
  async inviteMember(orgId: number, email: string): Promise<void> {
    await this.page.goto('/settings');
    
    // Find and click organization in list
    const orgLocator = this.page.locator(`text=${orgId}`).first();
    await orgLocator.click();
    
    // Click invite button
    await this.page.click('text=邀请成员');
    await this.page.fill('input[type="email"]', email);
    await this.page.click('button:has-text("发送邀请")');
    await this.page.waitForSelector(`text=${email}`, { timeout: 5000 });
  }

  // ============================================
  // Project Operations
  // ============================================

  /**
   * Create a new project
   */
  async createProject(params: { name: string }): Promise<TestProject> {
    await this.page.goto('/dashboard');
    await this.page.click('text=新建项目');
    await this.page.fill('input[placeholder="项目名称"]', params.name);
    await this.page.click('button:has-text("创建")');
    await this.page.waitForSelector(`text=${params.name}`, { timeout: 5000 });

    return this.api.getProjectByName(params.name);
  }

  /**
   * Start a project container
   */
  async startProject(projectId: number): Promise<void> {
    await this.page.goto('/dashboard');
    
    // Click on project to start
    await this.page.click(`[data-testid="project-${projectId}"], :text("${projectId}")`);
    
    // Wait for container startup
    await this.page.waitForSelector('text=终端', { timeout: 30000 });
  }

  /**
   * Delete a project via API
   */
  async deleteProject(projectId: number): Promise<void> {
    await this.api.deleteProject(projectId);
  }

  // ============================================
  // Invitation Operations
  // ============================================

  /**
   * Navigate to invitations page
   */
  async goToInvitations(): Promise<void> {
    await this.page.goto('/invitations');
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });
    await this.page.click(`button:has-text("接受")`);
    await this.page.waitForSelector('text=已加入组织', { timeout: 5000 });
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(orgName: string): Promise<void> {
    await this.goToInvitations();
    await this.page.waitForSelector(`text=${orgName}`, { timeout: 5000 });
    await this.page.click(`button:has-text("拒绝")`);
    await this.page.waitForSelector('text=已拒绝邀请', { timeout: 5000 });
  }

  // ============================================
  // Assertion Methods
  // ============================================

  /**
   * Assert user is logged in (on dashboard)
   */
  async assertLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/.*dashboard.*/);
  }

  /**
   * Assert user is on login page
   */
  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*login.*/);
  }

  /**
   * Assert project is visible in list
   */
  async assertProjectVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert project is NOT visible in list
   */
  async assertProjectNotVisible(name: string): Promise<void> {
    await this.page.goto('/dashboard');
    await expect(this.page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert project is running
   */
  async assertProjectRunning(projectId: number): Promise<void> {
    const status = await this.api.getProjectStatus(projectId);
    expect(status).toBe('running');
  }

  /**
   * Assert organization is visible in settings
   */
  async assertOrganizationVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Assert organization is NOT visible in settings
   */
  async assertOrganizationNotVisible(name: string): Promise<void> {
    await this.page.goto('/settings');
    await expect(this.page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5000 });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get a locator for an element
   */
  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  /**
   * Navigate to a path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Reload current page
   */
  async reload(): Promise<void> {
    await this.page.reload();
  }
}
