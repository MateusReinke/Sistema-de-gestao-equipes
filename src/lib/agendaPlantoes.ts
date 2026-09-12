/**
 * A agenda de plantões de um período — a fonte única do que está escalado.
 *
 * Antes havia duas respostas para a mesma pergunta. A tela da equipe projetava
 * o ciclo das posições na hora, sempre atualizada; a tela de Plantões lia a
 * tabela `plantoes`, que só existe depois de alguém clicar em "Gerar plantões
 * do mês" e envelhece assim que a escala muda. As duas discordavam — e a que
 * discordava era justamente a que a operação abre para saber quem está de
 * plantão.
 *
 * Aqui as duas viram uma. A agenda parte **sempre da escala** (a mesma
 * projeção da tela da equipe) e sobrepõe o que já foi materializado:
 *
 * - dia previsto pela escala e ainda não gerado → aparece como `previsto`;
 * - dia já gravado em `plantoes` → vale o registro, com status e trocas;
 * - plantão gravado que a escala atual não prevê → aparece como `avulso`,
 *   em vez de sumir. É onde caem os lançamentos à mão e o resíduo de uma
 *   escala que mudou depois de gerada;
 * - posição sem ocupante → aparece como **vaga**, que é a brecha que a tela
 *   precisa mostrar e que a tabela `plantoes` nunca teve como registrar.
 */
import type {
  Ausencia,
  Equipe,
  EscalaCelula,
  EscalaExcecao,
  EscalaPosicao,
  Ferias,
  Funcionario,
  HoraMinuto,
  IsoDate,
  Plantao,
  TipoPlantao,
  TipoTurno,
} from '@/types/sgo';
import { janelasDoTurno, legendaDaEquipe, TURNOS_PADRAO, type TurnoLegenda } from '@/lib/turnos';
import { diasDoIntervalo, projetarEscalaEquipe } from '@/lib/projecaoEscala';

/** De onde a linha da agenda veio. */
export type OrigemAgenda = 'escala' | 'avulso';

export interface ItemAgenda {
  /** Estável entre renders: casa com o plantão gravado quando existe. */
  id: string;
  data: IsoDate;
  equipe?: Equipe;
  /** Posição da escala; ausente num plantão lançado à mão. */
  posicao?: EscalaPosicao;
  /** Quem cumpre o turno; ausente é vaga aberta. */
  funcionario?: Funcionario;
  /** Item da legenda que originou o turno, quando veio da escala. */
  turno?: TurnoLegenda;
  hora_inicio: HoraMinuto;
  hora_fim: HoraMinuto;
  tipo: TipoPlantao;
  origem: OrigemAgenda;
  /** O registro gravado, quando o período já foi gerado. */
  plantao?: Plantao;
  /**
   * Por que ninguém cobre este turno: vaga aberta, ou o ocupante está de
   * férias ou afastado. `undefined` quer dizer que está coberto.
   */
  descoberto?: 'vaga' | 'ferias' | 'ausencia';
}

interface Contexto {
  equipes: Equipe[];
  funcionarios: Funcionario[];
  escalaPosicoes: EscalaPosicao[];
  escalaCelulas: EscalaCelula[];
  escalaExcecoes: EscalaExcecao[];
  tiposTurno: TipoTurno[];
  plantoes: Plantao[];
  ferias: Ferias[];
  ausencias: Ausencia[];
}

/** A chave do índice único de `plantoes` — é por ela que a agenda casa. */
const chaveDoPlantao = (funcionarioId: string, data: IsoDate, horaInicio: HoraMinuto) =>
  `${funcionarioId}|${data}|${horaInicio}`;

/**
 * Tudo o que está escalado no período, uma linha por turno de cada dia.
 *
 * O resultado sai ordenado por data e horário, que é como as telas mostram.
 */
export function agendaDoPeriodo(contexto: Contexto, de: IsoDate, ate: IsoDate): ItemAgenda[] {
  const turnosConhecidos = [...contexto.tiposTurno, ...TURNOS_PADRAO];
  const equipePorId = new Map(contexto.equipes.map((e) => [e.id, e]));

  /* Plantões do período, indexados para casar com o que a escala prevê. */
  const noPeriodo = contexto.plantoes.filter((p) => p.data >= de && p.data <= ate);
  const porChave = new Map(
    noPeriodo.map((p) => [chaveDoPlantao(p.funcionario_id, p.data, p.hora_inicio), p]),
  );
  const casados = new Set<string>();

  const itens: ItemAgenda[] = [];

  for (const equipe of contexto.equipes) {
    if (!equipe.ativo) continue;

    const legenda = legendaDaEquipe(contexto.tiposTurno, equipe.id);
    const linhas = projetarEscalaEquipe(
      { ...contexto, legenda, turnosConhecidos },
      equipe.id,
      de,
      ate,
    );

    for (const linha of linhas) {
      for (const [data, dia] of linha.dias) {
        for (const janela of janelasDoTurno(dia.turno)) {
          const chave = linha.ocupante
            ? chaveDoPlantao(linha.ocupante.id, data, janela.inicio)
            : undefined;
          const plantao = chave ? porChave.get(chave) : undefined;
          if (chave && plantao) casados.add(chave);

          itens.push({
            id: plantao?.id ?? `${linha.posicao.id}|${data}|${janela.inicio}`,
            data,
            equipe,
            posicao: linha.posicao,
            funcionario: linha.ocupante,
            turno: dia.turno,
            hora_inicio: janela.inicio,
            hora_fim: janela.fim,
            // O plantão gravado manda no tipo: alguém pode tê-lo corrigido
            // à mão depois de gerado.
            tipo: plantao?.tipo ?? janela.tipo,
            origem: 'escala',
            plantao,
            descoberto: dia.descoberto,
          });
        }
      }
    }
  }

  /*
   * O que sobrou de `plantoes` não é previsto pela escala de hoje: lançamento
   * avulso, ou resto de uma escala que mudou depois de gerada. Continua na
   * agenda, marcado, porque escondê-lo é o que fazia as duas telas divergirem
   * sem ninguém entender por quê.
   */
  for (const plantao of noPeriodo) {
    const chave = chaveDoPlantao(plantao.funcionario_id, plantao.data, plantao.hora_inicio);
    if (casados.has(chave)) continue;

    const funcionario = contexto.funcionarios.find((f) => f.id === plantao.funcionario_id);
    itens.push({
      id: plantao.id,
      data: plantao.data,
      equipe: funcionario ? equipePorId.get(funcionario.equipe_id) : undefined,
      funcionario,
      hora_inicio: plantao.hora_inicio,
      hora_fim: plantao.hora_fim,
      tipo: plantao.tipo,
      origem: 'avulso',
      plantao,
      descoberto: funcionario
        ? indisponibilidade(funcionario.id, plantao.data, contexto.ferias, contexto.ausencias)
        : 'vaga',
    });
  }

  return itens.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.hora_inicio.localeCompare(b.hora_inicio) ||
      (a.funcionario?.nome ?? '').localeCompare(b.funcionario?.nome ?? '', 'pt-BR'),
  );
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

/** Um item conta como cobertura de verdade no dia? */
export function cobre(item: ItemAgenda): boolean {
  if (item.descoberto) return false;
  if (item.plantao?.status === 'trocado') return false;
  // Backup é segunda linha, só acionada se a primeira não atender. Contá-lo
  // como cobertura esconderia o furo real.
  return item.tipo !== 'backup';
}

/**
 * Equipes que não atingem a cobertura mínima num dia.
 *
 * É a mesma conta que a tela da equipe faz no calendário — antes cada tela
 * tinha a sua, e o Portal chegava a listar a mesma equipe duas vezes com
 * números diferentes.
 */
export function equipesSemCoberturaNoDia(
  itens: ItemAgenda[],
  equipes: Equipe[],
  data: IsoDate,
): { equipe: Equipe; escalados: number; faltam: number }[] {
  const doDia = itens.filter((i) => i.data === data && cobre(i));

  return equipes
    .filter((e) => e.ativo)
    .map((equipe) => {
      const escalados = doDia.filter((i) => i.equipe?.id === equipe.id).length;
      return { equipe, escalados, faltam: equipe.cobertura_minima - escalados };
    })
    .filter((r) => r.faltam > 0);
}

/** Os dias do período em que algum turno está escalado e sem ninguém. */
export function brechasDaAgenda(itens: ItemAgenda[], de: IsoDate, ate: IsoDate): IsoDate[] {
  const dias = new Set(itens.filter((i) => i.descoberto).map((i) => i.data));
  return diasDoIntervalo(de, ate).filter((d) => dias.has(d));
}

/** Quantos turnos do período ainda não foram gravados em `plantoes`. */
export function pendentesDeGeracao(itens: ItemAgenda[]): ItemAgenda[] {
  return itens.filter((i) => i.origem === 'escala' && !i.plantao && !i.descoberto);
}
