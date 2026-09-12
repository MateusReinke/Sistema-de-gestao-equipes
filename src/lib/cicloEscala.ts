/**
 * O ciclo da escala, exatamente como a planilha da operação faz.
 *
 * Na planilha, a aba **Cadastro** tem uma linha por pessoa e, ao lado do nome,
 * uma grade de semanas: `Dom1 Seg1 … Sáb1 | Dom2 Seg2 … Sáb2 | Dom3 …`. Aqui a
 * linha é a *posição* da equipe em vez da pessoa — quem a ocupa muda, a escala
 * não —, mas a conta é exatamente a mesma. Quem monta a escala preenche
 * quantas semanas quiser e o ciclo volta sozinho para o começo: preencheu só a
 * semana 1, toda semana é igual; preencheu 1, 2 e 3, a quarta semana do
 * calendário já é a semana 1 de novo.
 *
 * As três fórmulas que fazem isso, e que este arquivo reproduz:
 *
 * 1. **Quantas semanas tem o ciclo** — `COUNTA(Dom1; Dom2; …; Dom9)`, uma
 *    conta por *coluna de dia da semana*. É por coluna, não por linha: dá
 *    para ter domingo repetindo toda semana e segunda alternando de duas em
 *    duas, que é como a planilha trata quem só tem sábado em algumas semanas.
 *
 * 2. **Que semana do ciclo é este dia** —
 *    `=IF(MOD(semana_do_dia − semana_inicial; ciclo)=0; ciclo; MOD(…))`,
 *    com `semana_inicial = WEEKNUM(Data Inicial)`. Repare no `=0 → ciclo`: a
 *    semana da própria data inicial é a **última** do ciclo, e a semana 1 é a
 *    seguinte. Parece detalhe, mas é o que alinha o rodízio com o calendário
 *    real — então fica igual.
 *
 * 3. **O turno do dia** — `INDEX(…; MATCH(nome); MATCH(dia_da_semana & semana))`,
 *    ou seja: vai na grade da linha e lê a célula `Seg3`, `Dom1`, `Sáb2`.
 *
 * A única coisa que mudamos de propósito: onde a planilha subtrai `WEEKNUM`,
 * contamos semanas de calendário corridas. Dentro do mesmo ano dá o mesmo
 * número; na virada do ano o `WEEKNUM` volta para 1 e desalinha o rodízio —
 * um bug da planilha que não vale a pena copiar.
 */
import type { IsoDate } from '@/types/sgo';
import { diaDaSemana, diferencaSemanas } from './date';

/** Teto de semanas do ciclo — a planilha vai até `Sáb9`. */
export const MAXIMO_SEMANAS = 9;

/**
 * Uma célula da grade: em qual semana do ciclo, em qual dia da semana, que
 * turno a posição cumpre. A ausência de célula é o "não preenchido" da
 * planilha — não conta para o tamanho do ciclo. Folga é um turno como outro
 * qualquer, por isso ela aparece aqui com `tipo_turno_id` preenchido.
 */
export interface CelulaCiclo {
  /** 1-based, como os rótulos "Semana 1", "Semana 2"… da planilha. */
  semana: number;
  /** 0 = domingo … 6 = sábado, igual a `Date.getDay()`. */
  dia_semana: number;
  tipo_turno_id: string;
}

/** O ciclo de uma posição: a data que o ancora e a grade dela. */
export interface Ciclo {
  inicio_em: IsoDate;
  celulas: CelulaCiclo[];
}

/** Resto sempre não-negativo — `MOD` do Excel, não o `%` do JavaScript. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Quantas semanas o ciclo tem em cada dia da semana — o `COUNTA` da planilha,
 * uma posição por dia (0 = domingo … 6 = sábado).
 *
 * Vale a maior semana preenchida, e não a contagem de células, para que um
 * buraco no meio (alguém apagou a terça da semana 2) não encurte o ciclo e
 * jogue todo o resto do mês para outra semana.
 */
export function ciclosPorDia(celulas: CelulaCiclo[]): number[] {
  const ciclos = Array<number>(7).fill(0);
  for (const c of celulas) {
    if (c.dia_semana < 0 || c.dia_semana > 6) continue;
    ciclos[c.dia_semana] = Math.max(ciclos[c.dia_semana], c.semana);
  }
  return ciclos;
}

/** O ciclo como um todo — a maior semana preenchida na grade. */
export function semanasDoCiclo(celulas: CelulaCiclo[]): number {
  return celulas.reduce((maior, c) => Math.max(maior, c.semana), 0);
}

/**
 * Em que semana do ciclo esta data cai — 1..ciclo, ou 0 quando não há ciclo.
 *
 * É a fórmula 2 do cabeçalho: a semana da data inicial é a última do ciclo, a
 * seguinte é a semana 1.
 */
export function semanaDoCiclo(inicioEm: IsoDate, data: IsoDate, ciclo: number): number {
  if (ciclo <= 0) return 0;
  const resto = mod(diferencaSemanas(inicioEm, data), ciclo);
  return resto === 0 ? ciclo : resto;
}

/**
 * O turno que a posição cumpre num dia, ou `null` quando a grade não diz nada
 * sobre aquele dia da semana.
 */
export function turnoDoDia(ciclo: Ciclo, data: IsoDate): string | null {
  const dia = diaDaSemana(data);
  const tamanho = ciclosPorDia(ciclo.celulas)[dia];
  if (tamanho === 0) return null;

  const semana = semanaDoCiclo(ciclo.inicio_em, data, tamanho);
  const celula = ciclo.celulas.find((c) => c.dia_semana === dia && c.semana === semana);
  return celula?.tipo_turno_id ?? null;
}

/**
 * A mesma grade, girada em `semanas` — o que transforma uma posição só num
 * rodízio inteiro.
 *
 * É assim que a planilha monta o plantão de infra: as três pessoas têm a mesma
 * grade de 3 semanas, cada uma girada de uma posição. Quem está na semana de
 * plantão hoje estará na de folga daqui a uma semana, e o backup cai sozinho
 * no lugar certo — sem preencher 21 células à mão e sem errar o alinhamento.
 *
 * Girar em 1 significa "uma semana atrás do original": o que a posição-base faz
 * nesta semana, quem foi girado em 1 faz na semana que vem.
 */
export function girarCiclo(celulas: CelulaCiclo[], semanas: number): CelulaCiclo[] {
  const ciclo = semanasDoCiclo(celulas);
  if (ciclo <= 0) return [];

  const porChave = new Map(celulas.map((c) => [`${c.semana}-${c.dia_semana}`, c]));
  const giradas: CelulaCiclo[] = [];

  for (let semana = 1; semana <= ciclo; semana += 1) {
    const origem = mod(semana - 1 - semanas, ciclo) + 1;
    for (let dia = 0; dia < 7; dia += 1) {
      const celula = porChave.get(`${origem}-${dia}`);
      if (celula) giradas.push({ semana, dia_semana: dia, tipo_turno_id: celula.tipo_turno_id });
    }
  }
  return giradas;
}
