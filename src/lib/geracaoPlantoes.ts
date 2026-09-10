/**
 * Motor de geração de plantões — projeta o template de uma escala sobre um
 * período de calendário, em vez de exigir lançamento dia a dia.
 *
 * O template (`escala_detalhes`) descreve um padrão de `ciclo_semanas`
 * semanas: cada linha diz "nesta semana do ciclo, neste dia da semana, roda
 * este turno". Para saber em que semana do ciclo uma pessoa está num dia
 * `D` qualquer, conta-se quantas semanas se passaram desde a âncora dela
 * (`escala_funcionarios.ancora_em` — a data que marca "semana 1, dia 1" do
 * ciclo *para esta pessoa*) e tira o resto da divisão por `ciclo_semanas`.
 *
 * `dia_semana` é o dia real da semana (0=domingo…6=sábado), não um dia
 * contado a partir da âncora — só a *semana do ciclo* se desloca com ela.
 * Isso importa para quem for montar o template de uma escala compartilhada
 * por várias pessoas:
 *
 * - **Revezamento por semana inteira** (o plantão da INFRA: um responsável
 *   por semana, revezando entre N pessoas) funciona com uma escala só,
 *   âncoras espaçadas em semanas inteiras — desloca em qual semana do ciclo
 *   cada data cai, e o `dia_semana` continua batendo com o calendário real
 *   igual para todo mundo.
 * - **Revezamento dia sim, dia não** (o par 12×36 da NOC) **não** dá para
 *   fazer com uma âncora de 1 dia sobre o mesmo template — um deslocamento
 *   que não é múltiplo de semana inteira não produz o complemento certo,
 *   porque o `dia_semana` não acompanha esse deslocamento. Cada metade do
 *   par ganha sua própria escala (mesmo par de horário, dias complementares
 *   já escritos no template — ex.: dom/seg/qua/sex numa, ter/qui/sáb na
 *   outra), com a mesma âncora nas duas.
 *
 * "Trabalho + Plantão" (alguém que trabalha de dia e ainda carrega o
 * plantão) também não precisa de um código híbrido: a pessoa fica vinculada
 * a duas escalas ao mesmo tempo (uma `trabalho`, uma `plantao`) e o
 * chamador soma o resultado das duas chamadas — describe-se aqui, mas quem
 * compõe é o chamador (o endpoint de geração), não este módulo.
 *
 * "Trabalho + Plantão" (alguém que trabalha de dia e ainda carrega o
 * plantão) também não precisa de um código híbrido: a pessoa fica vinculada
 * a duas escalas ao mesmo tempo (uma `trabalho`, uma `plantao`) e o
 * chamador soma o resultado das duas chamadas — describe-se aqui, mas quem
 * compõe é o chamador (o endpoint de geração), não este módulo.
 */
import type { EscalaDetalhe, EscalaFuncionario, IsoDate, Plantao } from '@/types/sgo';
import { diaDaSemana, diferencaDias, somarDias } from '@/lib/date';

export type PlantaoGerado = Pick<
  Plantao,
  'funcionario_id' | 'escala_id' | 'data' | 'hora_inicio' | 'hora_fim' | 'tipo'
>;

/** Resto sempre não-negativo — `diferencaDias` é negativa quando a âncora vem depois de `data`. */
function moduloPositivo(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * Turnos que este vínculo produz entre `de` e `ate` (inclusive nas duas
 * pontas), recortado também pela vigência do próprio vínculo
 * (`data_inicio`/`data_fim`).
 *
 * Mais de uma linha de `detalhes` pode casar no mesmo dia — vira mais de um
 * plantão naquele dia para a mesma pessoa (ex.: comercial de dia mais
 * sobreaviso à noite, dentro da mesma escala).
 */
export function plantoesGerados(
  vinculo: EscalaFuncionario,
  detalhes: EscalaDetalhe[],
  cicloSemanas: number,
  de: IsoDate,
  ate: IsoDate,
): PlantaoGerado[] {
  const inicio = vinculo.data_inicio > de ? vinculo.data_inicio : de;
  const fim = vinculo.data_fim < ate ? vinculo.data_fim : ate;
  if (inicio > fim) return [];

  const porDiaSemana = new Map<number, EscalaDetalhe[]>();
  for (const detalhe of detalhes) {
    const lista = porDiaSemana.get(detalhe.dia_semana) ?? [];
    lista.push(detalhe);
    porDiaSemana.set(detalhe.dia_semana, lista);
  }

  const resultado: PlantaoGerado[] = [];

  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    const candidatos = porDiaSemana.get(diaDaSemana(data));
    if (!candidatos || candidatos.length === 0) continue;

    const semanasDesdeAncora = Math.floor(diferencaDias(vinculo.ancora_em, data) / 7);
    const semanaDoCiclo = moduloPositivo(semanasDesdeAncora, cicloSemanas) + 1;

    for (const detalhe of candidatos) {
      if (detalhe.semana_do_ciclo !== semanaDoCiclo) continue;
      resultado.push({
        funcionario_id: vinculo.funcionario_id,
        escala_id: vinculo.escala_id,
        data,
        hora_inicio: detalhe.hora_inicio,
        hora_fim: detalhe.hora_fim,
        tipo: detalhe.tipo,
      });
    }
  }

  return resultado;
}
