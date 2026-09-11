/**
 * A legenda de turnos de uma equipe — os códigos que a grade pinta e o
 * calendário mostra.
 *
 * Cada equipe lê a própria escala de um jeito: no NOC, "T.2" é o turno
 * noturno; na infra, é plantão. Por isso a legenda é um catálogo **por
 * equipe** (`tipos_turno`), e não uma lista fixa no código. Enquanto uma
 * equipe não mexe na dela, a tela usa `TURNOS_PADRAO` abaixo — as linhas no
 * banco só nascem quando alguém edita a legenda.
 *
 * Um item da legenda responde três coisas:
 *
 * - **trabalha?** — cumpre turno naquele dia;
 * - **acionamento** — entra na fila de chamada como primeira linha (plantão),
 *   segunda (backup), ou não entra;
 * - **a que horas** — o turno de trabalho e a janela de acionamento, que são
 *   janelas diferentes (trabalha das 9 às 18 e fica acionável o dia todo).
 *
 * Um dia acumula papéis, então um item pode marcar as duas primeiras ao mesmo
 * tempo — é o "T.4 Trabalho + plantão" da planilha. Ao gravar, isso vira uma
 * ou duas linhas de `escala_detalhes`, que é o que o motor de geração
 * (`geracaoPlantoes.ts`) já sabia consumir, sem código híbrido nenhum.
 */
import type { Acionamento, CorTurno, EscalaDetalhe, TipoPlantao, TipoTurno } from '@/types/sgo';

/**
 * Um item da legenda. A linha de `tipos_turno` tem exatamente esta forma —
 * cores são nomeadas, não hex solto, porque a legenda é editada por quem
 * opera e a paleta garante contraste nos dois temas.
 */
export type TurnoLegenda = TipoTurno;

export const CORES_TURNO: Record<CorTurno, { rotulo: string; classe: string }> = {
  verde: { rotulo: 'Verde', classe: 'bg-success/20 text-success-strong border-success/40' },
  laranja: { rotulo: 'Laranja', classe: 'bg-brand-orange/25 text-brand-orange border-brand-orange/40' },
  azul: { rotulo: 'Azul', classe: 'bg-brand-blue/25 text-brand-blue border-brand-blue/40' },
  vermelho: { rotulo: 'Vermelho', classe: 'bg-destructive/20 text-destructive border-destructive/40' },
  roxo: { rotulo: 'Roxo', classe: 'bg-primary/25 text-primary border-primary/45' },
  coral: { rotulo: 'Coral', classe: 'bg-brand-coral/25 text-brand-coral border-brand-coral/45' },
  amarelo: { rotulo: 'Amarelo', classe: 'bg-warning/25 text-warning-strong border-warning/45' },
  cinza: { rotulo: 'Cinza', classe: 'bg-muted text-muted-foreground border-border' },
};

export const CORES_DISPONIVEIS = Object.keys(CORES_TURNO) as CorTurno[];

/**
 * Id da folga. Folga não é uma linha de `tipos_turno`: é a *ausência* de
 * turno no dia, e por isso nunca gera plantão nem pode ser editada fora.
 */
export const FOLGA_ID = 'folga';

export const FOLGA: TurnoLegenda = {
  id: FOLGA_ID,
  codigo: 'Folga',
  rotulo: 'Folga',
  cor: 'verde',
  trabalha: false,
  acionamento: 'nenhum',
  hora_inicio: '00:00',
  hora_fim: '00:00',
  acionamento_inicio: '00:00',
  acionamento_fim: '00:00',
  tipo_plantao: 'comercial',
  ordem: 0,
  ativo: true,
};

/**
 * Legenda embutida, usada por qualquer equipe que ainda não montou a sua.
 * Segue os códigos da planilha de origem, para quem migrar não precisar
 * reaprender nada — mas é só um ponto de partida: a equipe renomeia, troca
 * horário e acrescenta o que quiser.
 */
export const TURNOS_PADRAO: TurnoLegenda[] = [
  {
    id: 'padrao-trabalho',
    codigo: 'T.1',
    rotulo: 'Trabalho',
    cor: 'laranja',
    trabalha: true,
    acionamento: 'nenhum',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 1,
    ativo: true,
  },
  {
    id: 'padrao-plantao',
    codigo: 'T.2',
    rotulo: 'Plantão',
    cor: 'azul',
    trabalha: false,
    acionamento: 'plantao',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'sobreaviso',
    ordem: 2,
    ativo: true,
  },
  {
    id: 'padrao-backup',
    codigo: 'T.3',
    rotulo: 'Backup de plantão',
    cor: 'vermelho',
    trabalha: false,
    acionamento: 'backup',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'backup',
    ordem: 3,
    ativo: true,
  },
  {
    id: 'padrao-trabalho-plantao',
    codigo: 'T.4',
    rotulo: 'Trabalho + plantão',
    cor: 'roxo',
    trabalha: true,
    acionamento: 'plantao',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 4,
    ativo: true,
  },
  {
    id: 'padrao-trabalho-backup',
    codigo: 'T.5',
    rotulo: 'Trabalho + backup',
    cor: 'coral',
    trabalha: true,
    acionamento: 'backup',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 5,
    ativo: true,
  },
];

/** Classe de cor de um turno, já resolvida. */
export function classeDoTurno(turno: TurnoLegenda): string {
  return CORES_TURNO[turno.cor]?.classe ?? CORES_TURNO.cinza.classe;
}

/**
 * Código para grades apertadas, como o mês inteiro numa tela só: a folga vira
 * um traço, para os dias em que alguém está escalado saltarem aos olhos.
 */
export function codigoCurto(turno: TurnoLegenda): string {
  return turno.id === FOLGA_ID ? '—' : turno.codigo;
}

/** Como o turno é descrito por extenso, com o horário que vale nele. */
export function descricaoDoTurno(turno: TurnoLegenda): string {
  if (turno.id === FOLGA_ID) return 'Não trabalha e não pode ser acionada.';
  const partes: string[] = [];
  if (turno.trabalha) partes.push(`trabalha ${turno.hora_inicio}–${turno.hora_fim}`);
  if (turno.acionamento === 'plantao') {
    partes.push(`atende primeiro, ${turno.acionamento_inicio}–${turno.acionamento_fim}`);
  }
  if (turno.acionamento === 'backup') {
    partes.push(`cobre como 2ª linha, ${turno.acionamento_inicio}–${turno.acionamento_fim}`);
  }
  return partes.length > 0 ? partes.join(' · ') : 'Sem efeito no dia.';
}

/** A legenda em uso por uma equipe: a dela, ou a embutida se ainda não montou. */
export function legendaDaEquipe(
  tiposTurno: TurnoLegenda[],
  equipeId: string | null | undefined,
): TurnoLegenda[] {
  const daEquipe = tiposTurno
    .filter((t) => t.equipe_id === equipeId && t.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  return daEquipe.length > 0 ? daEquipe : TURNOS_PADRAO;
}

type LinhaDetalhe = Omit<EscalaDetalhe, 'id' | 'escala_id'>;

const TIPO_DO_ACIONAMENTO: Record<Exclude<Acionamento, 'nenhum'>, TipoPlantao> = {
  plantao: 'sobreaviso',
  backup: 'backup',
};

/**
 * Linhas de `escala_detalhes` que um turno produz numa célula do ciclo — duas
 * quando o dia acumula trabalho e acionamento, nenhuma na folga.
 */
export function detalhesDoTurno(
  turno: TurnoLegenda,
  semanaDoCiclo: number,
  diaSemana: number,
): LinhaDetalhe[] {
  if (turno.id === FOLGA_ID) return [];

  const linhas: LinhaDetalhe[] = [];
  const tipoTurnoId = turno.id.startsWith('padrao-') ? null : turno.id;

  if (turno.trabalha) {
    linhas.push({
      tipo_turno_id: tipoTurnoId,
      semana_do_ciclo: semanaDoCiclo,
      dia_semana: diaSemana,
      hora_inicio: turno.hora_inicio,
      hora_fim: turno.hora_fim,
      tipo: turno.tipo_plantao,
    });
  }
  if (turno.acionamento !== 'nenhum') {
    linhas.push({
      tipo_turno_id: tipoTurnoId,
      semana_do_ciclo: semanaDoCiclo,
      dia_semana: diaSemana,
      hora_inicio: turno.acionamento_inicio,
      hora_fim: turno.acionamento_fim,
      tipo: TIPO_DO_ACIONAMENTO[turno.acionamento],
    });
  }
  return linhas;
}

interface LinhaLida {
  tipo: TipoPlantao;
  tipo_turno_id?: string | null;
}

/**
 * Caminho inverso: qual item da legenda um conjunto de turnos do mesmo dia
 * representa.
 *
 * Quando as linhas trazem `tipo_turno_id`, é consulta direta. Escalas montadas
 * antes da legenda não trazem — aí o item é deduzido pelas mesmas duas
 * perguntas (trabalha? acionamento?), o que também cobre um plantão lançado à
 * mão fora de qualquer grade.
 */
export function turnoDeDetalhes(detalhes: LinhaLida[], legenda: TurnoLegenda[]): TurnoLegenda {
  if (detalhes.length === 0) return FOLGA;

  const comId = detalhes.find((d) => d.tipo_turno_id);
  if (comId) {
    const achado = legenda.find((t) => t.id === comId.tipo_turno_id);
    if (achado) return achado;
  }

  let trabalha = false;
  let acionamento: Acionamento = 'nenhum';
  for (const d of detalhes) {
    if (d.tipo === 'sobreaviso') acionamento = 'plantao';
    else if (d.tipo === 'backup') {
      if (acionamento === 'nenhum') acionamento = 'backup';
    } else trabalha = true;
  }

  const equivalente = legenda.find(
    (t) => t.trabalha === trabalha && t.acionamento === acionamento,
  );
  if (equivalente) return equivalente;
  return trabalha || acionamento !== 'nenhum' ? (legenda[0] ?? FOLGA) : FOLGA;
}

/** Grade `ciclo_semanas × 7` com o turno de cada célula — o que a tela pinta. */
export function gradeDeDetalhes(
  detalhes: (LinhaLida & { semana_do_ciclo: number; dia_semana: number })[],
  cicloSemanas: number,
  legenda: TurnoLegenda[],
): TurnoLegenda[][] {
  const porCelula = new Map<string, LinhaLida[]>();
  for (const d of detalhes) {
    const chave = `${d.semana_do_ciclo}-${d.dia_semana}`;
    const lista = porCelula.get(chave) ?? [];
    lista.push(d);
    porCelula.set(chave, lista);
  }

  return Array.from({ length: cicloSemanas }, (_, i) =>
    Array.from({ length: 7 }, (_, dia) =>
      turnoDeDetalhes(porCelula.get(`${i + 1}-${dia}`) ?? [], legenda),
    ),
  );
}

/**
 * Cópia da legenda embutida para uma equipe — o que "editar a legenda" grava
 * na primeira vez, para daí em diante a equipe mexer só na dela.
 */
export function legendaInicialDaEquipe(
  equipeId: string,
  novoId: (prefixo: string) => string,
): TurnoLegenda[] {
  return TURNOS_PADRAO.map((t) => ({ ...t, id: novoId('tt'), equipe_id: equipeId }));
}
