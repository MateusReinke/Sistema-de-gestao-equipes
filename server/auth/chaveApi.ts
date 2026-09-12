/**
 * Chaves de API para automação externa (n8n e afins).
 *
 * Diferente da sessão de usuário — cookie opaco, curta, pensada para
 * navegador — uma chave de API é de longa duração e chamada por outro
 * serviço, sem interação humana.
 *
 * **O token não tem permissão própria: ele herda a de quem o criou.** A
 * requisição autenticada por chave monta exatamente a mesma sessão que o dono
 * teria no navegador, e daí em diante passa pelas mesmas regras de papel e de
 * equipe que o resto da aplicação — um token de colaborador enxerga o que o
 * colaborador enxerga, um token de admin enxerga tudo. O escopo só **reduz**
 * isso: `leitura` recusa qualquer método de escrita, mesmo sendo de admin.
 *
 * O que nenhum token faz, de qualquer papel, é mexer em credencial — login,
 * senha, SSO e os próprios tokens exigem sessão de navegador (ver
 * `exigirSessaoHumana` em `rotas/auth.ts`). Sem essa fronteira, um token
 * vazado viraria acesso permanente: bastaria criar outro token, ou trocar uma
 * senha, para a revogação não adiantar mais nada.
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

const PREFIXO_CHAVE = 'lumini_';

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
  /** Dono do token; ausente nas chaves antigas, criadas por linha de comando. */
  usuario_id: string | null;
  escopo: 'leitura' | 'escrita';
}

/**
 * Resolve a chave de API do cabeçalho, ou `null` quando não veio nenhuma.
 *
 * Devolver `null` em vez de lançar é o que permite uma rota aceitar cookie
 * **ou** token: sem cabeçalho, ainda há a sessão de navegador para tentar.
 */
export async function lerChaveApi(req: FastifyRequest): Promise<SessaoApi | null> {
  const bruta = extrairChave(req);
  if (!bruta) return null;

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

  return {
    id: linha.id,
    nome: linha.nome,
    usuario_id: linha.usuario_id,
    escopo: linha.escopo,
  };
}

/** Exige a chave — usado pelas rotas de automação, que não aceitam cookie. */
export async function exigirChaveApi(req: FastifyRequest): Promise<SessaoApi> {
  const chave = await lerChaveApi(req);
  if (!chave) throw new ChaveApiInvalida();
  return chave;
}

/** Métodos que alteram dado — só um token com escopo de escrita os alcança. */
const METODOS_DE_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class EscopoInsuficiente extends Error {
  constructor() {
    super('Este token é somente leitura. Gere um token com escopo de escrita para esta operação.');
  }
}

/** Recusa escrita quando o token que autenticou a requisição é só de leitura. */
export function exigirEscopoParaMetodo(chave: SessaoApi, metodo: string): void {
  if (chave.escopo === 'leitura' && METODOS_DE_ESCRITA.has(metodo.toUpperCase())) {
    throw new EscopoInsuficiente();
  }
}
