// packages/e2e/global-teardown.ts

export default async function globalTeardown() {
  // 前端服务由外部管理，无需在此清理
  console.log('E2E 测试清理完成');
}