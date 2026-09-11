/**
 * Vocabulário de "o que esta pessoa faz neste dia" — a peça que a planilha de
 * escala usava e que faltava aqui.
 *
 * Na planilha, cada célula do ciclo guarda **um código** (T.1…T.5, ou Folga) e
 * o horário vem do contrato da pessoa, não da célula. É por isso que preencher
 * lá é rápido: pinta-se a grade com um código e pronto. Aqui era o contrário —
 * cada turno pedia semana, dia, tipo, início e fim, um de cada vez.
 *
 * Os códigos existem porque um dia **acumula papéis**: quem está de plantão
 * costuma também trabalhar naquele dia. Em vez de inventar um tipo híbrido,
 * cada estado se decompõe em duas perguntas independentes:
 *
 * - `trabalha` — cumpre o turno normal?
 * - `acionamento` — está de plantão, de backup, ou de nada?
 *
 * Na gravação, essa decomposição vira uma ou duas linhas de `escala_detalhes`
 * (uma do turno, uma do acionamento) — que é exatamente o que o motor de
 * geração (`geracaoPlantoes.ts`) já sabia consumir, sem precisar de código
 * híbrido nenhum.
 */
import type { EscalaDetalhe, HoraMinuto, TipoPlantao } from '@/types/sgo';

export type EstadoDia =
  | 'folga'
  | 'trabalho'
  | 'plantao'
  | 'backup'
  | 'trabalho_plantao'
  | 'trabalho_backup';

export type Acionamento = 'nenhum' | 'plantao' | 'backup';

export interface DefinicaoEstado {
  /** Código curto da planilha — o que a operação já lê há anos. */
  codigo: string;
  /**
   * Versão para grades apertadas, como o mês inteiro numa tela só: folga vira
   * um traço, para os dias em que alguém está escalado saltarem aos olhos.
   */
  codigoCurto: string;
  rotulo: string;
  descricao: string;
  trabalha: boolean;
  acionamento: Acionamento;
  /** Classe de fundo/texto para a célula pintada. */
  classe: string;
}

/**
 * Ordem é a da paleta na tela, e o código seguido é o mesmo da planilha
 * (T.1 = Trabalho … T.5 = Trabalho + Backup) para quem migrar não precisar
 * reaprender nada.
 */
export const ESTADO_DIA: Record<EstadoDia, DefinicaoEstado> = {
  folga: {
    codigo: 'Folga',
    codigoCurto: '—',
    rotulo: 'Folga',
    descricao: 'Não trabalha e não pode ser acionada.',
    trabalha: false,
    acionamento: 'nenhum',
    classe: 'bg-success/20 text-success-strong border-success/40',
  },
  trabalho: {
    codigo: 'T.1',
    codigoCurto: 'T.1',
    rotulo: 'Trabalho',
    descricao: 'Cumpre o turno normal, sem plantão.',
    trabalha: true,
    acionamento: 'nenhum',
    classe: 'bg-brand-orange/25 text-brand-orange border-brand-orange/40',
  },
  plantao: {
    codigo: 'T.2',
    codigoCurto: 'T.2',
    rotulo: 'Plantão',
    descricao: 'De sobreaviso, sem cumprir turno — é quem atende primeiro.',
    trabalha: false,
    acionamento: 'plantao',
    classe: 'bg-brand-blue/25 text-brand-blue border-brand-blue/40',
  },
  backup: {
    codigo: 'T.3',
    codigoCurto: 'T.3',
    rotulo: 'Backup de plantão',
    descricao: 'Segunda linha: só é acionada se quem está de plantão não atender.',
    trabalha: false,
    acionamento: 'backup',
    classe: 'bg-destructive/20 text-destructive border-destructive/40',
  },
  trabalho_plantao: {
    codigo: 'T.4',
    codigoCurto: 'T.4',
    rotulo: 'Trabalho + plantão',
    descricao: 'Cumpre o turno e ainda carrega o plantão no restante do dia.',
    trabalha: true,
    acionamento: 'plantao',
    classe: 'bg-primary/25 text-primary border-primary/45',
  },
  trabalho_backup: {
    codigo: 'T.5',
    codigoCurto: 'T.5',
    rotulo: 'Trabalho + backup',
    descricao: 'Cumpre o turno e fica como segunda linha de acionamento.',
    trabalha: true,
    acionamento: 'backup',
    classe: 'bg-brand-coral/25 text-brand-coral border-brand-coral/45',
  },
};

export const ESTADOS_DIA = Object.keys(ESTADO_DIA) as EstadoDia[];

/** Tipo de plantão que representa cada forma de acionamento, ao gravar. */
const TIPO_DO_ACIONAMENTO: Record<Exclude<Acionamento, 'nenhum'>, TipoPlantao> = {
  plantao: 'sobreaviso',
  backup: 'backup',
};

/** Compõe o estado a partir das duas perguntas independentes. */
export function estadoDe(trabalha: boolean, acionamento: Acionamento): EstadoDia {
  if (acionamento === 'plantao') return trabalha ? 'trabalho_plantao' : 'plantao';
  if (acionamento === 'backup') return trabalha ? 'trabalho_backup' : 'backup';
  return trabalha ? 'trabalho' : 'folga';
}

/**
 * Horários que uma escala aplica a cada metade do estado: o turno de trabalho
 * e a janela em que a pessoa pode ser acionada.
 */
export interface HorariosEscala {
  turno_tipo: TipoPlantao;
  turno_inicio: HoraMinuto;
  turno_fim: HoraMinuto;
  sobreaviso_inicio: HoraMinuto;
  sobreaviso_fim: HoraMinuto;
}

type LinhaDetalhe = Omit<EscalaDetalhe, 'id' | 'escala_id'>;

/**
 * Linhas de `escala_detalhes` que um estado produz numa célula do ciclo —
 * duas quando o dia acumula turno e acionamento, nenhuma na folga.
 */
export function detalhesDoEstado(
  estado: EstadoDia,
  semanaDoCiclo: number,
  diaSemana: number,
  horarios: HorariosEscala,
): LinhaDetalhe[] {
  const definicao = ESTADO_DIA[estado];
  const linhas: LinhaDetalhe[] = [];

  if (definicao.trabalha) {
    linhas.push({
      semana_do_ciclo: semanaDoCiclo,
      dia_semana: diaSemana,
      hora_inicio: horarios.turno_inicio,
      hora_fim: horarios.turno_fim,
      tipo: horarios.turno_tipo,
    });
  }
  if (definicao.acionamento !== 'nenhum') {
    linhas.push({
      semana_do_ciclo: semanaDoCiclo,
      dia_semana: diaSemana,
      hora_inicio: horarios.sobreaviso_inicio,
      hora_fim: horarios.sobreaviso_fim,
      tipo: TIPO_DO_ACIONAMENTO[definicao.acionamento],
    });
  }
  return linhas;
}

/**
 * Caminho inverso: o estado que um conjunto de turnos do mesmo dia representa.
 *
 * Aceita também escalas antigas, feitas antes dos códigos existirem — lá um
 * turno `diurno`/`noturno`/`comercial` é simplesmente trabalho, e não havia
 * como marcar backup.
 */
export function estadoDeDetalhes(detalhes: { tipo: TipoPlantao }[]): EstadoDia {
  let trabalha = false;
  let acionamento: Acionamento = 'nenhum';

  for (const d of detalhes) {
    if (d.tipo === 'sobreaviso') {
      // Plantão vence backup: quem acumula os dois é a primeira linha.
      acionamento = 'plantao';
    } else if (d.tipo === 'backup') {
      if (acionamento === 'nenhum') acionamento = 'backup';
    } else {
      trabalha = true;
    }
  }
  return estadoDe(trabalha, acionamento);
}

/**
 * Grade `ciclo_semanas × 7` com o estado de cada célula — o que a tela pinta.
 */
export function gradeDeDetalhes(
  detalhes: { semana_do_ciclo: number; dia_semana: number; tipo: TipoPlantao }[],
  cicloSemanas: number,
): EstadoDia[][] {
  const porCelula = new Map<string, { tipo: TipoPlantao }[]>();
  for (const d of detalhes) {
    const chave = `${d.semana_do_ciclo}-${d.dia_semana}`;
    const lista = porCelula.get(chave) ?? [];
    lista.push(d);
    porCelula.set(chave, lista);
  }

  return Array.from({ length: cicloSemanas }, (_, i) =>
    Array.from({ length: 7 }, (_, dia) => estadoDeDetalhes(porCelula.get(`${i + 1}-${dia}`) ?? [])),
  );
}

/**
 * Horários que uma escala já existente usa, lidos dos próprios turnos — para
 * a grade abrir com o que está gravado quando a escala foi criada antes de os
 * horários passarem a viver na escala.
 */
export function horariosDeDetalhes(
  detalhes: { hora_inicio: HoraMinuto; hora_fim: HoraMinuto; tipo: TipoPlantao }[],
  padrao: HorariosEscala,
): HorariosEscala {
  const turno = detalhes.find((d) => d.tipo !== 'sobreaviso' && d.tipo !== 'backup');
  const acionamento = detalhes.find((d) => d.tipo === 'sobreaviso' || d.tipo === 'backup');
  return {
    turno_tipo: turno?.tipo ?? padrao.turno_tipo,
    turno_inicio: turno?.hora_inicio ?? padrao.turno_inicio,
    turno_fim: turno?.hora_fim ?? padrao.turno_fim,
    sobreaviso_inicio: acionamento?.hora_inicio ?? padrao.sobreaviso_inicio,
    sobreaviso_fim: acionamento?.hora_fim ?? padrao.sobreaviso_fim,
  };
}
