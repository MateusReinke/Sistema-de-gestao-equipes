/**
 * A legenda de turnos de uma equipe — os códigos que a grade pinta e o
 * calendário mostra.
 *
 * Cada equipe lê a própria escala de um jeito: no NOC, "T.2" é o turno
 * noturno; na infra, é plantão. Por isso a legenda é um catálogo **por
 * equipe** (`tipos_turno`), e não uma lista fixa no código. Enquanto uma
 * equipe não mexe na dela, a tela usa `TURNOS_PADRAO` abaixo — as linhas no
 * banco só nascem quando alguém edita a legenda.
 *
 * Um item da legenda responde três coisas:
 *
 * - **trabalha?** — cumpre turno naquele dia;
 * - **acionamento** — entra na fila de chamada como primeira linha (plantão),
 *   segunda (backup), ou não entra;
 * - **a que horas** — o turno de trabalho e a janela de acionamento, que são
 *   janelas diferentes (trabalha das 9 às 18 e fica acionável o dia todo).
 *
 * Um dia acumula papéis, então um item pode marcar as duas primeiras ao mesmo
 * tempo — é o "T.4 Trabalho + plantão" da planilha. **Folga também é um item
 * da legenda**, e não a ausência de um: é assim na aba `Configuração` da
 * planilha, e é o que separa "hoje é folga" de "este dia não faz parte do
 * ciclo" na grade de cadastro.
 */
import type { CorTurno, TipoTurno } from '@/types/sgo';

/**
 * Um item da legenda. A linha de `tipos_turno` tem exatamente esta forma —
 * cores são nomeadas, não hex solto, porque a legenda é editada por quem
 * opera e a paleta garante contraste nos dois temas.
 */
export type TurnoLegenda = TipoTurno;

export const CORES_TURNO: Record<CorTurno, { rotulo: string; classe: string }> = {
  verde: { rotulo: 'Verde', classe: 'bg-success/20 text-success-strong border-success/40' },
  laranja: { rotulo: 'Laranja', classe: 'bg-brand-orange/25 text-brand-orange border-brand-orange/40' },
  azul: { rotulo: 'Azul', classe: 'bg-brand-blue/25 text-brand-blue border-brand-blue/40' },
  vermelho: { rotulo: 'Vermelho', classe: 'bg-destructive/20 text-destructive border-destructive/40' },
  roxo: { rotulo: 'Roxo', classe: 'bg-primary/25 text-primary border-primary/45' },
  coral: { rotulo: 'Coral', classe: 'bg-brand-coral/25 text-brand-coral border-brand-coral/45' },
  amarelo: { rotulo: 'Amarelo', classe: 'bg-warning/25 text-warning-strong border-warning/45' },
  cinza: { rotulo: 'Cinza', classe: 'bg-muted text-muted-foreground border-border' },
};

export const CORES_DISPONIVEIS = Object.keys(CORES_TURNO) as CorTurno[];

/**
 * Folga: não trabalha e não pode ser acionada. É o que a função abaixo
 * reconhece — pelo significado, não pelo id, para a equipe poder renomear o
 * item ("Descanso", "DSR") sem quebrar contagem de cobertura.
 */
export function ehFolga(turno: TurnoLegenda): boolean {
  return !turno.trabalha && turno.acionamento === 'nenhum';
}

/**
 * Legenda embutida, usada por qualquer equipe que ainda não montou a sua.
 * Segue os códigos da planilha de origem, para quem migrar não precisar
 * reaprender nada — mas é só um ponto de partida: a equipe renomeia, troca
 * horário e acrescenta o que quiser.
 */
export const TURNOS_PADRAO: TurnoLegenda[] = [
  {
    id: 'padrao-folga',
    codigo: 'Folga',
    rotulo: 'Folga',
    cor: 'verde',
    trabalha: false,
    acionamento: 'nenhum',
    hora_inicio: '00:00',
    hora_fim: '00:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '00:00',
    tipo_plantao: 'comercial',
    ordem: 0,
    ativo: true,
  },
  {
    id: 'padrao-trabalho',
    codigo: 'T.1',
    rotulo: 'Trabalho',
    cor: 'laranja',
    trabalha: true,
    acionamento: 'nenhum',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 1,
    ativo: true,
  },
  {
    id: 'padrao-plantao',
    codigo: 'T.2',
    rotulo: 'Plantão',
    cor: 'azul',
    trabalha: false,
    acionamento: 'plantao',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'sobreaviso',
    ordem: 2,
    ativo: true,
  },
  {
    id: 'padrao-backup',
    codigo: 'T.3',
    rotulo: 'Backup de plantão',
    cor: 'vermelho',
    trabalha: false,
    acionamento: 'backup',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'backup',
    ordem: 3,
    ativo: true,
  },
  {
    id: 'padrao-trabalho-plantao',
    codigo: 'T.4',
    rotulo: 'Trabalho + plantão',
    cor: 'roxo',
    trabalha: true,
    acionamento: 'plantao',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 4,
    ativo: true,
  },
  {
    id: 'padrao-trabalho-backup',
    codigo: 'T.5',
    rotulo: 'Trabalho + backup',
    cor: 'coral',
    trabalha: true,
    acionamento: 'backup',
    hora_inicio: '08:00',
    hora_fim: '17:00',
    acionamento_inicio: '00:00',
    acionamento_fim: '23:59',
    tipo_plantao: 'comercial',
    ordem: 5,
    ativo: true,
  },
];

/** Classe de cor de um turno, já resolvida. */
export function classeDoTurno(turno: TurnoLegenda): string {
  return CORES_TURNO[turno.cor]?.classe ?? CORES_TURNO.cinza.classe;
}

/**
 * Código para grades apertadas, como o mês inteiro numa tela só: a folga vira
 * um traço, para os dias em que alguém está escalado saltarem aos olhos.
 */
export function codigoCurto(turno: TurnoLegenda): string {
  return ehFolga(turno) ? '—' : turno.codigo;
}

/** Como o turno é descrito por extenso, com o horário que vale nele. */
export function descricaoDoTurno(turno: TurnoLegenda): string {
  if (ehFolga(turno)) return 'Não trabalha e não pode ser acionada.';
  const partes: string[] = [];
  if (turno.trabalha) partes.push(`trabalha ${turno.hora_inicio}–${turno.hora_fim}`);
  if (turno.acionamento === 'plantao') {
    partes.push(`atende primeiro, ${turno.acionamento_inicio}–${turno.acionamento_fim}`);
  }
  if (turno.acionamento === 'backup') {
    partes.push(`cobre como 2ª linha, ${turno.acionamento_inicio}–${turno.acionamento_fim}`);
  }
  return partes.join(' · ');
}

/** A legenda em uso por uma equipe: a dela, ou a embutida se ainda não montou. */
export function legendaDaEquipe(
  tiposTurno: TurnoLegenda[],
  equipeId: string | null | undefined,
): TurnoLegenda[] {
  const daEquipe = tiposTurno
    .filter((t) => t.equipe_id === equipeId && t.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.codigo.localeCompare(b.codigo));
  return daEquipe.length > 0 ? daEquipe : TURNOS_PADRAO;
}

/**
 * Cópia da legenda embutida para uma equipe — o que "editar a legenda" grava
 * na primeira vez, para daí em diante a equipe mexer só na dela.
 */
export function legendaInicialDaEquipe(
  equipeId: string,
  novoId: (prefixo: string) => string,
): TurnoLegenda[] {
  return TURNOS_PADRAO.map((t) => ({ ...t, id: novoId('tt'), equipe_id: equipeId }));
}
