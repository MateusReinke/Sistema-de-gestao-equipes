/**
 * Quem está de plantão agora, por equipe — o dado que a automação busca.
 *
 * Reaproveita `plantoesDescobertos` (`@/lib/rh`) — a mesma regra que o Portal
 * usa para não contar como "em serviço" quem está de férias ou afastado
 * aprovado depois de escalado. Duas coisas, porém, essa tela não precisa
 * resolver e a API precisa:
 *
 * 1. **Fuso.** No navegador, `new Date()` já nasce no fuso de quem está
 *    olhando a tela. No servidor — um container que roda em UTC — a mesma
 *    chamada devolveria a hora errada. A operação é em horário do Brasil,
 *    então convertemos explicitamente para `America/Sao_Paulo`.
 * 2. **Virada de meia-noite, nos dois sentidos.** Um plantão 19:00–07:00 fica
 *    gravado no dia em que *começa*. Isso exige olhar também o plantão de
 *    **ontem** ao perguntar "quem está de plantão" às 3h da manhã — mas com
 *    cuidado: `turnoCobreMinuto` (`@/lib/date`) só compara hora do dia, sem
 *    saber a qual dia o plantão pertence. Usá-la direto nos dois dias faria
 *    o plantão de amanhã à noite (dado hoje, 19:00–07:00) "cobrir" também as
 *    3h da madrugada de *hoje* — antes mesmo de o turno começar. Por isso
 *    `plantaoEstaAtivo`, abaixo, decide o lado certo do turno conforme o
 *    plantão é de hoje ou de ontem, em vez de reusar a função por igual nos
 *    dois dias.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db/index';
import * as t from './db/schema';
import { plantoesDescobertos } from '@/lib/rh';
import { minutosDoDia, somarDias } from '@/lib/date';

/**
 * O plantão (de hoje ou de ontem) está em curso no minuto informado?
 *
 * `dia`/`minuto` descrevem "agora"; `plantao.data` é o dia em que o turno
 * *começa*, que só pode ser `dia` ou `diaAnterior` — outro valor não chega
 * aqui, porque a consulta já filtra por esses dois dias.
 */
export function plantaoEstaAtivo(
  plantao: { data: string; hora_inicio: string; hora_fim: string },
  dia: string,
  diaAnterior: string,
  minuto: number,
): boolean {
  const inicio = minutosDoDia(plantao.hora_inicio);
  const fim = minutosDoDia(plantao.hora_fim);
  const cruzaMeiaNoite = fim < inicio;

  if (plantao.data === dia) {
    // Turno de hoje: só entrou em curso a partir do início; o "resto" do
    // intervalo (0–fim) pertence à madrugada de amanhã, não à de hoje.
    return cruzaMeiaNoite ? minuto >= inicio : minuto >= inicio && minuto < fim;
  }
  if (plantao.data === diaAnterior) {
    // Turno de ontem só alcança hoje se cruzou a meia-noite, e só até o fim.
    return cruzaMeiaNoite && minuto < fim;
  }
  return false;
}

export const FUSO_OPERACAO = 'America/Sao_Paulo';

/** Decompõe um instante no dia de calendário e minuto do dia, no fuso da operação. */
export function localDeInstante(instante: Date): { dia: string; minuto: number } {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_OPERACAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // `hour12: false` devolveria "24" à meia-noite em vez de "00" — h23 não.
    hourCycle: 'h23',
  });
  const partes = Object.fromEntries(
    formatador.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return {
    dia: `${partes.year}-${partes.month}-${partes.day}`,
    minuto: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

export interface Plantonista {
  funcionario: typeof t.funcionarios.$inferSelect;
  plantao: typeof t.plantoes.$inferSelect;
}

/**
 * Quem está de plantão, agora (ou no instante de `referencia`), por equipe.
 *
 * `equipeIds` vazio ou `null` busca todas as equipes de uma vez — mais barato
 * do que repetir a consulta por equipe quando o chamador precisa do painel
 * inteiro. Equipe sem ninguém em serviço no instante simplesmente não aparece
 * no mapa devolvido — o chamador decide se isso é "furo de escala" ou não.
 */
export async function plantonistasPorEquipe(
  equipeIds: string[] | null,
  referencia: Date = new Date(),
): Promise<Map<string, Plantonista[]>> {
  const { dia, minuto } = localDeInstante(referencia);
  const diaAnterior = somarDias(dia, -1);

  const linhas = await db
    .select({ plantao: t.plantoes, funcionario: t.funcionarios })
    .from(t.plantoes)
    .innerJoin(t.funcionarios, eq(t.funcionarios.id, t.plantoes.funcionario_id))
    .where(
      and(
        inArray(t.plantoes.data, [dia, diaAnterior]),
        inArray(t.plantoes.status, ['previsto', 'confirmado']),
        equipeIds && equipeIds.length > 0 ? inArray(t.funcionarios.equipe_id, equipeIds) : undefined,
      ),
    );

  const porEquipe = new Map<string, Plantonista[]>();
  if (linhas.length === 0) return porEquipe;

  const funcionarioIds = [...new Set(linhas.map((l) => l.funcionario.id))];
  const [ferias, ausencias] = await Promise.all([
    db.select().from(t.ferias).where(inArray(t.ferias.funcionario_id, funcionarioIds)),
    db.select().from(t.ausencias).where(inArray(t.ausencias.funcionario_id, funcionarioIds)),
  ]);

  // Plantão com status confirmado mas cujo titular está de férias ou afastado
  // aprovado depois de escalado: a linha ficou desatualizada, não é serviço real.
  const descobertos = new Set(
    plantoesDescobertos({
      plantoes: linhas.map((l) => l.plantao),
      ferias,
      ausencias,
      aPartirDe: diaAnterior,
    }).map((d) => d.plantao.id),
  );

  for (const { plantao, funcionario } of linhas) {
    if (descobertos.has(plantao.id)) continue;
    if (!plantaoEstaAtivo(plantao, dia, diaAnterior, minuto)) continue;

    const lista = porEquipe.get(funcionario.equipe_id) ?? [];
    lista.push({ funcionario, plantao });
    porEquipe.set(funcionario.equipe_id, lista);
  }

  return porEquipe;
}

/** Atalho para uma equipe só. */
export async function plantonistasDeEquipe(
  equipeId: string,
  referencia: Date = new Date(),
): Promise<Plantonista[]> {
  const mapa = await plantonistasPorEquipe([equipeId], referencia);
  return mapa.get(equipeId) ?? [];
}
