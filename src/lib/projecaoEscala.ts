/**
 * Projeção da escala de uma equipe sobre um período — a visão que a planilha
 * entrega: uma linha por **posição**, uma coluna por dia, e em cada célula o
 * que aquela posição faz naquele dia.
 *
 * A linha é a posição, e não a pessoa, porque é assim que a operação enxerga:
 * "NOC Diurno 1" precisa estar coberto todo dia, independentemente de quem
 * está nele. Quando a vaga está aberta — ninguém designado, ou o ocupante foi
 * desligado — o dia continua aparecendo, marcado como brecha. É exatamente o
 * que não pode sumir da tela.
 *
 * Isto **não grava nada**: é leitura pura do cadastro, calculada na hora, para
 * a escala de qualquer mês poder ser conferida antes de existir plantão nenhum
 * no banco. A conta de calendário não é refeita aqui — cada posição passa por
 * `turnoDoDia` (`@/lib/cicloEscala`), o mesmo motor que a geração em lote usa.
 */
import type {
  Ausencia,
  EscalaCelula,
  EscalaExcecao,
  EscalaPosicao,
  Ferias,
  Funcionario,
  IsoDate,
} from '@/types/sgo';
import { type Ciclo, semanasDoCiclo, turnoDoDia } from '@/lib/cicloEscala';
import { ehFolga, type TurnoLegenda } from '@/lib/turnos';
import { somarDias } from '@/lib/date';

export interface DiaProjetado {
  /** Item da legenda da equipe que descreve o dia. */
  turno: TurnoLegenda;
  /** Horário do que a posição faz nesse dia, já formatado (ex.: "09:00–18:00"). */
  horario: string;
  /** Dia ajustado à mão, fora do padrão do ciclo. */
  ajustado?: boolean;
  /**
   * Ninguém para cumprir o turno: vaga aberta, ou ocupante de férias ou
   * afastado. A escala continua dizendo que é dia de trabalho, e é justamente
   * isso que precisa saltar aos olhos.
   */
  descoberto?: 'vaga' | 'ferias' | 'ausencia';
}

export interface LinhaProjecao {
  posicao: EscalaPosicao;
  /** Quem ocupa a posição hoje; ausente quando a vaga está aberta. */
  ocupante?: Funcionario;
  /** Tamanho do ciclo dela, em semanas. `0` quando não há grade preenchida. */
  ciclo: number;
  /**
   * A grade foi preenchida com a legenda de outra equipe — acontece quando a
   * posição muda de time depois de cadastrada. O calendário continua sendo
   * mostrado, mas isso precisa aparecer na tela, e não sumir em silêncio.
   */
  legendaDeOutraEquipe?: boolean;
  dias: Map<IsoDate, DiaProjetado>;
}

interface Contexto {
  funcionarios: Funcionario[];
  escalaPosicoes: EscalaPosicao[];
  escalaCelulas: EscalaCelula[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  /** Ajustes de dia solto, que vencem o padrão do ciclo. */
  escalaExcecoes: EscalaExcecao[];
  /** Legenda em uso pela equipe — ver `legendaDaEquipe`. */
  legenda: TurnoLegenda[];
  /**
   * Todos os turnos que existem, de todas as equipes. Serve só para não perder
   * o dia de uma posição cadastrada em outro time: o id da célula é encontrado
   * aqui e reexibido com o item equivalente desta equipe. Sem isto, mover uma
   * posição de equipe esvaziaria a linha dela sem explicação.
   */
  turnosConhecidos?: TurnoLegenda[];
}

/** Todos os dias do intervalo, inclusive nas duas pontas. */
export function diasDoIntervalo(de: IsoDate, ate: IsoDate): IsoDate[] {
  const dias: IsoDate[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** O horário que vale num turno: o de trabalho, ou a janela de acionamento. */
export function horarioDoTurno(turno: TurnoLegenda): string {
  if (ehFolga(turno)) return '—';
  return turno.trabalha
    ? `${turno.hora_inicio}–${turno.hora_fim}`
    : `${turno.acionamento_inicio}–${turno.acionamento_fim}`;
}

/** Quem está de férias ou afastado num dia — aprovado, não só solicitado. */
function indisponibilidade(
  funcionarioId: string,
  data: IsoDate,
  ferias: Ferias[],
  ausencias: Ausencia[],
): 'ferias' | 'ausencia' | undefined {
  const deFerias = ferias.some(
    (f) =>
      f.funcionario_id === funcionarioId &&
      f.status === 'aprovada' &&
      f.data_inicio <= data &&
      f.data_fim >= data,
  );
  if (deFerias) return 'ferias';

  const afastado = ausencias.some(
    (a) =>
      a.funcionario_id === funcionarioId &&
      a.status === 'aprovada' &&
      a.data_inicio <= data &&
      a.data_fim >= data,
  );
  return afastado ? 'ausencia' : undefined;
}

/**
 * Uma linha por posição da equipe, com o estado de cada dia do período.
 *
 * Posição sem grade continua aparecendo, com a linha vazia: assim falta de
 * cadastro fica visível na tela, enquanto escondê-la esconderia o problema.
 */
export function projetarEscalaEquipe(
  contexto: Contexto,
  equipeId: string,
  de: IsoDate,
  ate: IsoDate,
): LinhaProjecao[] {
  const celulasPorPosicao = new Map<string, EscalaCelula[]>();
  for (const celula of contexto.escalaCelulas) {
    const lista = celulasPorPosicao.get(celula.posicao_id) ?? [];
    lista.push(celula);
    celulasPorPosicao.set(celula.posicao_id, lista);
  }

  const pessoaPorId = new Map(contexto.funcionarios.map((f) => [f.id, f]));
  const turnoPorId = new Map((contexto.turnosConhecidos ?? contexto.legenda).map((t) => [t.id, t]));
  const daEquipePorRotulo = new Map(contexto.legenda.map((t) => [t.rotulo, t]));
  const idsDaEquipe = new Set(contexto.legenda.map((t) => t.id));

  /**
   * O item da legenda que descreve uma célula.
   *
   * Quando a célula veio da legenda de outra equipe, vale o item de mesmo
   * rótulo desta — é ele que tem o horário certo para este time.
   */
  const resolver = (
    tipoTurnoId: string,
  ): { turno: TurnoLegenda; deOutraEquipe: boolean } | undefined => {
    const achado = turnoPorId.get(tipoTurnoId);
    if (!achado) return undefined;
    if (idsDaEquipe.has(achado.id)) return { turno: achado, deOutraEquipe: false };
    return { turno: daEquipePorRotulo.get(achado.rotulo) ?? achado, deOutraEquipe: true };
  };

  const posicoes = contexto.escalaPosicoes
    .filter((p) => p.equipe_id === equipeId && p.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

  return posicoes.map((posicao) => {
    const celulas = celulasPorPosicao.get(posicao.id) ?? [];
    const bruto = posicao.funcionario_id ? pessoaPorId.get(posicao.funcionario_id) : undefined;
    // Desligado não cobre nada: a vaga fica aberta, que é o alerta que
    // interessa. Manter o nome na linha esconderia a brecha.
    const ocupante = bruto && bruto.status !== 'desligado' ? bruto : undefined;

    const dias = new Map<IsoDate, DiaProjetado>();
    let legendaDeOutraEquipe = false;

    /** Por que este dia não está coberto — `undefined` quando está. */
    const brecha = (data: IsoDate, turno: TurnoLegenda): DiaProjetado['descoberto'] => {
      // Folga não precisa de ninguém, então não é brecha nenhuma.
      if (ehFolga(turno)) return undefined;
      if (!ocupante) return 'vaga';
      return indisponibilidade(ocupante.id, data, contexto.ferias, contexto.ausencias);
    };

    if (celulas.length > 0) {
      const ciclo: Ciclo = { inicio_em: posicao.inicio_em, celulas };
      for (const data of diasDoIntervalo(de, ate)) {
        const tipoTurnoId = turnoDoDia(ciclo, data);
        if (!tipoTurnoId) continue;
        const achado = resolver(tipoTurnoId);
        // A célula pode apontar para um turno que foi apagado de vez; aí não
        // há o que pintar, e o dia fica fora do ciclo.
        if (!achado) continue;
        if (achado.deOutraEquipe) legendaDeOutraEquipe = true;
        dias.set(data, {
          turno: achado.turno,
          horario: horarioDoTurno(achado.turno),
          descoberto: brecha(data, achado.turno),
        });
      }
    }

    /*
     * Ajustes de dia solto vêm por último e vencem o ciclo: é assim que se
     * troca o que a vaga faz num sábado sem mexer nas outras semanas. Sem
     * turno, o ajuste esvazia o dia que o ciclo previa.
     */
    for (const excecao of contexto.escalaExcecoes) {
      if (excecao.posicao_id !== posicao.id) continue;
      if (excecao.data < de || excecao.data > ate) continue;

      const achado = excecao.tipo_turno_id ? resolver(excecao.tipo_turno_id) : undefined;
      if (!achado) {
        dias.delete(excecao.data);
        continue;
      }
      dias.set(excecao.data, {
        turno: achado.turno,
        horario: horarioDoTurno(achado.turno),
        ajustado: true,
        descoberto: brecha(excecao.data, achado.turno),
      });
    }

    return {
      posicao,
      ocupante,
      ciclo: semanasDoCiclo(celulas),
      legendaDeOutraEquipe: legendaDeOutraEquipe || undefined,
      dias,
    };
  });
}

/**
 * Quantas posições realmente cobrem cada dia.
 *
 * Backup não entra na conta: é segunda linha, só acionada se a primeira não
 * atender — contá-lo faria um dia descoberto parecer coberto. Vaga aberta e
 * ocupante de férias ou afastado também não contam, mesmo com a escala
 * dizendo que é dia de trabalho.
 */
export function coberturaPorDia(linhas: LinhaProjecao[], dias: IsoDate[]): Map<IsoDate, number> {
  const cobertura = new Map<IsoDate, number>();
  for (const data of dias) {
    let total = 0;
    for (const linha of linhas) {
      const dia = linha.dias.get(data);
      if (!dia || dia.descoberto) continue;
      if (ehFolga(dia.turno) || dia.turno.acionamento === 'backup') continue;
      total++;
    }
    cobertura.set(data, total);
  }
  return cobertura;
}

/**
 * Os dias em que alguma posição está escalada para trabalhar e não há quem
 * cumpra — o alerta de brecha na escala, por dia.
 */
export function brechasPorDia(
  linhas: LinhaProjecao[],
  dias: IsoDate[],
): Map<IsoDate, LinhaProjecao[]> {
  const brechas = new Map<IsoDate, LinhaProjecao[]>();
  for (const data of dias) {
    const abertas = linhas.filter((l) => l.dias.get(data)?.descoberto);
    if (abertas.length > 0) brechas.set(data, abertas);
  }
  return brechas;
}
