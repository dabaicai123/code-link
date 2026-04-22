// packages/e2e/global-teardown.ts
const BACKEND_URL = 'http://localhost:4000';

export default async function globalTeardown() {
  // Cleanup all test containers (named with test_ prefix)
  try {
    await fetch(`${BACKEND_URL}/api/test/cleanup-containers`, { method: 'POST' });
    console.log('Test containers cleaned up');
  } catch (err) {
    console.warn('Container cleanup failed:', (err as Error).message);
  }

  // Reset the database to clear test data
  try {
    await fetch(`${BACKEND_URL}/api/test/reset`, { method: 'POST' });
    console.log('Test database reset');
  } catch (err) {
    console.warn('Database reset failed:', (err as Error).message);
  }

  console.log('E2E 测试清理完成');
}