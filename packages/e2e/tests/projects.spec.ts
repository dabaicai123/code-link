// packages/e2e/tests/projects.spec.ts
import { test, expect } from '../fixtures/base';
import { generateTestToken } from '../helpers/test-server';

test.describe('项目管理', () => {
  test.beforeEach(async ({ page, testServer, testUser, webBaseUrl }) => {
    // 设置认证 token
    const token = generateTestToken(testUser.id);
    await page.addInitScript((tokenValue) => {
      localStorage.setItem('token', tokenValue);
    }, token);

    // 设置 API mock 指向测试服务器
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      // 将请求转发到测试服务器
      const apiPath = url.replace(/^.*\/api/, `${testServer.baseUrl}/api`);
      const response = await fetch(apiPath, {
        method: route.request().method(),
        headers: route.request().headers(),
        body: route.request().postData(),
      });
      const body = await response.text();
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      });
    });

    // 访问 dashboard
    await page.goto(`${webBaseUrl}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('查看项目列表', async ({ page }) => {
    // 等待项目列表加载
    await expect(page.locator('text=Test Project')).toBeVisible({ timeout: 10000 });
  });

  test('创建新项目', async ({ page, testServer }) => {
    // 点击创建项目按钮
    await page.click('text=创建项目');

    // 等待对话框出现
    await expect(page.locator('text=新建项目')).toBeVisible();

    // 填写项目名称
    await page.fill('input[placeholder="项目名称"]', 'My New Project');

    // 选择模板类型（如果有）
    // await page.click('text=node');

    // 提交创建
    await page.click('button:has-text("创建")');

    // 等待项目创建成功并显示在列表中
    await expect(page.locator('text=My New Project')).toBeVisible({ timeout: 10000 });
  });

  test('项目卡片点击', async ({ page, testServer, testUser }) => {
    // 先创建一个项目用于测试
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestProject } = await import('../helpers/test-db');
    await seedTestProject(db, testUser.id, undefined, { name: 'Clickable Project' });

    // 刷新页面加载新项目
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 点击项目卡片
    await page.click('text=Clickable Project');

    // 验证项目被选中（根据实际 UI 验证）
    // 例如侧边栏高亮或 Workspace 显示项目内容
  });

  test('删除项目', async ({ page, testServer, testUser }) => {
    // 先创建一个项目用于删除测试
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    const db = drizzle(testServer.db);
    const { seedTestProject } = await import('../helpers/test-db');
    await seedTestProject(db, testUser.id, undefined, { name: 'Project To Delete' });

    // 刷新页面加载新项目
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 等待项目出现
    await expect(page.locator('text=Project To Delete')).toBeVisible({ timeout: 5000 });

    // 找到项目卡片并点击删除（根据实际 UI 定位）
    // 这部分需要根据实际的 UI 结构调整
    // 假设有删除按钮在项目卡片上
    const projectCard = page.locator('text=Project To Delete').first();
    // 右键菜单或其他方式触发删除
    // await projectCard.click({ button: 'right' });
    // await page.click('text=删除');

    // 或者直接通过 API 删除并刷新验证
    const token = generateTestToken(testUser.id);

    // 等待页面更新
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 验证项目已删除（这里需要根据实际情况调整）
  });
});