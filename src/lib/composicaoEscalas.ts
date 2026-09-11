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
import { diaDaSemana, somarDias } from '@/lib/date';

type Detalhe = Omit<EscalaDetalhe, 'id' | 'escala_id'>;
type Vinculo = Omit<EscalaFuncionario, 'id' | 'escala_id'>;

/* --------------------------------------------------- revezamento dia-a-dia */

export interface RevezamentoDiario {
  /** Um par dia-sim-dia-não sempre fecha em 2 semanas — ver `geracaoPlantoes.ts`. */
  ciclo_semanas: 2;
  /** Grade de quem trabalha em `diaBase` e nos dias alternados dele. */
  detalhesPosicao1: Detalhe[];
  /** O complemento exato: cobre só os dias em que a posição 1 folga. */
  detalhesPosicao2: Detalhe[];
}

/**
 * Grade de um par que reveza dia sim, dia não (12×36) a partir de um único
 * dia de referência — em vez de pedir para quem cadastra escrever a grade
 * das duas pessoas à mão (e errar a da segunda, que é a causa mais comum de
 * a escala "não fechar").
 *
 * A regra sai da paridade. Como a semana do ciclo é contada em semanas de
 * calendário (ver `geracaoPlantoes.ts`), a semana 1 é a semana do domingo de
 * `diaBase` e a semana 2 é a seguinte — deslocada de exatos 7 dias, que é
 * ímpar em "dias alternados". Então, dentro da semana 1, trabalha-se nos dias
 * da semana de **mesma paridade** que `diaBase`; na semana 2, nos de paridade
 * **oposta**. É o padrão que a planilha de origem já usava no par noturno da
 * NOC: semana 1 seg/qua/sex, semana 2 dom/ter/qui/sáb.
 *
 * As duas posições compartilham a mesma âncora (`diaBase`); a posição 2 é a
 * posição 1 com as semanas 1 e 2 trocadas, o que cobre exatamente os dias que
 * a outra folga.
 */
export function gerarRevezamentoDiario(params: {
  diaBase: IsoDate;
  horaInicio: HoraMinuto;
  horaFim: HoraMinuto;
  tipo: TipoPlantao;
}): RevezamentoDiario {
  const { diaBase, horaInicio, horaFim, tipo } = params;
  const paridadeBase = diaDaSemana(diaBase) % 2;

  const todosOsDias = [0, 1, 2, 3, 4, 5, 6];
  const mesmaParidade = todosOsDias.filter((d) => d % 2 === paridadeBase);
  const paridadeOposta = todosOsDias.filter((d) => d % 2 !== paridadeBase);

  const linha = (semana: 1 | 2, dia: number): Detalhe => ({
    semana_do_ciclo: semana,
    dia_semana: dia,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    tipo,
  });

  return {
    ciclo_semanas: 2,
    detalhesPosicao1: [
      ...mesmaParidade.map((d) => linha(1, d)),
      ...paridadeOposta.map((d) => linha(2, d)),
    ],
    detalhesPosicao2: [
      ...paridadeOposta.map((d) => linha(1, d)),
      ...mesmaParidade.map((d) => linha(2, d)),
    ],
  };
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
