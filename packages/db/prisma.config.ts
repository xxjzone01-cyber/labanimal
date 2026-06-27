import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    async url() {
      return process.env.DATABASE_URL || 'postgresql://postgres:labanimal123@localhost:5433/labanimal';
    },
  },
});
