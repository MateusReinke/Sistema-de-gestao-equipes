import { ptBR } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import type { HoraMinuto, IsoDate } from '@/types/sgo';

/**
 * Datas de negócio aqui são dias de calendário, não instantes. Interpretamos
 * `YYYY-MM-DD` ao meio-dia local para que somar/subtrair dias nunca escorregue
 * de dia por causa de horário de verão ou fuso.
 */
export function paraData(iso: IsoDate): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

export function paraIso(data: Date): IsoDate {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function hoje(): IsoDate {
  return paraIso(new Date());
}

export function agora(): string {
  return new Date().toISOString();
}

export function somarDias(iso: IsoDate, dias: number): IsoDate {
  const d = paraData(iso);
  d.setDate(d.getDate() + dias);
  return paraIso(d);
}

export function somarMeses(iso: IsoDate, meses: number): IsoDate {
  const d = paraData(iso);
  d.setMonth(d.getMonth() + meses);
  return paraIso(d);
}

/** Diferença em dias corridos entre duas datas (b − a), sem incluir as pontas. */
export function diferencaDias(a: IsoDate, b: IsoDate): number {
  return Math.round((paraData(b).getTime() - paraData(a).getTime()) / 86_400_000);
}

/** Total de dias de um intervalo contando início e fim — como o RH conta férias. */
export function diasNoIntervalo(inicio: IsoDate, fim: IsoDate): number {
  if (!inicio || !fim) return 0;
  const d = diferencaDias(inicio, fim) + 1;
  return d > 0 ? d : 0;
}

/** Dois intervalos fechados se cruzam em pelo menos um dia. */
export function intervalosSobrepoem(
  aInicio: IsoDate,
  aFim: IsoDate,
  bInicio: IsoDate,
  bFim: IsoDate,
): boolean {
  return aInicio <= bFim && bInicio <= aFim;
}

export function dentroDoIntervalo(data: IsoDate, inicio: IsoDate, fim: IsoDate): boolean {
  return data >= inicio && data <= fim;
}

/* ------------------------------------------------------------- formatação */

export function formatarData(iso?: IsoDate): string {
  if (!iso) return '—';
  return format(paraData(iso), 'dd/MM/yyyy');
}

export function formatarDataCurta(iso?: IsoDate): string {
  if (!iso) return '—';
  return format(paraData(iso), "dd 'de' MMM", { locale: ptBR });
}

export function formatarDataHora(isoCompleto?: string): string {
  if (!isoCompleto) return '—';
  return format(parseISO(isoCompleto), "dd/MM/yyyy 'às' HH:mm");
}

export function formatarMesAno(iso: IsoDate): string {
  return format(paraData(iso), "MMMM 'de' yyyy", { locale: ptBR });
}

/** "há 3 dias", "hoje", "em 12 dias" — para prazos e filas de aprovação. */
export function humanizarPrazo(iso: IsoDate, referencia: IsoDate = hoje()): string {
  const dias = diferencaDias(referencia, iso);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  return dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`;
}

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function diaDaSemana(iso: IsoDate): number {
  return paraData(iso).getDay();
}

/* ------------------------------------------------------------------ horas */

export function minutosDoDia(hora: HoraMinuto): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Duração de um turno em horas, tratando virada de meia-noite — um plantão
 * 19:00–07:00 dura 12h, não −12h.
 */
export function duracaoTurnoHoras(inicio: HoraMinuto, fim: HoraMinuto): number {
  const i = minutosDoDia(inicio);
  const f = minutosDoDia(fim);
  const minutos = f >= i ? f - i : 1440 - i + f;
  return Math.round((minutos / 60) * 10) / 10;
}

/** O turno cobre determinado minuto do dia, considerando virada de meia-noite. */
export function turnoCobreMinuto(
  inicio: HoraMinuto,
  fim: HoraMinuto,
  minutoDoDia: number,
): boolean {
  const i = minutosDoDia(inicio);
  const f = minutosDoDia(fim);
  if (f < i) return minutoDoDia >= i || minutoDoDia < f;
  return minutoDoDia >= i && minutoDoDia < f;
}
