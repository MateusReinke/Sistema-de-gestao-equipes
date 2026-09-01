import type { Config } from 'drizzle-kit';

/**
 * Configuração das migrations. `npm run db:generate` escreve o SQL em
 * `server/db/migrations`, e `npm run db:migrate` aplica no banco.
 */
export default {
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://lumini:lumini@localhost:5432/lumini',
  },
  casing: 'snake_case',
} satisfies Config;
