/**
 * Projeção da escala de uma equipe sobre um período — a visão que a planilha
 * entrega: uma linha por pessoa, uma coluna por dia, e em cada célula o que
 * aquela pessoa faz naquele dia.
 *
 * Isto **não grava nada**: é leitura pura do cadastro, calculada na hora, para
 * a escala de qualquer mês poder ser conferida antes de existir plantão nenhum
 * no banco. A conta de calendário não é refeita aqui — cada pessoa passa por
 * `turnoDoDia` (`@/lib/cicloEscala`), o mesmo motor que a geração em lote usa.
 *
 * O que esta camada acrescenta: juntar o cadastro com os ajustes de dia solto,
 * marcar quem está de férias ou afastado, e resolver o turno para o item da
 * legenda que a tela pinta.
 */
import type {
  Ausencia,
  EscalaCadastro,
  EscalaCelula,
  EscalaExcecao,
  Ferias,
  Funcionario,
  IsoDate,
} from '@/types/sgo';
import { type CicloPessoa, semanasDoCiclo, turnoDoDia } from '@/lib/cicloEscala';
import { ehFolga, type TurnoLegenda } from '@/lib/turnos';
import { somarDias } from '@/lib/date';

export interface DiaProjetado {
  /** Item da legenda da equipe que descreve o dia. */
  turno: TurnoLegenda;
  /** Horário do que a pessoa faz nesse dia, já formatado (ex.: "09:00–18:00"). */
  horario: string;
  /** Dia ajustado à mão, fora do padrão do ciclo. */
  ajustado?: boolean;
  /**
   * Escalada, mas de férias ou afastada — a escala continua dizendo que é o
   * dia dela, e é exatamente isso que precisa saltar aos olhos.
   */
  indisponivel?: 'ferias' | 'ausencia';
}

export interface LinhaProjecao {
  funcionario: Funcionario;
  /** Cadastro da pessoa, para a tela mostrar o ciclo e a data inicial. */
  cadastro?: EscalaCadastro;
  /** Tamanho do ciclo dela, em semanas. `0` quando não há grade preenchida. */
  ciclo: number;
  /**
   * A grade foi preenchida com a legenda de outra equipe — acontece quando a
   * pessoa muda de time depois de cadastrada. O calendário continua sendo
   * mostrado, mas isso precisa aparecer na tela, e não sumir em silêncio.
   */
  legendaDeOutraEquipe?: boolean;
  dias: Map<IsoDate, DiaProjetado>;
}

interface Contexto {
  funcionarios: Funcionario[];
  escalaCadastros: EscalaCadastro[];
  escalaCelulas: EscalaCelula[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  /** Ajustes de dia solto, que vencem o padrão do ciclo. */
  escalaExcecoes: EscalaExcecao[];
  /** Legenda em uso pela equipe — ver `legendaDaEquipe`. */
  legenda: TurnoLegenda[];
  /**
   * Todos os turnos que existem, de todas as equipes. Serve só para não perder
   * o dia de quem foi cadastrado em outro time: o id da célula é encontrado
   * aqui e reexibido com o item equivalente desta equipe. Sem isto, mudar
   * alguém de equipe esvazia a linha dela sem explicação.
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
 * Uma linha por pessoa da equipe, com o estado de cada dia do período.
 *
 * Pessoa sem cadastro continua aparecendo, com a linha vazia: assim falta um
 * cadastro fica visível na tela, enquanto escondê-la esconderia o problema.
 */
export function projetarEscalaEquipe(
  contexto: Contexto,
  equipeId: string,
  de: IsoDate,
  ate: IsoDate,
): LinhaProjecao[] {
  const cadastroPorPessoa = new Map(contexto.escalaCadastros.map((c) => [c.funcionario_id, c]));

  const celulasPorCadastro = new Map<string, EscalaCelula[]>();
  for (const celula of contexto.escalaCelulas) {
    const lista = celulasPorCadastro.get(celula.cadastro_id) ?? [];
    lista.push(celula);
    celulasPorCadastro.set(celula.cadastro_id, lista);
  }

  const turnoPorId = new Map((contexto.turnosConhecidos ?? contexto.legenda).map((t) => [t.id, t]));
  const daEquipePorRotulo = new Map(contexto.legenda.map((t) => [t.rotulo, t]));
  const idsDaEquipe = new Set(contexto.legenda.map((t) => t.id));

  /**
   * O item da legenda que descreve uma célula.
   *
   * Quando a célula veio da legenda de outra equipe, vale o item de mesmo
   * rótulo desta — é ele que tem o horário certo para este time. Sem isso, um
   * "Trabalho" cadastrado no NOC apareceria com o horário do NOC na Field
   * Service.
   */
  const resolver = (
    tipoTurnoId: string,
  ): { turno: TurnoLegenda; deOutraEquipe: boolean } | undefined => {
    const achado = turnoPorId.get(tipoTurnoId);
    if (!achado) return undefined;
    if (idsDaEquipe.has(achado.id)) return { turno: achado, deOutraEquipe: false };
    return { turno: daEquipePorRotulo.get(achado.rotulo) ?? achado, deOutraEquipe: true };
  };

  const membros = contexto.funcionarios
    .filter((f) => f.equipe_id === equipeId && f.status !== 'desligado')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return membros.map((funcionario) => {
    const cadastro = cadastroPorPessoa.get(funcionario.id);
    const celulas = cadastro ? (celulasPorCadastro.get(cadastro.id) ?? []) : [];
    const dias = new Map<IsoDate, DiaProjetado>();
    let legendaDeOutraEquipe = false;

    if (cadastro && celulas.length > 0) {
      const ciclo: CicloPessoa = { inicio_em: cadastro.inicio_em, celulas };
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
          indisponivel: indisponibilidade(funcionario.id, data, contexto.ferias, contexto.ausencias),
        });
      }
    }

    /*
     * Ajustes de dia solto vêm por último e vencem o cadastro: é assim que se
     * troca quem cobre um sábado sem mexer nas outras semanas do ciclo. Sem
     * turno, o ajuste esvazia o dia que o ciclo previa.
     */
    for (const excecao of contexto.escalaExcecoes) {
      if (excecao.funcionario_id !== funcionario.id) continue;
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
        indisponivel: indisponibilidade(
          funcionario.id,
          excecao.data,
          contexto.ferias,
          contexto.ausencias,
        ),
      });
    }

    return {
      funcionario,
      cadastro,
      ciclo: semanasDoCiclo(celulas),
      legendaDeOutraEquipe: legendaDeOutraEquipe || undefined,
      dias,
    };
  });
}

/**
 * Quantas pessoas realmente cobrem cada dia.
 *
 * Backup não entra na conta: é segunda linha, só acionada se a primeira não
 * atender — contá-lo faria um dia descoberto parecer coberto. Quem está de
 * férias ou afastado também não, mesmo constando na escala.
 */
export function coberturaPorDia(linhas: LinhaProjecao[], dias: IsoDate[]): Map<IsoDate, number> {
  const cobertura = new Map<IsoDate, number>();
  for (const data of dias) {
    let total = 0;
    for (const linha of linhas) {
      const dia = linha.dias.get(data);
      if (!dia || dia.indisponivel) continue;
      if (ehFolga(dia.turno) || dia.turno.acionamento === 'backup') continue;
      total++;
    }
    cobertura.set(data, total);
  }
  return cobertura;
}
