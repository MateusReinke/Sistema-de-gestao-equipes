import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

/**
 * Conexão única com o Postgres.
 *
 * `max: 10` porque a aplicação é interna, com dezenas de usuários simultâneos
 * no pico; passar disso só consumiria conexão do servidor sem ganho.
 */
export const sql = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  // Datas `date` vêm como string YYYY-MM-DD, que é o formato do domínio.
  types: {
    date: {
      to: 1082,
      from: [1082],
      serialize: (v: string) => v,
      parse: (v: string) => v,
    },
  },
});

export const db = drizzle(sql, { schema });

export { schema };
