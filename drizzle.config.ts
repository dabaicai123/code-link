import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/server/src/db/schema/index.ts',
  out: './packages/server/src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/code-link.db',
  },
});