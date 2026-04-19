// packages/e2e/tests/collaboration.spec.ts
import { test, expect } from '../fixtures/base';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { seedTestOrganization, seedTestProject } from '../helpers/test-db';

test.describe('协作功能', () => {
  // 协作功能在 Workspace 中，需要先选择项目

  test.beforeEach(async ({ page, testServer, testUser, webBaseUrl }) => {
    // 创建组织和项目
    const db = drizzle(testServer.db);
    const orgId = await seedTestOrganization(db, testUser.id, 'Collab Org');
    await seedTestProject(db, testUser.id, orgId, { name: 'Collab Project' });
    await page.goto(`${webBaseUrl}/dashboard`);
  });

  test('项目显示在侧边栏', async ({ page }) => {
    await expect(page.locator('text=Collab Project')).toBeVisible();
  });

  test('点击项目进入工作区', async ({ page }) => {
    await page.click('text=Collab Project');
    // 点击后会尝试启动容器，等待工作区加载
  });

  test('新建项目按钮可见', async ({ page }) => {
    await expect(page.locator('text=新建项目')).toBeVisible();
  });
});