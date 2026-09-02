/**
 * Ponte entre a linha de `integracoes` no banco e o cliente de cada sistema.
 *
 * Aqui os segredos são decifrados e entregues ao cliente certo. É o único
 * lugar do servidor que os vê em claro — as rotas trabalham só com a linha
 * cifrada e com o resultado.
 */
import { chavesSecretas, type TipoIntegracao } from '@/lib/integracoes';
import { cifrar, decifrar, SegredoIlegivel } from '../auth/segredos';
import { buscarJson, ErroIntegracao } from './http';
import * as zabbix from './zabbix';
import * as glpi from './glpi';

export { ErroIntegracao } from './http';
export type { Alerta, GrupoHost } from './zabbix';

/** A linha do banco, no que interessa para falar com o sistema externo. */
export interface LinhaIntegracao {
  tipo: TipoIntegracao;
  parametros: unknown;
  segredos: string | null;
}

export interface ResultadoTeste {
  ok: boolean;
  detalhe: string;
}

type Valores = Record<string, string | number | undefined>;

const comoTexto = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

/** Junta parâmetros abertos e segredos decifrados num objeto só. */
export function abrir(linha: LinhaIntegracao): Valores {
  const parametros = (linha.parametros ?? {}) as Valores;
  if (!linha.segredos) return { ...parametros };

  const segredos = JSON.parse(decifrar(linha.segredos)) as Valores;
  return { ...parametros, ...segredos };
}

/**
 * Separa os valores em duas partes: o que vai aberto e o que vai cifrado.
 *
 * Segredo em branco significa "mantém o que já está lá" — por isso os
 * anteriores entram como base.
 */
export function fechar(
  tipo: TipoIntegracao,
  valores: Valores,
  segredosAnteriores: Valores = {},
): { parametros: Valores; segredos: string | null } {
  const chaves = chavesSecretas(tipo);

  const parametros: Valores = {};
  const segredos: Valores = { ...segredosAnteriores };

  for (const [chave, valor] of Object.entries(valores)) {
    if (!chaves.includes(chave)) {
      parametros[chave] = valor;
      continue;
    }
    const texto = comoTexto(valor).trim();
    if (texto) segredos[chave] = texto;
    // Em branco não apaga: só não sobrescreve.
  }

  const algum = Object.values(segredos).some((v) => comoTexto(v).length > 0);
  return { parametros, segredos: algum ? cifrar(JSON.stringify(segredos)) : null };
}

/** Lê só os segredos já gravados, para o `fechar` acima. */
export function segredosDe(linha: LinhaIntegracao): Valores {
  if (!linha.segredos) return {};
  return JSON.parse(decifrar(linha.segredos)) as Valores;
}

/** Quais chaves de segredo já estão gravadas — a tela mostra "já cadastrado". */
export function chavesGravadas(linha: LinhaIntegracao): string[] {
  try {
    return Object.entries(segredosDe(linha))
      .filter(([, v]) => comoTexto(v).length > 0)
      .map(([k]) => k);
  } catch {
    // Chave trocada: a tela precisa pedir os segredos de novo.
    return [];
  }
}

const tempo = (v: Valores) => {
  const n = Number(v.timeout);
  return Number.isFinite(n) && n > 0 ? n : 10;
};

function conexaoZabbix(v: Valores): zabbix.Conexao {
  return { url: comoTexto(v.url), token: comoTexto(v.token), timeoutSegundos: tempo(v) };
}

function conexaoGlpi(v: Valores): glpi.Conexao {
  return {
    url: comoTexto(v.url),
    appToken: comoTexto(v.app_token),
    userToken: comoTexto(v.user_token),
    timeoutSegundos: tempo(v),
  };
}

/** Testa a conexão do tipo certo, sem deixar exceção escapar. */
export async function testar(linha: LinhaIntegracao): Promise<ResultadoTeste> {
  let valores: Valores;
  try {
    valores = abrir(linha);
  } catch (erro) {
    if (erro instanceof SegredoIlegivel) return { ok: false, detalhe: erro.message };
    throw erro;
  }

  switch (linha.tipo) {
    case 'zabbix':
      return zabbix.testar(conexaoZabbix(valores));
    case 'glpi':
      return glpi.testar(conexaoGlpi(valores));
    case 'webhook':
      return testarWebhook(valores);
  }
}

/**
 * Testa o webhook com um payload identificado.
 *
 * Um POST de teste chega num canal real, então ele diz o que é — ninguém deve
 * abrir o Teams e encontrar uma mensagem sem explicação.
 */
async function testarWebhook(valores: Valores): Promise<ResultadoTeste> {
  const autorizacao = comoTexto(valores.cabecalho_autorizacao);

  try {
    await buscarJson(comoTexto(valores.url), {
      metodo: 'POST',
      timeoutSegundos: tempo(valores),
      cabecalhos: {
        'content-type': 'application/json',
        ...(autorizacao ? { authorization: autorizacao } : {}),
      },
      corpo: {
        origem: 'Central de Gestão de Pessoas',
        tipo: 'teste',
        texto: 'Teste de configuração do webhook. Nenhuma ação é necessária.',
        em: new Date().toISOString(),
      },
    });
    return { ok: true, detalhe: 'Mensagem de teste entregue.' };
  } catch (erro) {
    if (erro instanceof ErroIntegracao) {
      // Muito webhook responde 200 com corpo vazio ou "1"; isso não é falha.
      if (erro.message.includes('não é JSON')) {
        return { ok: true, detalhe: 'Mensagem de teste entregue (resposta sem JSON, o que é normal).' };
      }
      return { ok: false, detalhe: erro.message };
    }
    return { ok: false, detalhe: 'Falha inesperada ao chamar o webhook.' };
  }
}

/* -------------------------------------------------------- só para o Zabbix */

export function conexaoDeMonitoramento(linha: LinhaIntegracao): zabbix.Conexao {
  if (linha.tipo !== 'zabbix') {
    throw new ErroIntegracao('Esta integração não é de monitoramento.');
  }
  return conexaoZabbix(abrir(linha));
}

export const listarGrupos = zabbix.listarGrupos;
export const buscarAlertas = zabbix.buscarAlertas;
