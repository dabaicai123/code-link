// packages/e2e/global-teardown.ts
import { cleanupGlobalResources } from './tests/support/fixtures';

export default async function globalTeardown() {
  await cleanupGlobalResources();
  console.log('E2E 测试清理完成');
}
