// packages/e2e/tests/collaboration.spec.ts
import { test, expect } from '../fixtures/base';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedTestOrganization, seedTestProject } from '../helpers/test-db';

test.describe('协作功能', () => {
  // 使用 testUser fixture 自动设置的认证和 API 路由

  test.beforeEach(async ({ page, testServer, testUser, webBaseUrl }) => {
    // 创建组织和项目
    const db = drizzle(testServer.db);
    const orgId = await seedTestOrganization(db, testUser.id, 'Collab Org');
    await seedTestProject(db, testUser.id, orgId, { name: 'Collab Project' });
    await page.goto(`${webBaseUrl}/dashboard`);
  });

  test('消息面板显示', async ({ page }) => {
    await page.click('text=Collab Project');
    await expect(page.locator('input[placeholder*="消息"]')).toBeVisible();
  });

  test('发送消息', async ({ page }) => {
    await page.click('text=Collab Project');
    const messageInput = page.locator('input[placeholder*="消息"]').first();
    await messageInput.fill('Hello, this is a test message!');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=Hello, this is a test message!')).toBeVisible();
  });

  test('草稿列表显示', async ({ page }) => {
    await page.click('text=Collab Project');
    await expect(page.locator('text=草稿')).toBeVisible();
  });
});