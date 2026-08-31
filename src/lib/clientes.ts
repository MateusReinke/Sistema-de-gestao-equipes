/**
 * Regras de negócio da carteira de clientes.
 *
 * Concentra o que vence, o que precisa de decisão e como anda a satisfação —
 * as telas apenas apresentam o resultado.
 */
import type {
  AvaliacaoCliente,
  Cliente,
  ContatoCliente,
  IsoDate,
  NivelEscalonamento,
} from '@/types/sgo';
import { diferencaDias, hoje, somarDias } from '@/lib/date';

/** Antecedência com que um contrato entra no radar mesmo sem aviso prévio. */
export const DIAS_ALERTA_RENOVACAO = 90;

export interface SituacaoContrato {
  /** Dias até o fim da vigência — negativo quando já venceu. */
  diasParaVencer: number;
  vencido: boolean;
  /** Entrou na janela dos 90 dias que antecedem a renovação. */
  aRenovar: boolean;
  /**
   * Data-limite para comunicar não-renovação, conforme o aviso prévio
   * contratado.
   */
  limiteAviso: IsoDate;
  /**
   * O prazo de aviso passou. Em contrato com renovação automática, isso
   * significa que ele já renovou por omissão.
   */
  avisoVencido: boolean;
  /** Precisa de decisão do gerente de conta agora. */
  precisaDecisao: boolean;
}

export function situacaoContrato(
  cliente: Cliente,
  referencia: IsoDate = hoje(),
): SituacaoContrato {
  const diasParaVencer = diferencaDias(referencia, cliente.contrato_fim);
  const limiteAviso = somarDias(cliente.contrato_fim, -cliente.aviso_previa_dias);
  const avisoVencido = referencia > limiteAviso;
  const vencido = diasParaVencer < 0;
  const aRenovar = !vencido && diasParaVencer <= DIAS_ALERTA_RENOVACAO;

  // Contrato encerrado não cobra mais decisão de ninguém.
  const encerrado = cliente.status_contrato === 'encerrado';

  return {
    diasParaVencer,
    vencido,
    aRenovar,
    limiteAviso,
    avisoVencido,
    precisaDecisao: !encerrado && (vencido || aRenovar),
  };
}

/** Contratos que exigem ação, do mais urgente para o mais distante. */
export function contratosParaRenovar(
  clientes: Cliente[],
  referencia: IsoDate = hoje(),
): { cliente: Cliente; situacao: SituacaoContrato }[] {
  return clientes
    .map((cliente) => ({ cliente, situacao: situacaoContrato(cliente, referencia) }))
    .filter((r) => r.situacao.precisaDecisao)
    .sort((a, b) => a.situacao.diasParaVencer - b.situacao.diasParaVencer);
}

/* ------------------------------------------------------------- satisfação */

export type ClasseNps = 'detrator' | 'neutro' | 'promotor';

/** Faixas padrão do NPS. */
export function classificarNps(nota: number): ClasseNps {
  if (nota >= 9) return 'promotor';
  if (nota >= 7) return 'neutro';
  return 'detrator';
}

export interface SaudeCliente {
  /** Nota mais recente, ou `undefined` se a conta nunca foi avaliada. */
  ultimaNota?: number;
  ultimaData?: IsoDate;
  classe?: ClasseNps;
  media?: number;
  /** Variação em relação à avaliação anterior. */
  variacao?: number;
  totalAvaliacoes: number;
  /** Passou de 180 dias sem medição — a conta está sem leitura. */
  semLeituraRecente: boolean;
}

export function saudeCliente(
  avaliacoes: AvaliacaoCliente[],
  clienteId: string,
  referencia: IsoDate = hoje(),
): SaudeCliente {
  const daConta = avaliacoes
    .filter((a) => a.cliente_id === clienteId)
    .sort((a, b) => b.data.localeCompare(a.data));

  if (daConta.length === 0) {
    return { totalAvaliacoes: 0, semLeituraRecente: true };
  }

  const [ultima, penultima] = daConta;
  const media = daConta.reduce((soma, a) => soma + a.nota, 0) / daConta.length;

  return {
    ultimaNota: ultima.nota,
    ultimaData: ultima.data,
    classe: classificarNps(ultima.nota),
    media: Math.round(media * 10) / 10,
    variacao: penultima ? ultima.nota - penultima.nota : undefined,
    totalAvaliacoes: daConta.length,
    semLeituraRecente: diferencaDias(ultima.data, referencia) > 180,
  };
}

/**
 * NPS da carteira: % de promotores menos % de detratores, considerando a
 * avaliação mais recente de cada cliente.
 */
export function npsDaCarteira(
  avaliacoes: AvaliacaoCliente[],
  clientes: Cliente[],
  referencia: IsoDate = hoje(),
): { nps: number; promotores: number; neutros: number; detratores: number; avaliados: number } {
  const notas = clientes
    .map((c) => saudeCliente(avaliacoes, c.id, referencia).ultimaNota)
    .filter((n): n is number => n !== undefined);

  const promotores = notas.filter((n) => classificarNps(n) === 'promotor').length;
  const neutros = notas.filter((n) => classificarNps(n) === 'neutro').length;
  const detratores = notas.filter((n) => classificarNps(n) === 'detrator').length;

  return {
    nps: notas.length > 0 ? Math.round(((promotores - detratores) / notas.length) * 100) : 0,
    promotores,
    neutros,
    detratores,
    avaliados: notas.length,
  };
}

/* ---------------------------------------------------------- escalonamento */

export interface DegrauEscalonamento {
  nivel: NivelEscalonamento;
  /** Minutos desde a abertura até este degrau ser acionado. */
  acionadoAposMinutos: number;
}

/**
 * Escalonamento na ordem de acionamento, com o tempo acumulado de cada degrau.
 *
 * O prazo de um nível é o tempo que ele tem antes de passar adiante, então o
 * acionamento do nível N é a soma dos prazos dos anteriores.
 */
export function trilhaEscalonamento(
  niveis: NivelEscalonamento[],
  clienteId: string,
): DegrauEscalonamento[] {
  const ordenados = niveis
    .filter((n) => n.cliente_id === clienteId)
    .sort((a, b) => a.nivel - b.nivel);

  let acumulado = 0;
  return ordenados.map((nivel) => {
    const degrau = { nivel, acionadoAposMinutos: acumulado };
    acumulado += nivel.prazo_minutos;
    return degrau;
  });
}

/** Formata minutos como "45min", "2h" ou "1h 30min". */
export function formatarMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`;
}

/* -------------------------------------------------------------- contatos */

export function contatoPrincipal(
  contatos: ContatoCliente[],
  clienteId: string,
): ContatoCliente | undefined {
  const daConta = contatos.filter((c) => c.cliente_id === clienteId);
  return daConta.find((c) => c.principal) ?? daConta[0];
}

/**
 * Lacunas de cadastro que atrapalham a operação quando um incidente estoura.
 * Cada item é uma frase pronta para exibir na ficha do cliente.
 */
export function lacunasDoCliente(contexto: {
  cliente: Cliente;
  contatos: ContatoCliente[];
  niveis: NivelEscalonamento[];
  equipesVinculadas: number;
  servicosContratados: number;
}): string[] {
  const lacunas: string[] = [];
  const { cliente } = contexto;

  if (!contatoPrincipal(contexto.contatos, cliente.id)) {
    lacunas.push('Sem contato principal cadastrado.');
  }
  if (contexto.niveis.filter((n) => n.cliente_id === cliente.id).length === 0) {
    lacunas.push('Sem caminho de escalonamento definido.');
  }
  if (contexto.equipesVinculadas === 0) {
    lacunas.push('Nenhuma equipe designada para atender a conta.');
  }
  if (contexto.servicosContratados === 0) {
    lacunas.push('Nenhum serviço contratado registrado.');
  }
  if (!cliente.gerente_conta_id) {
    lacunas.push('Sem gerente de conta responsável pela satisfação.');
  }

  return lacunas;
}
