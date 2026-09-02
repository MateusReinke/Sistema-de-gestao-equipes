/**
 * Catálogo de integrações com sistemas externos.
 *
 * A ideia é a do *media type* do Zabbix: em vez de uma tela por sistema, há um
 * catálogo de tipos, cada um declarando quais campos precisa. O formulário é
 * gerado a partir daqui e a API valida com este mesmo módulo — acrescentar um
 * sistema novo é acrescentar uma entrada, não uma tela.
 *
 * Fica em `src/lib` porque os dois lados dependem dele. O que é segredo está
 * marcado aqui, e é essa marcação que decide o que vai cifrado para o banco e
 * o que nunca volta em claro para a tela.
 */

export type TipoIntegracao = 'zabbix' | 'glpi' | 'webhook';

export type TipoCampo = 'texto' | 'url' | 'segredo' | 'numero' | 'selecao';

export interface CampoIntegracao {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  dica?: string;
  placeholder?: string;
  padrao?: string | number;
  opcoes?: { valor: string; rotulo: string }[];
}

export interface DefinicaoIntegracao {
  tipo: TipoIntegracao;
  rotulo: string;
  descricao: string;
  /** Nome do ícone lucide; a tela resolve para o componente. */
  icone: string;
  campos: CampoIntegracao[];
  /** Só o Zabbix alimenta consultas de alerta, por ora. */
  temConsultas: boolean;
}

const TEMPO_LIMITE: CampoIntegracao = {
  chave: 'timeout',
  rotulo: 'Tempo limite (segundos)',
  tipo: 'numero',
  obrigatorio: false,
  padrao: 10,
  dica: 'Quanto esperar por resposta antes de desistir.',
};

export const CATALOGO: Record<TipoIntegracao, DefinicaoIntegracao> = {
  zabbix: {
    tipo: 'zabbix',
    rotulo: 'Zabbix',
    descricao:
      'Monitoramento de infraestrutura. Alimenta as consultas de alerta que mostram ao cliente como está o ambiente dele.',
    icone: 'Activity',
    temConsultas: true,
    campos: [
      {
        chave: 'url',
        rotulo: 'Endpoint da API',
        tipo: 'url',
        obrigatorio: true,
        placeholder: 'https://zabbix.lumini.com.br/api_jsonrpc.php',
        dica: 'A URL termina em /api_jsonrpc.php. Da versão 6.4 em diante também vale /zabbix/api_jsonrpc.php.',
      },
      {
        chave: 'token',
        rotulo: 'Token de API',
        tipo: 'segredo',
        obrigatorio: true,
        dica: 'Gerado em Users › API tokens. Prefira um usuário só de leitura: a central nunca escreve no Zabbix.',
      },
      TEMPO_LIMITE,
    ],
  },

  glpi: {
    tipo: 'glpi',
    rotulo: 'GLPI',
    descricao: 'Service desk e inventário. Abre a sessão pela API REST para consultar chamados e ativos.',
    icone: 'LifeBuoy',
    temConsultas: false,
    campos: [
      {
        chave: 'url',
        rotulo: 'URL da API',
        tipo: 'url',
        obrigatorio: true,
        placeholder: 'https://glpi.lumini.com.br/apirest.php',
        dica: 'Termina em /apirest.php. A API REST precisa estar habilitada em Configurar › Geral › API.',
      },
      {
        chave: 'app_token',
        rotulo: 'App-Token',
        tipo: 'segredo',
        obrigatorio: true,
        dica: 'Token do cliente de API, cadastrado em Configurar › Geral › API.',
      },
      {
        chave: 'user_token',
        rotulo: 'User-Token',
        tipo: 'segredo',
        obrigatorio: true,
        dica: 'Token pessoal do usuário de serviço, na aba Configurações do perfil dele.',
      },
      TEMPO_LIMITE,
    ],
  },

  webhook: {
    tipo: 'webhook',
    rotulo: 'Webhook',
    descricao:
      'Envia um POST em JSON para um endereço qualquer — canal do Teams, fluxo do n8n, automação própria.',
    icone: 'Webhook',
    temConsultas: false,
    campos: [
      {
        chave: 'url',
        rotulo: 'Endereço de destino',
        tipo: 'url',
        obrigatorio: true,
        placeholder: 'https://exemplo.webhook.office.com/webhookb2/…',
      },
      {
        chave: 'cabecalho_autorizacao',
        rotulo: 'Cabeçalho Authorization',
        tipo: 'segredo',
        obrigatorio: false,
        dica: 'Opcional. Vai como está, então inclua o esquema: "Bearer abc123".',
      },
      TEMPO_LIMITE,
    ],
  },
};

export const TIPOS: TipoIntegracao[] = ['zabbix', 'glpi', 'webhook'];

export function definicao(tipo: TipoIntegracao): DefinicaoIntegracao {
  const d = CATALOGO[tipo];
  if (!d) throw new Error(`Tipo de integração desconhecido: ${tipo}`);
  return d;
}

/** Chaves que vão cifradas para o banco e nunca voltam em claro. */
export function chavesSecretas(tipo: TipoIntegracao): string[] {
  return definicao(tipo)
    .campos.filter((c) => c.tipo === 'segredo')
    .map((c) => c.chave);
}

/* --------------------------------------------------------------- validação */

export type ValoresIntegracao = Record<string, string | number | undefined>;

/**
 * Confere os campos do tipo. Devolve mensagens por chave — a tela mostra
 * embaixo do campo, a API recusa a gravação com a mesma lista.
 *
 * `segredosJaSalvos` são as chaves de segredo que já estão no banco: um campo
 * de senha em branco significa "mantém o que está lá", não "apaga".
 */
export function validarIntegracao(
  tipo: TipoIntegracao,
  valores: ValoresIntegracao,
  segredosJaSalvos: string[] = [],
): Record<string, string> {
  const erros: Record<string, string> = {};

  for (const campo of definicao(tipo).campos) {
    const bruto = valores[campo.chave];
    const valor = typeof bruto === 'string' ? bruto.trim() : bruto;
    const vazio = valor === undefined || valor === '' || valor === null;

    if (vazio) {
      const jaTem = campo.tipo === 'segredo' && segredosJaSalvos.includes(campo.chave);
      if (campo.obrigatorio && !jaTem) erros[campo.chave] = 'Campo obrigatório.';
      continue;
    }

    if (campo.tipo === 'url') {
      const erro = erroDeUrl(String(valor));
      if (erro) erros[campo.chave] = erro;
    }

    if (campo.tipo === 'numero') {
      const n = Number(valor);
      if (!Number.isFinite(n) || n <= 0) erros[campo.chave] = 'Informe um número maior que zero.';
      else if (n > 120) erros[campo.chave] = 'No máximo 120 segundos.';
    }

    if (campo.tipo === 'selecao' && campo.opcoes) {
      const valida = campo.opcoes.some((o) => o.valor === String(valor));
      if (!valida) erros[campo.chave] = 'Escolha uma das opções.';
    }
  }

  return erros;
}

/**
 * URL de destino de integração.
 *
 * Exige http/https explicitamente: sem isso um `file://` ou um `gopher://`
 * digitado por engano viraria uma requisição que não é a esperada.
 */
export function erroDeUrl(valor: string): string | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return 'Endereço inválido. Inclua http:// ou https://.';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Só http e https são aceitos.';
  }
  if (url.protocol === 'http:' && !ehLocal(url.hostname)) {
    return 'Use https: em http o token trafega em claro pela rede.';
  }
  return null;
}

/** Endereços de laboratório, onde http é aceitável. */
function ehLocal(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  );
}

/* ------------------------------------------------------- alertas do Zabbix */

/**
 * Severidades do Zabbix, com os números que a API usa.
 *
 * A ordem importa: a consulta filtra por "severidade mínima", então o índice é
 * o próprio valor.
 */
export const SEVERIDADES = [
  { valor: 0, rotulo: 'Não classificada', cor: 'muted' },
  { valor: 1, rotulo: 'Informação', cor: 'info' },
  { valor: 2, rotulo: 'Atenção', cor: 'info' },
  { valor: 3, rotulo: 'Média', cor: 'warning' },
  { valor: 4, rotulo: 'Alta', cor: 'destructive' },
  { valor: 5, rotulo: 'Desastre', cor: 'destructive' },
] as const;

export type Severidade = (typeof SEVERIDADES)[number]['valor'];

export function rotuloSeveridade(valor: number): string {
  return SEVERIDADES.find((s) => s.valor === valor)?.rotulo ?? `Severidade ${valor}`;
}

export interface FiltroAlerta {
  /** Severidade mínima; 0 traz tudo. */
  severidade_minima: number;
  /** IDs de grupos de host do Zabbix. Vazio significa todos. */
  grupos: string[];
  /** Tags no formato tag:valor; casam por igualdade. */
  tags: { tag: string; valor: string }[];
  /** Esconde o que a equipe já reconheceu. */
  somente_nao_reconhecidos: boolean;
  /** Esconde problemas em manutenção programada. */
  ocultar_suprimidos: boolean;
  /** Teto de linhas devolvidas. */
  limite: number;
}

export const FILTRO_PADRAO: FiltroAlerta = {
  severidade_minima: 3,
  grupos: [],
  tags: [],
  somente_nao_reconhecidos: false,
  ocultar_suprimidos: true,
  limite: 50,
};

/** Normaliza o que veio da tela ou do banco para um filtro completo. */
export function normalizarFiltro(bruto: unknown): FiltroAlerta {
  const f = (bruto ?? {}) as Partial<FiltroAlerta>;

  const severidade = Number(f.severidade_minima);
  const limite = Number(f.limite);

  return {
    severidade_minima:
      Number.isFinite(severidade) && severidade >= 0 && severidade <= 5
        ? Math.trunc(severidade)
        : FILTRO_PADRAO.severidade_minima,
    grupos: Array.isArray(f.grupos) ? f.grupos.map(String).filter(Boolean) : [],
    tags: Array.isArray(f.tags)
      ? f.tags
          .map((t) => ({ tag: String(t?.tag ?? '').trim(), valor: String(t?.valor ?? '').trim() }))
          .filter((t) => t.tag.length > 0)
      : [],
    somente_nao_reconhecidos: f.somente_nao_reconhecidos === true,
    // Suprimir manutenção é o padrão: alerta de janela programada não é notícia.
    ocultar_suprimidos: f.ocultar_suprimidos !== false,
    limite:
      Number.isFinite(limite) && limite > 0 ? Math.min(Math.trunc(limite), 500) : FILTRO_PADRAO.limite,
  };
}

/** Descrição em uma linha, para a lista de consultas. */
export function resumirFiltro(filtro: FiltroAlerta, nomesDeGrupo?: Map<string, string>): string {
  const partes = [`${rotuloSeveridade(filtro.severidade_minima)} ou acima`];

  if (filtro.grupos.length > 0) {
    const nomes = filtro.grupos.map((id) => nomesDeGrupo?.get(id) ?? id);
    partes.push(nomes.length <= 2 ? nomes.join(' e ') : `${nomes.length} grupos`);
  }
  if (filtro.tags.length > 0) {
    partes.push(filtro.tags.map((t) => (t.valor ? `${t.tag}:${t.valor}` : t.tag)).join(', '));
  }
  if (filtro.somente_nao_reconhecidos) partes.push('não reconhecidos');

  return partes.join(' · ');
}
