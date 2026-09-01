/**
 * Cliente da API do Zabbix.
 *
 * A API é JSON-RPC 2.0 num único endpoint: o método vai no corpo. Usamos
 * apenas leitura — `apiinfo.version` para testar, `hostgroup.get` para montar
 * o seletor de grupos e `problem.get` para os alertas.
 *
 * Um detalhe que não é óbvio: o Zabbix devolve HTTP 200 mesmo em erro, com o
 * problema dentro de `result.error`. Tratar só o status deixaria passar
 * "token inválido" como sucesso.
 */
import { normalizarFiltro, type FiltroAlerta } from '@/lib/integracoes';
import { buscarJson, ErroIntegracao } from './http';

interface RespostaRpc<T> {
  jsonrpc: string;
  result?: T;
  error?: { code: number; message: string; data?: string };
  id: number;
}

export interface Conexao {
  url: string;
  token: string;
  timeoutSegundos?: number;
}

/**
 * Chama um método da API.
 *
 * `apiinfo.version` é o único que não aceita autenticação — mandar o token
 * nele devolve erro, então ele fica de fora do cabeçalho.
 */
async function chamar<T>(
  conexao: Conexao,
  metodo: string,
  parametros: Record<string, unknown> = {},
): Promise<T> {
  const autenticado = metodo !== 'apiinfo.version';

  const corpo = await buscarJson<RespostaRpc<T>>(conexao.url, {
    metodo: 'POST',
    timeoutSegundos: conexao.timeoutSegundos,
    cabecalhos: {
      'content-type': 'application/json-rpc',
      ...(autenticado ? { authorization: `Bearer ${conexao.token}` } : {}),
    },
    corpo: { jsonrpc: '2.0', method: metodo, params: parametros, id: 1 },
  });

  if (corpo.error) {
    // `data` costuma trazer a explicação útil; `message` é genérico.
    const detalhe = [corpo.error.message, corpo.error.data].filter(Boolean).join(' ');
    throw new ErroIntegracao(traduzir(detalhe), { causa: detalhe });
  }
  if (corpo.result === undefined) {
    throw new ErroIntegracao('O Zabbix respondeu sem resultado. Confira se a URL é a da API.');
  }
  return corpo.result;
}

/** Mensagens do Zabbix que valem traduzir para quem está configurando. */
function traduzir(detalhe: string): string {
  const texto = detalhe.toLowerCase();
  if (texto.includes('not authorized') || texto.includes('re-login')) {
    return 'Token recusado pelo Zabbix. Confira se ele é válido e não expirou.';
  }
  if (texto.includes('permission') || texto.includes('access denied')) {
    return 'O usuário do token não tem permissão para esta consulta.';
  }
  return `O Zabbix recusou a chamada: ${detalhe}`;
}

export interface ResultadoTeste {
  ok: boolean;
  detalhe: string;
}

/** Confere endereço e token com o mínimo de privilégio necessário. */
export async function testar(conexao: Conexao): Promise<ResultadoTeste> {
  try {
    const versao = await chamar<string>(conexao, 'apiinfo.version');

    // `apiinfo.version` responde sem autenticação, então sozinho ele prova só
    // que a URL é de um Zabbix. Uma chamada barata e autenticada é o que
    // confirma o token.
    const grupos = await chamar<unknown[]>(conexao, 'hostgroup.get', {
      output: ['groupid'],
      limit: 1,
    });

    return {
      ok: true,
      detalhe: `Zabbix ${versao}, token aceito (${grupos.length > 0 ? 'grupos visíveis' : 'nenhum grupo visível para este usuário'}).`,
    };
  } catch (erro) {
    return {
      ok: false,
      detalhe: erro instanceof ErroIntegracao ? erro.message : 'Falha inesperada ao falar com o Zabbix.',
    };
  }
}

export interface GrupoHost {
  id: string;
  nome: string;
}

export async function listarGrupos(conexao: Conexao): Promise<GrupoHost[]> {
  const grupos = await chamar<{ groupid: string; name: string }[]>(conexao, 'hostgroup.get', {
    output: ['groupid', 'name'],
    sortfield: 'name',
    // Instalações grandes têm centenas de grupos; o seletor não precisa de mais.
    limit: 500,
  });

  return grupos.map((g) => ({ id: g.groupid, nome: g.name }));
}

export interface Alerta {
  id: string;
  nome: string;
  severidade: number;
  desde: string;
  reconhecido: boolean;
  host: string;
  tags: { tag: string; valor: string }[];
}

interface ProblemaZabbix {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  acknowledged: string;
  suppressed?: string;
  hosts?: { name: string }[];
  tags?: { tag: string; value: string }[];
}

/**
 * Monta os parâmetros de `problem.get` a partir do filtro salvo.
 *
 * Separado da chamada para poder ser testado sem rede — é aqui que mora a
 * tradução entre o vocabulário da tela e o da API.
 */
export function parametrosDaConsulta(filtro: FiltroAlerta): Record<string, unknown> {
  const f = normalizarFiltro(filtro);

  const parametros: Record<string, unknown> = {
    output: ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
    selectHosts: ['name'],
    selectTags: 'extend',
    // Só problemas em aberto: `recent: false` exclui os já resolvidos.
    recent: false,
    sortfield: ['eventid'],
    sortorder: 'DESC',
    limit: f.limite,
  };

  // O Zabbix espera a lista das severidades desejadas, não um piso.
  if (f.severidade_minima > 0) {
    parametros.severities = [0, 1, 2, 3, 4, 5].filter((s) => s >= f.severidade_minima);
  }
  if (f.grupos.length > 0) parametros.groupids = f.grupos;
  if (f.somente_nao_reconhecidos) parametros.acknowledged = false;
  if (f.ocultar_suprimidos) parametros.suppressed = false;

  if (f.tags.length > 0) {
    parametros.tags = f.tags.map((t) =>
      // Sem valor, a intenção é "tem esta tag"; com valor, é igualdade.
      t.valor ? { tag: t.tag, value: t.valor, operator: 1 } : { tag: t.tag, operator: 2 },
    );
    parametros.evaltype = 0; // E lógico entre as tags
  }

  return parametros;
}

export async function buscarAlertas(conexao: Conexao, filtro: FiltroAlerta): Promise<Alerta[]> {
  const problemas = await chamar<ProblemaZabbix[]>(
    conexao,
    'problem.get',
    parametrosDaConsulta(filtro),
  );

  return problemas.map((p) => ({
    id: p.eventid,
    nome: p.name,
    severidade: Number(p.severity),
    // `clock` é epoch em segundos; o domínio trabalha com ISO.
    desde: new Date(Number(p.clock) * 1000).toISOString(),
    reconhecido: p.acknowledged === '1',
    host: p.hosts?.[0]?.name ?? '—',
    tags: (p.tags ?? []).map((t) => ({ tag: t.tag, valor: t.value })),
  }));
}
