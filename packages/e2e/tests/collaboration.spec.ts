import { test, expect } from '../fixtures/base';
import { seedTestOrganization, seedTestProject } from '../helpers/test-db';

test.describe('协作功能', () => {
  test.beforeEach(async ({ page, testUser, testDb, webBaseUrl }) => {
    const orgId = await seedTestOrganization(testDb, testUser.id, 'Collab Org');
    await seedTestProject(testDb, testUser.id, orgId, { name: 'Collab Project' });
    await page.goto(`${webBaseUrl}/dashboard`);
  });

  test('项目显示在侧边栏', async ({ page }) => {
    await expect(page.locator('text=Collab Project')).toBeVisible();
  });

  test('点击项目进入工作区', async ({ page }) => {
    await page.click('text=Collab Project');
  });

  test('新建项目按钮可见', async ({ page }) => {
    await expect(page.locator('text=新建项目')).toBeVisible();
  });
});
