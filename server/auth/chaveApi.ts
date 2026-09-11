/**
 * Chaves de API para automação externa (n8n e afins).
 *
 * Diferente da sessão de usuário — cookie opaco, curta, pensada para
 * navegador — uma chave de API é de longa duração e chamada por outro
 * serviço, sem interação humana. Por design ela só abre as rotas de leitura
 * em `/api/n8n/*`: automação de terceiro não grava dado de RH, e vazar uma
 * chave não dá a quem a pegou o poder de alterar nada.
 *
 * O token só existe em claro no momento em que é gerado — quem cria anota e
 * guarda; o banco recebe apenas o hash. SHA-256 basta aqui porque o token já
 * nasce com 256 bits de entropia (`randomBytes`), diferente de senha de
 * gente: não há o que uma KDF lenta como o scrypt ganhe cifrando algo que já
 * não é adivinhável por força bruta.
 */
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';

const PREFIXO_CHAVE = 'lumini_n8n_';

const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

/** Gera um token novo. Devolve também o hash, para gravar, e um prefixo, para listar sem expor o token inteiro. */
export function gerarChaveApi(): { chave: string; hash: string; prefixo: string } {
  const chave = `${PREFIXO_CHAVE}${randomBytes(32).toString('base64url')}`;
  return { chave, hash: sha256(chave), prefixo: chave.slice(0, PREFIXO_CHAVE.length + 6) };
}

export class ChaveApiInvalida extends Error {
  constructor(mensagem = 'Chave de API ausente, inválida, revogada ou expirada.') {
    super(mensagem);
  }
}

export class LimiteDeUsoExcedido extends Error {
  constructor() {
    super('Limite de requisições desta chave de API excedido. Aguarde um minuto e tente de novo.');
  }
}

/** Aceita `X-API-Key: <token>` (mais simples de configurar no n8n) ou `Authorization: Bearer <token>`. */
function extrairChave(req: FastifyRequest): string | null {
  const viaCabecalhoDedicado = req.headers['x-api-key'];
  if (typeof viaCabecalhoDedicado === 'string' && viaCabecalhoDedicado.trim()) {
    return viaCabecalhoDedicado.trim();
  }

  const autorizacao = req.headers.authorization;
  if (typeof autorizacao === 'string' && autorizacao.startsWith('Bearer ')) {
    return autorizacao.slice('Bearer '.length).trim();
  }

  return null;
}

/* -------------------------------------------------------------- limite de uso */

/**
 * Limite simples em memória: no máximo `LIMITE_POR_JANELA` requisições por
 * minuto, por chave.
 *
 * Um único processo atende a aplicação (mesma premissa do cache de
 * configuração em `auth/configuracao.ts`), então isto basta para conter uma
 * chave vazada ou um fluxo de n8n preso em loop — não sobrevive a múltiplas
 * réplicas, e não precisa: se um dia houver mais de um processo, isto migra
 * para o mesmo Postgres que já guarda a chave.
 */
const JANELA_MS = 60_000;
const LIMITE_POR_JANELA = 120;
const usosPorChave = new Map<string, number[]>();

function dentroDoLimite(chaveId: string): boolean {
  const agora = Date.now();
  const usos = (usosPorChave.get(chaveId) ?? []).filter((quando) => agora - quando < JANELA_MS);
  usos.push(agora);
  usosPorChave.set(chaveId, usos);
  return usos.length <= LIMITE_POR_JANELA;
}

/* ------------------------------------------------------------------------ uso */

export interface SessaoApi {
  id: string;
  nome: string;
}

/** Resolve a chave de API do cabeçalho da requisição, ou interrompe com erro. */
export async function exigirChaveApi(req: FastifyRequest): Promise<SessaoApi> {
  const bruta = extrairChave(req);
  if (!bruta) throw new ChaveApiInvalida();

  const [linha] = await db
    .select()
    .from(t.chavesApi)
    .where(eq(t.chavesApi.chave_hash, sha256(bruta)))
    .limit(1);

  if (!linha || !linha.ativo) throw new ChaveApiInvalida();
  if (linha.expira_em && linha.expira_em < new Date().toISOString()) {
    throw new ChaveApiInvalida('Chave de API expirada.');
  }
  if (!dentroDoLimite(linha.id)) throw new LimiteDeUsoExcedido();

  // Melhor esforço: registra o uso sem atrasar nem derrubar a resposta.
  void (async () => {
    try {
      await db
        .update(t.chavesApi)
        .set({ ultimo_uso_em: new Date().toISOString() })
        .where(eq(t.chavesApi.id, linha.id));
    } catch {
      /* não é crítico — só alimenta a listagem administrativa */
    }
  })();

  return { id: linha.id, nome: linha.nome };
}
