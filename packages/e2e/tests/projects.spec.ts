import { test, expect } from '../fixtures/base';
import { seedTestOrganization, seedTestProject } from '../helpers/test-db';

test.describe('项目管理', () => {
  test.describe('项目列表', () => {
    test('空列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/dashboard`);
      await expect(page.locator('text=新建项目')).toBeVisible();
    });

    test('多项目显示', async ({ page, testUser, testDb, webBaseUrl }) => {
      const orgId = await seedTestOrganization(testDb, testUser.id, 'Test Org');
      await seedTestProject(testDb, testUser.id, orgId, { name: 'Project Alpha' });
      await seedTestProject(testDb, testUser.id, orgId, { name: 'Project Beta' });
      await seedTestProject(testDb, testUser.id, orgId, { name: 'Project Gamma' });

      await page.goto(`${webBaseUrl}/dashboard`);
      await expect(page.locator('text=Project Alpha')).toBeVisible();
      await expect(page.locator('text=Project Beta')).toBeVisible();
      await expect(page.locator('text=Project Gamma')).toBeVisible();
    });
  });

  test.describe('项目创建', () => {
    test('创建 Node 项目', async ({ page, webBaseUrl, testUser, testDb }) => {
      await seedTestOrganization(testDb, testUser.id, 'Create Test Org');

      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=新建项目');
      await expect(page.locator('text=新建项目')).toBeVisible();
      await page.fill('input[placeholder="项目名称"]', 'My New Project');
      await page.click('button:has-text("创建")');
      await expect(page.locator('text=My New Project')).toBeVisible();
    });

    test('创建项目空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=新建项目');
      await page.click('button:has-text("创建")');
    });
  });

  test.describe('项目详情', () => {
    test('进入 Workspace', async ({ page, webBaseUrl, testUser, testDb }) => {
      const orgId = await seedTestOrganization(testDb, testUser.id, 'Workspace Test Org');
      await seedTestProject(testDb, testUser.id, orgId, { name: 'Workspace Project' });

      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=Workspace Project');
    });

    test('显示模板类型', async ({ page, webBaseUrl, testUser, testDb }) => {
      const orgId = await seedTestOrganization(testDb, testUser.id, 'Template Org');
      await seedTestProject(testDb, testUser.id, orgId, {
        name: 'Java Template Project',
        templateType: 'node+java'
      });

      await page.goto(`${webBaseUrl}/dashboard`);
      await expect(page.locator('text=Java Template Project')).toBeVisible();
    });
  });
});
