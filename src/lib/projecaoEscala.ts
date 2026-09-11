/**
 * Projeção da escala de uma equipe sobre um mês — a visão que a planilha
 * entregava: uma linha por pessoa, uma coluna por dia, e em cada célula o que
 * aquela pessoa faz naquele dia.
 *
 * Diferente da geração de plantões, isto **não grava nada**. É leitura pura do
 * rodízio já cadastrado, calculada na hora, para a escala do mês que vem poder
 * ser conferida antes de existir plantão nenhum no banco.
 *
 * O cálculo de calendário não é refeito aqui: cada vínculo passa por
 * `plantoesGerados` (`@/lib/geracaoPlantoes`), o mesmo motor que a geração em
 * lote usa. O que esta camada acrescenta é juntar tudo por pessoa e por dia —
 * inclusive turnos vindos de escalas diferentes, que é como "trabalha de dia e
 * carrega o plantão" aparece — e traduzir o resultado para um estado só.
 */
import type {
  Ausencia,
  Escala,
  EscalaDetalhe,
  EscalaExcecao,
  EscalaFuncionario,
  Ferias,
  Funcionario,
  IsoDate,
} from '@/types/sgo';
import { plantoesGerados } from '@/lib/geracaoPlantoes';
import { turnoDeDetalhes, FOLGA_ID, type TurnoLegenda } from '@/lib/turnos';
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
  /** Escalas a que a pessoa está vinculada no período, para o cabeçalho. */
  escalas: Escala[];
  dias: Map<IsoDate, DiaProjetado>;
}

interface Contexto {
  funcionarios: Funcionario[];
  escalas: Escala[];
  escalaDetalhes: EscalaDetalhe[];
  escalaFuncionarios: EscalaFuncionario[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  /** Ajustes de dia solto, que vencem o padrão do ciclo. */
  escalaExcecoes: EscalaExcecao[];
  /** Legenda em uso pela equipe — ver `legendaDaEquipe`. */
  legenda: TurnoLegenda[];
}

/** Todos os dias do intervalo, inclusive nas duas pontas. */
export function diasDoIntervalo(de: IsoDate, ate: IsoDate): IsoDate[] {
  const dias: IsoDate[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d);
  return dias;
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
 * Pessoa sem nenhum vínculo de escala continua aparecendo, com todos os dias
 * em folga: uma linha vazia mostra que falta cadastrar, enquanto some-la
 * esconderia o problema.
 */
export function projetarEscalaEquipe(
  contexto: Contexto,
  equipeId: string,
  de: IsoDate,
  ate: IsoDate,
): LinhaProjecao[] {
  const escalaPorId = new Map(contexto.escalas.map((e) => [e.id, e]));

  const detalhesPorEscala = new Map<string, EscalaDetalhe[]>();
  for (const d of contexto.escalaDetalhes) {
    const lista = detalhesPorEscala.get(d.escala_id) ?? [];
    lista.push(d);
    detalhesPorEscala.set(d.escala_id, lista);
  }

  const membros = contexto.funcionarios
    .filter((f) => f.equipe_id === equipeId && f.status !== 'desligado')
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return membros.map((funcionario) => {
    const vinculos = contexto.escalaFuncionarios.filter(
      (v) => v.funcionario_id === funcionario.id,
    );

    // Turnos do período, de todas as escalas da pessoa, agrupados por dia.
    const porDia = new Map<
      IsoDate,
      { tipo: EscalaDetalhe['tipo']; tipo_turno_id?: string | null; hora_inicio: string; hora_fim: string }[]
    >();
    const escalasDaPessoa: Escala[] = [];

    for (const vinculo of vinculos) {
      const escala = escalaPorId.get(vinculo.escala_id);
      if (!escala || !escala.ativo) continue;
      escalasDaPessoa.push(escala);

      const gerados = plantoesGerados(
        vinculo,
        detalhesPorEscala.get(escala.id) ?? [],
        escala.ciclo_semanas,
        de,
        ate,
      );
      for (const p of gerados) {
        const lista = porDia.get(p.data) ?? [];
        lista.push({
          tipo: p.tipo,
          tipo_turno_id: p.tipo_turno_id,
          hora_inicio: p.hora_inicio,
          hora_fim: p.hora_fim,
        });
        porDia.set(p.data, lista);
      }
    }

    const dias = new Map<IsoDate, DiaProjetado>();
    for (const [data, turnos] of porDia) {
      const turno = turnoDeDetalhes(turnos, contexto.legenda);
      // O horário que interessa mostrar é o do turno de trabalho; quando só há
      // acionamento, é a janela em que a pessoa pode ser chamada.
      const principal = turnos.find((t) => t.tipo !== 'sobreaviso' && t.tipo !== 'backup') ?? turnos[0];
      dias.set(data, {
        turno,
        horario: `${principal.hora_inicio}–${principal.hora_fim}`,
        indisponivel: indisponibilidade(funcionario.id, data, contexto.ferias, contexto.ausencias),
      });
    }

    /*
     * Ajustes de dia solto vêm por último e vencem o padrão: é assim que se
     * troca quem cobre um sábado sem mexer nas outras semanas do ciclo. Uma
     * exceção sem turno é folga — inclusive apagando o dia que o ciclo previa.
     */
    for (const excecao of contexto.escalaExcecoes) {
      if (excecao.funcionario_id !== funcionario.id) continue;
      if (excecao.data < de || excecao.data > ate) continue;

      const turno = excecao.tipo_turno_id
        ? contexto.legenda.find((t) => t.id === excecao.tipo_turno_id)
        : undefined;

      if (!turno) {
        dias.delete(excecao.data);
        continue;
      }
      dias.set(excecao.data, {
        turno,
        horario: turno.trabalha
          ? `${turno.hora_inicio}–${turno.hora_fim}`
          : `${turno.acionamento_inicio}–${turno.acionamento_fim}`,
        ajustado: true,
        indisponivel: indisponibilidade(
          funcionario.id,
          excecao.data,
          contexto.ferias,
          contexto.ausencias,
        ),
      });
    }

    return { funcionario, escalas: escalasDaPessoa, dias };
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
      if (dia.turno.id === FOLGA_ID || dia.turno.acionamento === 'backup') continue;
      total++;
    }
    cobertura.set(data, total);
  }
  return cobertura;
}
