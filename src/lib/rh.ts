/**
 * Regras de negócio de RH.
 *
 * Concentra o que a CLT impõe sobre férias e o que a operação impõe sobre
 * cobertura de plantão, para que as telas só apresentem resultado — nenhuma
 * página recalcula direito de férias por conta própria.
 */
import type {
  Ausencia,
  Equipe,
  Ferias,
  Funcionario,
  IsoDate,
  Plantao,
} from '@/types/sgo';
import {
  diasNoIntervalo,
  diferencaDias,
  dentroDoIntervalo,
  hoje,
  intervalosSobrepoem,
  paraData,
  somarDias,
  somarMeses,
  turnoCobreMinuto,
} from '@/lib/date';

/** Dias de férias adquiridos a cada período aquisitivo completo (art. 130 CLT). */
export const DIAS_FERIAS_POR_PERIODO = 30;

/** Teto do abono pecuniário: 1/3 do período (art. 143 CLT). */
export const MAX_DIAS_ABONO = 10;

/** Antecedência com que o RH deve ser alertado do limite concessivo. */
export const DIAS_ALERTA_VENCIMENTO = 90;

export interface PeriodoAquisitivo {
  inicio: IsoDate;
  fim: IsoDate;
  /**
   * Fim do período concessivo: 12 meses após o fim do aquisitivo. Passar disso
   * obriga o empregador a pagar as férias em dobro (art. 137 CLT).
   */
  limiteConcessivo: IsoDate;
  completo: boolean;
}

/**
 * Todos os períodos aquisitivos desde a admissão até a referência, do mais
 * antigo para o mais recente. O último pode estar em curso (`completo: false`).
 */
export function periodosAquisitivos(
  dataAdmissao: IsoDate,
  referencia: IsoDate = hoje(),
): PeriodoAquisitivo[] {
  if (!dataAdmissao) return [];
  const periodos: PeriodoAquisitivo[] = [];
  let inicio = dataAdmissao;

  // Trava de segurança: 60 anos de casa é mais que qualquer carreira real e
  // impede laço infinito se vier uma data de admissão inválida.
  for (let i = 0; i < 60; i++) {
    const fim = somarDias(somarMeses(inicio, 12), -1);
    periodos.push({
      inicio,
      fim,
      limiteConcessivo: somarMeses(fim, 12),
      completo: fim <= referencia,
    });
    if (fim > referencia) break;
    inicio = somarDias(fim, 1);
  }
  return periodos;
}

/** Dias que uma solicitação consome do saldo: descanso mais dias vendidos. */
const diasConsumidos = (f: Ferias) => f.dias + f.dias_abono;

/**
 * Período aquisitivo mais antigo que ainda não foi totalmente gozado — é ele
 * que dita o limite concessivo a cobrar.
 *
 * Sem o histórico de férias da pessoa, cai no aquisitivo mais antigo completo,
 * que é o comportamento certo para quem nunca tirou férias.
 */
export function periodoAquisitivoVigente(
  dataAdmissao: IsoDate,
  referencia: IsoDate = hoje(),
  feriasDoFuncionario: Ferias[] = [],
): PeriodoAquisitivo | undefined {
  const periodos = periodosAquisitivos(dataAdmissao, referencia);
  const completos = periodos.filter((p) => p.completo);

  const consumoPorPeriodo = new Map<IsoDate, number>();
  for (const f of feriasDoFuncionario) {
    if (f.status === 'rejeitada' || f.status === 'cancelada') continue;
    consumoPorPeriodo.set(
      f.periodo_aquisitivo_inicio,
      (consumoPorPeriodo.get(f.periodo_aquisitivo_inicio) ?? 0) + diasConsumidos(f),
    );
  }

  const naoGozado = completos.find(
    (p) => (consumoPorPeriodo.get(p.inicio) ?? 0) < DIAS_FERIAS_POR_PERIODO,
  );
  // Tudo gozado: fica no último completo; sem nenhum completo, no que está em curso.
  return naoGozado ?? completos[completos.length - 1] ?? periodos[0];
}

export interface SaldoFerias {
  /** Períodos aquisitivos já completados. */
  periodosCompletos: number;
  /** Total de dias adquiridos ao longo da carreira. */
  direito: number;
  /** Dias já usufruídos ou vendidos, em solicitações aprovadas/concluídas. */
  usados: number;
  /** Dias reservados em solicitações ainda pendentes de decisão. */
  agendados: number;
  /** Dias livres, já descontando o que está pendente. */
  saldo: number;
  limiteConcessivo?: IsoDate;
  /** Dias até o limite concessivo — negativo quando já venceu. */
  diasAteVencer?: number;
  vencendo: boolean;
  vencido: boolean;
}

export function calcularSaldoFerias(
  funcionario: Funcionario,
  ferias: Ferias[],
  referencia: IsoDate = hoje(),
): SaldoFerias {
  const doFuncionario = ferias.filter((f) => f.funcionario_id === funcionario.id);
  const periodos = periodosAquisitivos(funcionario.data_admissao, referencia);
  const periodosCompletos = periodos.filter((p) => p.completo).length;
  const direito = periodosCompletos * DIAS_FERIAS_POR_PERIODO;

  const usados = doFuncionario
    .filter((f) => f.status === 'aprovada' || f.status === 'concluida')
    .reduce((total, f) => total + diasConsumidos(f), 0);

  const agendados = doFuncionario
    .filter((f) => f.status === 'pendente')
    .reduce((total, f) => total + diasConsumidos(f), 0);

  const vigente = periodoAquisitivoVigente(funcionario.data_admissao, referencia, doFuncionario);
  // Só faz sentido cobrar o limite concessivo de quem tem saldo a gozar.
  const temSaldo = direito - usados - agendados > 0;
  const diasAteVencer = vigente ? diferencaDias(referencia, vigente.limiteConcessivo) : undefined;

  return {
    periodosCompletos,
    direito,
    usados,
    agendados,
    saldo: direito - usados - agendados,
    limiteConcessivo: vigente?.limiteConcessivo,
    diasAteVencer,
    vencendo:
      temSaldo &&
      diasAteVencer !== undefined &&
      diasAteVencer >= 0 &&
      diasAteVencer <= DIAS_ALERTA_VENCIMENTO,
    vencido: temSaldo && diasAteVencer !== undefined && diasAteVencer < 0,
  };
}

export interface ValidacaoFerias {
  erros: string[];
  alertas: string[];
}

/**
 * Valida uma solicitação de férias contra a CLT e contra a agenda da equipe.
 *
 * `erros` impedem o registro; `alertas` são coisas que o RH precisa enxergar
 * mas pode decidir aceitar (ex.: duas pessoas da mesma equipe fora ao mesmo
 * tempo).
 */
export function validarFerias(
  entrada: {
    funcionario_id: string;
    data_inicio: IsoDate;
    data_fim: IsoDate;
    dias_abono: number;
    id?: string;
  },
  contexto: {
    funcionarios: Funcionario[];
    ferias: Ferias[];
    referencia?: IsoDate;
  },
): ValidacaoFerias {
  const erros: string[] = [];
  const alertas: string[] = [];
  const referencia = contexto.referencia ?? hoje();
  const funcionario = contexto.funcionarios.find((f) => f.id === entrada.funcionario_id);

  if (!funcionario) return { erros: ['Selecione um funcionário.'], alertas };
  if (!entrada.data_inicio || !entrada.data_fim) {
    return { erros: ['Informe início e fim das férias.'], alertas };
  }
  if (entrada.data_fim < entrada.data_inicio) {
    return { erros: ['A data final não pode ser anterior à inicial.'], alertas };
  }

  const dias = diasNoIntervalo(entrada.data_inicio, entrada.data_fim);

  // Art. 134 §1º: nenhum período fracionado pode ser menor que 5 dias.
  if (dias < 5) {
    erros.push('Cada período de férias deve ter no mínimo 5 dias corridos.');
  }
  if (dias > DIAS_FERIAS_POR_PERIODO) {
    erros.push(`Um período não pode passar de ${DIAS_FERIAS_POR_PERIODO} dias.`);
  }
  if (entrada.dias_abono > MAX_DIAS_ABONO) {
    erros.push(`O abono pecuniário é limitado a ${MAX_DIAS_ABONO} dias.`);
  }
  if (entrada.dias_abono < 0) {
    erros.push('O abono não pode ser negativo.');
  }

  // Saldo, desconsiderando a própria solicitação quando for edição.
  const outras = contexto.ferias.filter((f) => f.id !== entrada.id);
  const saldo = calcularSaldoFerias(funcionario, outras, referencia);
  const consumo = dias + entrada.dias_abono;
  if (consumo > saldo.saldo) {
    erros.push(
      `Saldo insuficiente: ${saldo.saldo} dia(s) disponível(is) e ${consumo} solicitado(s).`,
    );
  }

  // Sobreposição com outro período do mesmo funcionário.
  const conflitoProprio = outras.find(
    (f) =>
      f.funcionario_id === entrada.funcionario_id &&
      (f.status === 'aprovada' || f.status === 'pendente') &&
      intervalosSobrepoem(entrada.data_inicio, entrada.data_fim, f.data_inicio, f.data_fim),
  );
  if (conflitoProprio) {
    erros.push(`Conflita com as férias ${conflitoProprio.protocolo} do mesmo funcionário.`);
  }

  // Art. 134 §1º: no máximo 3 períodos por aquisitivo e um deles com 14+ dias.
  const doFuncionario = outras.filter((f) => f.funcionario_id === entrada.funcionario_id);
  const vigente = periodoAquisitivoVigente(funcionario.data_admissao, referencia, doFuncionario);
  if (vigente) {
    const noPeriodo = outras.filter(
      (f) =>
        f.funcionario_id === entrada.funcionario_id &&
        (f.status === 'aprovada' || f.status === 'pendente' || f.status === 'concluida') &&
        f.periodo_aquisitivo_inicio === vigente.inicio,
    );
    if (noPeriodo.length >= 3) {
      erros.push('As férias já foram fracionadas em 3 períodos neste aquisitivo.');
    }
    const maiorPeriodo = Math.max(dias, ...noPeriodo.map((f) => f.dias), 0);
    if (noPeriodo.length > 0 && maiorPeriodo < 14) {
      alertas.push('Ao fracionar, um dos períodos precisa ter ao menos 14 dias corridos.');
    }
  }

  if (saldo.vencido) {
    alertas.push('Período concessivo vencido — férias em dobro (art. 137 CLT).');
  } else if (saldo.vencendo) {
    alertas.push(`Período concessivo vence em ${saldo.diasAteVencer} dias.`);
  }

  // Art. 134 §3º: não pode começar 2 dias antes de feriado ou no descanso semanal.
  const diaSemanaInicio = paraData(entrada.data_inicio).getDay();
  if (diaSemanaInicio === 0 || diaSemanaInicio === 6) {
    alertas.push('Início em fim de semana — a CLT pede início em dia útil.');
  }

  return { erros, alertas };
}

/** Colegas da mesma equipe com férias sobrepostas ao intervalo informado. */
export function conflitosDeEquipe(
  entrada: { funcionario_id: string; data_inicio: IsoDate; data_fim: IsoDate; id?: string },
  contexto: { funcionarios: Funcionario[]; ferias: Ferias[] },
): Funcionario[] {
  const funcionario = contexto.funcionarios.find((f) => f.id === entrada.funcionario_id);
  if (!funcionario) return [];

  const colegas = new Set(
    contexto.funcionarios
      .filter(
        (f) =>
          f.equipe_id === funcionario.equipe_id &&
          f.id !== funcionario.id &&
          f.status !== 'desligado',
      )
      .map((f) => f.id),
  );

  const idsEmConflito = new Set(
    contexto.ferias
      .filter(
        (f) =>
          f.id !== entrada.id &&
          colegas.has(f.funcionario_id) &&
          (f.status === 'aprovada' || f.status === 'pendente') &&
          intervalosSobrepoem(entrada.data_inicio, entrada.data_fim, f.data_inicio, f.data_fim),
      )
      .map((f) => f.funcionario_id),
  );

  return contexto.funcionarios.filter((f) => idsEmConflito.has(f.id));
}

/**
 * Plantões escalados para alguém que estará de férias ou afastado — o furo de
 * escala que o RH e o gestor precisam resolver antes que aconteça.
 */
export interface PlantaoDescoberto {
  plantao: Plantao;
  motivo: 'ferias' | 'ausencia';
}

export function plantoesDescobertos(contexto: {
  plantoes: Plantao[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  aPartirDe?: IsoDate;
}): PlantaoDescoberto[] {
  const inicio = contexto.aPartirDe ?? hoje();
  const feriasAprovadas = contexto.ferias.filter((f) => f.status === 'aprovada');
  const ausenciasAprovadas = contexto.ausencias.filter((a) => a.status === 'aprovada');
  const descobertos: PlantaoDescoberto[] = [];

  for (const plantao of contexto.plantoes) {
    if (plantao.data < inicio || plantao.status === 'trocado') continue;

    const emFerias = feriasAprovadas.some(
      (f) =>
        f.funcionario_id === plantao.funcionario_id &&
        dentroDoIntervalo(plantao.data, f.data_inicio, f.data_fim),
    );
    if (emFerias) {
      descobertos.push({ plantao, motivo: 'ferias' });
      continue;
    }

    const ausente = ausenciasAprovadas.some(
      (a) =>
        a.funcionario_id === plantao.funcionario_id &&
        dentroDoIntervalo(plantao.data, a.data_inicio, a.data_fim),
    );
    if (ausente) descobertos.push({ plantao, motivo: 'ausencia' });
  }

  return descobertos;
}

/** Quem está efetivamente em serviço no instante informado. */
export function plantoesEmCurso(
  contexto: { plantoes: Plantao[]; ferias: Ferias[]; ausencias: Ausencia[] },
  referencia: Date = new Date(),
): Plantao[] {
  const dia = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}-${String(referencia.getDate()).padStart(2, '0')}`;
  const minuto = referencia.getHours() * 60 + referencia.getMinutes();
  const indisponiveis = new Set(
    plantoesDescobertos({ ...contexto, aPartirDe: dia }).map((d) => d.plantao.id),
  );

  return contexto.plantoes.filter(
    (p) =>
      p.data === dia &&
      p.status !== 'trocado' &&
      !indisponiveis.has(p.id) &&
      turnoCobreMinuto(p.hora_inicio, p.hora_fim, minuto),
  );
}

/** Equipes cuja escala do dia fica abaixo da cobertura mínima acordada. */
export function equipesSemCobertura(contexto: {
  equipes: Equipe[];
  funcionarios: Funcionario[];
  plantoes: Plantao[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  data?: IsoDate;
}): { equipe: Equipe; escalados: number; faltam: number }[] {
  const dia = contexto.data ?? hoje();
  const descobertos = new Set(
    plantoesDescobertos({ ...contexto, aPartirDe: dia }).map((d) => d.plantao.id),
  );
  const equipePorFuncionario = new Map(contexto.funcionarios.map((f) => [f.id, f.equipe_id]));

  return contexto.equipes
    .filter((e) => e.ativo)
    .map((equipe) => {
      const escalados = contexto.plantoes.filter(
        (p) =>
          p.data === dia &&
          p.status !== 'trocado' &&
          !descobertos.has(p.id) &&
          equipePorFuncionario.get(p.funcionario_id) === equipe.id,
      ).length;
      return { equipe, escalados, faltam: equipe.cobertura_minima - escalados };
    })
    .filter((r) => r.faltam > 0);
}

/* -------------------------------------------------------------- pessoas */

export function idade(dataNascimento: IsoDate, referencia: IsoDate = hoje()): number {
  const nasc = paraData(dataNascimento);
  const ref = paraData(referencia);
  let anos = ref.getFullYear() - nasc.getFullYear();
  const mes = ref.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && ref.getDate() < nasc.getDate())) anos--;
  return anos;
}

/** Tempo de casa em meses — base para "1 ano de Lumini" e para o aquisitivo. */
export function mesesDeCasa(dataAdmissao: IsoDate, referencia: IsoDate = hoje()): number {
  const adm = paraData(dataAdmissao);
  const ref = paraData(referencia);
  let meses = (ref.getFullYear() - adm.getFullYear()) * 12 + (ref.getMonth() - adm.getMonth());
  if (ref.getDate() < adm.getDate()) meses--;
  return Math.max(0, meses);
}

export function formatarTempoDeCasa(dataAdmissao: IsoDate, referencia: IsoDate = hoje()): string {
  const meses = mesesDeCasa(dataAdmissao, referencia);
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto} ${resto === 1 ? 'mês' : 'meses'}`;
  if (resto === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${resto}m`;
}

/** Dia/mês de uma data ISO, para comparar aniversários entre anos diferentes. */
const diaMes = (iso: IsoDate) => iso.slice(5);

export function aniversariantesDoMes(
  funcionarios: Funcionario[],
  referencia: IsoDate = hoje(),
): Funcionario[] {
  const mes = referencia.slice(5, 7);
  return funcionarios
    .filter((f) => f.status !== 'desligado' && f.data_nascimento.slice(5, 7) === mes)
    .sort((a, b) => diaMes(a.data_nascimento).localeCompare(diaMes(b.data_nascimento)));
}

/** Aniversários de empresa do mês, ignorando quem foi admitido no próprio mês. */
export function aniversariosDeEmpresaDoMes(
  funcionarios: Funcionario[],
  referencia: IsoDate = hoje(),
): { funcionario: Funcionario; anos: number }[] {
  const mes = referencia.slice(5, 7);
  const ano = Number(referencia.slice(0, 4));
  return funcionarios
    .filter((f) => f.status !== 'desligado' && f.data_admissao.slice(5, 7) === mes)
    .map((f) => ({ funcionario: f, anos: ano - Number(f.data_admissao.slice(0, 4)) }))
    .filter((r) => r.anos > 0)
    .sort((a, b) => diaMes(a.funcionario.data_admissao).localeCompare(diaMes(b.funcionario.data_admissao)));
}

/**
 * Turnover do mês em %: desligamentos sobre o headcount médio do período,
 * que é a definição usada na maioria dos relatórios de RH.
 */
export function turnoverDoMes(
  funcionarios: Funcionario[],
  referencia: IsoDate = hoje(),
): { admissoes: number; desligamentos: number; taxa: number } {
  const mes = referencia.slice(0, 7);
  const admissoes = funcionarios.filter((f) => f.data_admissao.slice(0, 7) === mes).length;
  const desligamentos = funcionarios.filter(
    (f) => f.data_desligamento?.slice(0, 7) === mes,
  ).length;

  const ativosFim = funcionarios.filter((f) => f.status !== 'desligado').length;
  const ativosInicio = ativosFim - admissoes + desligamentos;
  const medio = (ativosInicio + ativosFim) / 2;

  return {
    admissoes,
    desligamentos,
    taxa: medio > 0 ? Math.round((desligamentos / medio) * 1000) / 10 : 0,
  };
}
