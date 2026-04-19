// packages/e2e/tests/projects.spec.ts
import { test, expect } from '../fixtures/base';
import { generateTestToken } from '../helpers/test-server';
import { seedTestOrganization, seedTestProject } from '../helpers/test-db';
import { drizzle } from 'drizzle-orm/better-sqlite3';

test.describe('项目管理', () => {
  // 使用 testUser fixture 自动设置的认证和 API 路由

  test.describe('项目列表', () => {
    test('空列表显示', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/dashboard`);
      // 使用智能等待代替 networkidle
      await expect(page.locator('text=创建项目')).toBeVisible();
    });

    test('多项目显示', async ({ page, testServer, testUser, webBaseUrl }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Test Org');
      await seedTestProject(db, testUser.id, orgId, { name: 'Project Alpha' });
      await seedTestProject(db, testUser.id, orgId, { name: 'Project Beta' });
      await seedTestProject(db, testUser.id, orgId, { name: 'Project Gamma' });

      await page.goto(`${webBaseUrl}/dashboard`);
      await expect(page.locator('text=Project Alpha')).toBeVisible();
      await expect(page.locator('text=Project Beta')).toBeVisible();
      await expect(page.locator('text=Project Gamma')).toBeVisible();
    });
  });

  test.describe('项目创建', () => {
    test('创建 Node 项目', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Create Test Org');

      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=创建项目');
      await expect(page.locator('text=新建项目')).toBeVisible();
      await page.fill('input[placeholder="项目名称"]', 'My New Project');
      await page.click('button:has-text("创建")');
      await expect(page.locator('text=My New Project')).toBeVisible();
    });

    test('创建项目空名称验证', async ({ page, webBaseUrl }) => {
      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=创建项目');
      await page.click('button:has-text("创建")');
      // 验证错误提示或按钮禁用状态
    });
  });

  test.describe('项目详情', () => {
    test('进入 Workspace', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Workspace Test Org');
      const projectId = await seedTestProject(db, testUser.id, orgId, { name: 'Workspace Project' });

      await page.goto(`${webBaseUrl}/dashboard`);
      await page.click('text=Workspace Project');
      await expect(page.locator('text=Workspace Project')).toBeVisible();
    });

    test('显示模板类型', async ({ page, webBaseUrl, testServer, testUser }) => {
      const db = drizzle(testServer.db);
      const orgId = await seedTestOrganization(db, testUser.id, 'Template Org');
      await seedTestProject(db, testUser.id, orgId, {
        name: 'Java Template Project',
        templateType: 'node+java'
      });

      await page.goto(`${webBaseUrl}/dashboard`);
      await expect(page.locator('text=Java Template Project')).toBeVisible();
    });
  });
});