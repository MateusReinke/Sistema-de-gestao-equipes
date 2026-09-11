/**
 * Compositores de alto nível para os dois rodízios que motivam a maior parte
 * das escalas reais e que ninguém deveria precisar calcular à mão:
 *
 * - **Revezamento dia sim, dia não** (par 12×36 da NOC): duas posições que se
 *   alternam a cada dia.
 * - **Rodízio com backup rotativo** (plantão de infra estilo G1/G2/G3): N
 *   pessoas revezando semana a semana, cada uma com a próxima da lista como
 *   backup enquanto está de plantão principal.
 *
 * Os dois só decidem QUAIS `EscalaDetalhe`/`EscalaFuncionario` gravar — quem
 * projeta isso sobre um período de calendário continua sendo
 * `plantoesGerados` (`@/lib/geracaoPlantoes`). Ver o comentário no topo
 * daquele arquivo para o porquê de cada padrão de âncora.
 */
import type { EscalaDetalhe, EscalaFuncionario, HoraMinuto, IsoDate, TipoPlantao } from '@/types/sgo';
import { diaDaSemana, diferencaSemanas, somarDias } from '@/lib/date';

type Detalhe = Omit<EscalaDetalhe, 'id' | 'escala_id'>;

/** Resto não-negativo: a âncora pode vir depois do início do rodízio. */
function moduloPositivo(a: number, n: number): number {
  return ((a % n) + n) % n;
}

type Vinculo = Omit<EscalaFuncionario, 'id' | 'escala_id'>;

/* --------------------------------------------------- revezamento dia-a-dia */

export interface RevezamentoDiario {
  /** Um par dia-sim-dia-não sempre fecha em 2 semanas. */
  ciclo_semanas: 2;
  /** Grade única da escala — quem faz o quê sai da posição de cada pessoa. */
  detalhes: Detalhe[];
}

/**
 * Grade de uma escala em que se trabalha dia sim, dia não (12×36).
 *
 * A regra sai da paridade. Como a semana do ciclo é contada em semanas de
 * calendário (ver `geracaoPlantoes.ts`), a semana 2 fica deslocada de exatos 7
 * dias da semana 1 — número ímpar. Então, na semana 1 trabalha-se nos dias da
 * semana de **mesma paridade** que `diaBase`, e na semana 2 nos de paridade
 * **oposta**. É o padrão do par noturno da NOC na planilha de origem: semana 1
 * seg/qua/sex, semana 2 dom/ter/qui/sáb.
 *
 * Uma escala só atende o par inteiro: a segunda pessoa não precisa de outra
 * escala nem de outro template — basta ocupar a **posição 2** do rodízio, que
 * é uma semana de distância na âncora. Com isso ela cai na semana 2 do ciclo
 * enquanto a primeira está na semana 1, o que cobre exatamente os dias que a
 * outra folga (ver `ancoraDaPosicao`).
 */
export function gerarRevezamentoDiario(params: {
  diaBase: IsoDate;
  horaInicio: HoraMinuto;
  horaFim: HoraMinuto;
  tipo: TipoPlantao;
  tipoTurnoId?: string | null;
}): RevezamentoDiario {
  const { diaBase, horaInicio, horaFim, tipo, tipoTurnoId = null } = params;
  const paridadeBase = diaDaSemana(diaBase) % 2;

  const todosOsDias = [0, 1, 2, 3, 4, 5, 6];
  const linha = (semana: 1 | 2, dia: number): Detalhe => ({
    tipo_turno_id: tipoTurnoId,
    semana_do_ciclo: semana,
    dia_semana: dia,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    tipo,
  });

  return {
    ciclo_semanas: 2,
    detalhes: [
      ...todosOsDias.filter((d) => d % 2 === paridadeBase).map((d) => linha(1, d)),
      ...todosOsDias.filter((d) => d % 2 !== paridadeBase).map((d) => linha(2, d)),
    ],
  };
}

/* ------------------------------------------------------ posição no rodízio */

/**
 * Âncora de quem ocupa a posição `posicao` (0-based) de um rodízio que começa
 * em `inicioEm`.
 *
 * "Posição" é como o rodízio se explica para quem cadastra: numa escala de 3
 * semanas, a posição 1 está de plantão na primeira semana, a 2 na seguinte, a
 * 3 na terceira. Por baixo isso é só a âncora deslocada de semanas inteiras —
 * que é o que o motor de geração entende.
 */
export function ancoraDaPosicao(inicioEm: IsoDate, posicao: number, semanasPorPosicao = 1): IsoDate {
  return somarDias(inicioEm, posicao * 7 * semanasPorPosicao);
}

/** Caminho inverso: em que posição do rodízio uma âncora põe a pessoa. */
export function posicaoDaAncora(
  inicioEm: IsoDate,
  ancoraEm: IsoDate,
  cicloSemanas: number,
  semanasPorPosicao = 1,
): number {
  const posicoes = Math.max(1, Math.floor(cicloSemanas / semanasPorPosicao));
  const semanas = diferencaSemanas(inicioEm, ancoraEm);
  return moduloPositivo(Math.floor(semanas / semanasPorPosicao), posicoes);
}

/* ------------------------------------------------------- rodízio + backup */

export interface RodizioComBackup {
  ciclo_semanas: number;
  /** Mesma grade para principal e backup — o que muda é a âncora de cada vínculo. */
  detalhes: Detalhe[];
  /** Um vínculo por participante, na mesma ordem recebida. */
  vinculosPrincipal: Vinculo[];
  /** Idem, mas cada um ativo na semana do participante anterior — ver o comentário da função. */
  vinculosBackup: Vinculo[];
}

/**
 * Rodízio de N semanas entre `participantes.length` pessoas, na ordem dada
 * (a primeira é quem assume em `dataInicio`), com backup que gira junto: a
 * pessoa de backup, enquanto alguém está de plantão principal, é sempre a
 * PRÓXIMA da lista — ao chegar no fim da lista, o backup volta para a
 * primeira pessoa.
 *
 * Ex.: G1, G2, G3 → G2 é backup na semana de G1; G3 é backup na semana de
 * G2; G1 é backup na semana de G3.
 *
 * Mecânica: o vínculo de backup da pessoa K usa a mesma âncora que o vínculo
 * *principal* da pessoa anterior (K−1, voltando ao fim da lista se K for a
 * primeira). Isso faz a "semana 1 do ciclo" do backup de K cair exatamente
 * na semana em que a pessoa K−1 está de plantão principal — sem precisar
 * calcular isso à mão para cada pessoa. `plantoesGerados` (chamado depois,
 * na geração) nunca vê "backup": só enxerga um vínculo com uma âncora, igual
 * a qualquer outro.
 */
export function gerarRodizioComBackup(params: {
  participantes: string[];
  dataInicio: IsoDate;
  dataFim: IsoDate;
  horaInicio: HoraMinuto;
  horaFim: HoraMinuto;
  tipo: TipoPlantao;
  /** Semanas que cada pessoa fica antes de passar para a próxima. Padrão: 1. */
  semanasPorTurno?: number;
  /** Dias da semana cobertos pelo plantão. Padrão: todos (sobreaviso 24×7). */
  diasSemana?: number[];
}): RodizioComBackup {
  const {
    participantes,
    dataInicio,
    dataFim,
    horaInicio,
    horaFim,
    tipo,
    semanasPorTurno = 1,
    diasSemana = [0, 1, 2, 3, 4, 5, 6],
  } = params;

  const n = participantes.length;
  const cicloSemanas = n * semanasPorTurno;

  const detalhes: Detalhe[] = [];
  for (let semana = 1; semana <= semanasPorTurno; semana++) {
    for (const dia of diasSemana) {
      detalhes.push({ semana_do_ciclo: semana, dia_semana: dia, hora_inicio: horaInicio, hora_fim: horaFim, tipo });
    }
  }

  const ancoraDe = (indice: number): IsoDate => somarDias(dataInicio, indice * 7 * semanasPorTurno);

  const vinculosPrincipal = participantes.map((funcionarioId, i) => ({
    funcionario_id: funcionarioId,
    ancora_em: ancoraDe(i),
    data_inicio: dataInicio,
    data_fim: dataFim,
  }));

  const vinculosBackup = participantes.map((funcionarioId, k) => ({
    funcionario_id: funcionarioId,
    ancora_em: ancoraDe((k - 1 + n) % n),
    data_inicio: dataInicio,
    data_fim: dataFim,
  }));

  return { ciclo_semanas: cicloSemanas, detalhes, vinculosPrincipal, vinculosBackup };
}
