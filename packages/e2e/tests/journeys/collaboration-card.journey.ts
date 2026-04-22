// packages/e2e/tests/journeys/collaboration-card.journey.ts
import path from 'path';
import { test, expect, generateToken } from '../support/fixtures';
import { createUserParams, createOrganizationParams, createProjectParams } from '../support/factories';
import { createCardViaFS, setTranscriptsDir } from '../support/card-helpers';

// The e2e server starts from packages/server, so its cwd-based transcripts dir is
// packages/server/transcripts. We must write card files there so the server can
// discover them when the frontend fetches via API.
// Playwright runs from packages/e2e, so the server transcripts dir is ../server/transcripts
// relative to cwd.
const SERVER_TRANSCRIPTS_DIR = path.join(process.cwd(), '..', 'server', 'transcripts');
setTranscriptsDir(SERVER_TRANSCRIPTS_DIR);

test.describe('协作卡片', () => {
  let user: { id: number; email: string; name: string };
  let org: { id: number; name: string };
  let project: { id: number; name: string; organizationId: number };
  let draft: { id: number; projectId: number; title: string };

  test.beforeEach(async ({ app, api }) => {
    user = await app.register(createUserParams());
    api.setToken(generateToken(user.id));

    org = await app.createOrganization(createOrganizationParams());
    project = await app.createProject(createProjectParams({ organizationId: org.id }));
    api.setToken(generateToken(user.id));

    draft = await api.createDraft({ projectId: project.id, title: `协作测试 ${Math.random().toString(36).slice(2, 6)}` });
  });

  // Helper: navigate to the draft timeline view
  async function navigateToTimeline(app: any) {
    await app.selectProject(project.name);
    await app.selectDraft(draft.title);
  }

  // ==================== Test 1 ====================

  test('导航到协作卡片视图', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.assertCardVisible(shortId);
  });

  // ==================== Test 2 ====================

  test('卡片显示标题和摘要', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    const cardEl = app.page.getByTestId(`timeline-card-${shortId}`);
    await expect(cardEl).toContainText('头脑风暴 - 登录功能');
    await expect(cardEl).toContainText('讨论登录功能的实现方案');
  });

  // ==================== Test 3 ====================

  test('点击卡片展开详情弹窗', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await expect(modal).toContainText('头脑风暴 - 登录功能');
  });

  // ==================== Test 4 ====================

  test('关闭详情弹窗', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    // Click the X (close) button in the modal header
    const modal = app.page.getByTestId('card-detail-modal');
    await modal.locator('button').filter({ has: app.page.locator('svg') }).first().click();
    await app.assertCardDetailModalNotVisible();
  });

  // ==================== Test 5 ====================

  test('右键卡片显示引用菜单', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.rightClickCard(shortId);
    await app.assertContextMenuVisible();

    const contextMenu = app.page.getByTestId('card-context-menu');
    await expect(contextMenu).toContainText('引用此卡片');
  });

  // ==================== Test 6 ====================

  test('引用卡片填充输入框', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.rightClickCard(shortId);
    await app.assertContextMenuVisible();
    await app.clickContextMenuItem('引用此卡片');

    // Context menu closes after clicking
    await expect(app.page.getByTestId('card-context-menu')).not.toBeVisible();

    // MessageInput textarea should contain @卡片{shortId}
    const textarea = app.page.getByTestId('collab-message-input');
    await expect(textarea).toHaveValue(/@卡片[a-f0-9]{8}/);
  });

  // ==================== Test 7 ====================

  test('卡片类型特定按钮（头脑风暴 -> 执行计划）', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'brainstorming',
      cardStatus: 'completed',
      title: '头脑风暴 - 登录功能',
      summary: '讨论登录功能的实现方案',
      result: '建议使用 JWT + OAuth2 方案',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await expect(modal.getByRole('button', { name: '执行计划' })).toBeVisible();
  });

  // ==================== Test 8 ====================

  test('卡片类型特定按钮（计划 -> 开始编码）', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'writing_plans',
      cardStatus: 'completed',
      title: '编写计划 - 登录模块',
      summary: '制定登录模块的开发计划',
      result: '计划: 使用 JWT + OAuth2',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await expect(modal.getByRole('button', { name: '开始编码' })).toBeVisible();
  });

  // ==================== Test 9 ====================

  test('卡片类型特定按钮（自由对话 -> 引用迭代）', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'free_chat',
      cardStatus: 'completed',
      title: '自由对话 - 接口设计',
      summary: '讨论接口设计方案',
      result: '决定采用 RESTful API',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await expect(modal.getByRole('button', { name: '引用迭代' })).toBeVisible();
  });

  // ==================== Test 10 ====================

  test('暂停开发卡片显示继续执行和放弃', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'development',
      cardStatus: 'paused',
      title: '开发 - 登录接口',
      summary: '正在开发登录接口',
      result: '已完成 40%',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await expect(modal.getByRole('button', { name: '继续执行' })).toBeVisible();
    await expect(modal.getByRole('button', { name: '放弃' })).toBeVisible();
  });

  // ==================== Test 11 ====================

  test('点击放弃按钮关闭弹窗', async ({ app, api }) => {
    const { shortId } = await createCardViaFS({
      projectId: project.id,
      draftId: draft.id,
      cardType: 'development',
      cardStatus: 'paused',
      title: '开发 - 登录接口',
      summary: '正在开发登录接口',
      result: '已完成 40%',
      userId: user.id,
      userName: user.name,
    });

    await navigateToTimeline(app);
    await app.clickCard(shortId);
    await app.assertCardDetailModalVisible();

    const modal = app.page.getByTestId('card-detail-modal');
    await modal.getByRole('button', { name: '放弃' }).click();
    await app.assertCardDetailModalNotVisible();
  });
});