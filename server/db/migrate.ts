/**
 * Aplica as migrations pendentes e encerra.
 *
 * Roda no start do container, antes da API subir, para que um deploy nunca
 * atenda requisição contra um schema desatualizado.
 */
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { db, sql } from './index';

const pasta = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

try {
  await migrate(db, { migrationsFolder: pasta });
  console.log('✓ migrations aplicadas');
} catch (erro) {
  console.error('✗ falha ao aplicar migrations:', erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
