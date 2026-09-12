/**
 * O que se testa aqui é a promessa da agenda: **a tela de Plantões mostra a
 * mesma coisa que a escala da equipe**. Os casos abaixo são as três formas de
 * as duas divergirem que existiam antes — mês não gerado, vaga aberta e
 * plantão sobrando de uma escala antiga.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ausencia,
  Equipe,
  EscalaCelula,
  EscalaExcecao,
  EscalaPosicao,
  Ferias,
  Funcionario,
  Plantao,
} from '@/types/sgo';
import { TURNOS_PADRAO } from './turnos';
import {
  agendaDoPeriodo,
  brechasDaAgenda,
  cobre,
  equipesSemCoberturaNoDia,
  pendentesDeGeracao,
} from './agendaPlantoes';

const EQUIPE: Equipe = {
  id: 'eq1',
  nome: 'Infraestrutura',
  departamento_id: 'dep1',
  cobertura_minima: 1,
  ativo: true,
};

function pessoa(id: string, nome: string): Funcionario {
  return {
    id,
    matricula: id,
    nome,
    email: `${id}@lumini.com`,
    telefone: '',
    cargo: 'Analista',
    departamento_id: 'dep1',
    equipe_id: EQUIPE.id,
    tipo_contrato: 'clt',
    modelo_trabalho: 'presencial',
    data_admissao: '2020-01-01',
    data_nascimento: '1990-01-01',
    status: 'ativo',
    local: 'São Paulo',
  };
}

const porRotulo = (rotulo: string) => {
  const t = TURNOS_PADRAO.find((x) => x.rotulo === rotulo);
  if (!t) throw new Error(`turno "${rotulo}" não existe no padrão`);
  return t;
};

const TRABALHO = porRotulo('Trabalho');
const FOLGA = porRotulo('Folga');

/** Semana do início é a última do ciclo; 04/01 cai na Semana 1. */
const INICIO = '2025-12-28';

function posicao(id: string, nome: string, funcionarioId: string | null): EscalaPosicao {
  return {
    id,
    equipe_id: EQUIPE.id,
    nome,
    funcionario_id: funcionarioId,
    inicio_em: INICIO,
    ordem: 0,
    ativo: true,
  };
}

/** Trabalha de segunda a sexta — ciclo de uma semana. */
function celulasComerciais(posicaoId: string): EscalaCelula[] {
  return [FOLGA, TRABALHO, TRABALHO, TRABALHO, TRABALHO, TRABALHO, FOLGA].map((turno, dia) => ({
    id: `${posicaoId}-${dia}`,
    posicao_id: posicaoId,
    semana: 1,
    dia_semana: dia,
    tipo_turno_id: turno.id,
  }));
}

const base = {
  equipes: [EQUIPE],
  funcionarios: [pessoa('f1', 'Ana'), pessoa('f2', 'Bruno')],
  escalaPosicoes: [posicao('p1', 'Posição 1', 'f1')],
  escalaCelulas: celulasComerciais('p1'),
  escalaExcecoes: [] as EscalaExcecao[],
  tiposTurno: [],
  plantoes: [] as Plantao[],
  ferias: [] as Ferias[],
  ausencias: [] as Ausencia[],
};

/** Segunda a sexta de uma semana cheia. */
const SEG = '2026-01-05';
const SEX = '2026-01-09';

describe('agendaDoPeriodo', () => {
  it('mostra a escala mesmo sem ninguém ter gerado o mês', () => {
    // Era a divergência principal: a equipe mostrava a escala cheia e a tela
    // de Plantões, vazia, só porque o mês não tinha sido materializado.
    const itens = agendaDoPeriodo(base, SEG, SEX);

    expect(itens).toHaveLength(5);
    expect(itens.map((i) => i.data)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
    ]);
    expect(itens[0]).toMatchObject({
      origem: 'escala',
      hora_inicio: '08:00',
      hora_fim: '17:00',
      tipo: 'comercial',
    });
    expect(itens[0].funcionario?.nome).toBe('Ana');
    expect(itens[0].plantao).toBeUndefined();
    expect(pendentesDeGeracao(itens)).toHaveLength(5);
  });

  it('a folga não vira plantão', () => {
    const itens = agendaDoPeriodo(base, '2026-01-04', '2026-01-04'); // domingo
    expect(itens).toHaveLength(0);
  });

  it('quando o dia já foi gerado, vale o registro gravado', () => {
    const plantao: Plantao = {
      id: 'p-gravado',
      funcionario_id: 'f1',
      data: SEG,
      hora_inicio: '08:00',
      hora_fim: '17:00',
      tipo: 'comercial',
      status: 'confirmado',
      gerado_automaticamente: true,
    };
    const itens = agendaDoPeriodo({ ...base, plantoes: [plantao] }, SEG, SEX);

    // Continua sendo uma linha só — não duplica o dia.
    expect(itens.filter((i) => i.data === SEG)).toHaveLength(1);
    const doDia = itens.find((i) => i.data === SEG)!;
    expect(doDia.id).toBe('p-gravado');
    expect(doDia.plantao?.status).toBe('confirmado');
    expect(doDia.origem).toBe('escala');
    expect(pendentesDeGeracao(itens)).toHaveLength(4);
  });

  it('plantão que a escala não prevê mais aparece como avulso, em vez de sumir', () => {
    // É o resíduo de uma escala gerada e depois alterada: antes ele aparecia
    // só em Plantões, sem explicação nenhuma.
    const sobra: Plantao = {
      id: 'p-sobra',
      funcionario_id: 'f2',
      data: SEG,
      hora_inicio: '19:00',
      hora_fim: '07:00',
      tipo: 'noturno',
      status: 'previsto',
      gerado_automaticamente: true,
    };
    const itens = agendaDoPeriodo({ ...base, plantoes: [sobra] }, SEG, SEX);

    const avulsos = itens.filter((i) => i.origem === 'avulso');
    expect(avulsos).toHaveLength(1);
    expect(avulsos[0]).toMatchObject({ id: 'p-sobra', tipo: 'noturno' });
    expect(avulsos[0].funcionario?.nome).toBe('Bruno');
    expect(avulsos[0].equipe?.nome).toBe('Infraestrutura');
  });

  it('vaga aberta entra na agenda como brecha, e não some', () => {
    // A tabela `plantoes` nunca teve como registrar isto: sem ocupante, não há
    // a quem atribuir. A agenda mostra assim mesmo.
    const itens = agendaDoPeriodo(
      { ...base, escalaPosicoes: [posicao('p1', 'Posição 1', null)] },
      SEG,
      SEX,
    );

    expect(itens).toHaveLength(5);
    expect(itens.every((i) => i.descoberto === 'vaga')).toBe(true);
    expect(itens.every((i) => i.funcionario === undefined)).toBe(true);
    expect(itens.every((i) => !cobre(i))).toBe(true);
    expect(brechasDaAgenda(itens, SEG, SEX)).toHaveLength(5);
    // Vaga não é "falta gerar": não há o que gerar sem ocupante.
    expect(pendentesDeGeracao(itens)).toHaveLength(0);
  });

  it('férias do ocupante descobrem o dia sem tirá-lo da agenda', () => {
    const ferias: Ferias[] = [
      {
        id: 'fe1',
        protocolo: 'FER-1',
        status: 'aprovada',
        solicitado_por: 'f1',
        solicitado_em: '2025-12-01T00:00:00.000Z',
        funcionario_id: 'f1',
        periodo_aquisitivo_inicio: '2025-01-01',
        periodo_aquisitivo_fim: '2025-12-31',
        data_inicio: SEG,
        data_fim: SEG,
        dias: 1,
        dias_abono: 0,
        decimo_terceiro_antecipado: false,
      },
    ];
    const itens = agendaDoPeriodo({ ...base, ferias }, SEG, SEX);
    const doDia = itens.find((i) => i.data === SEG)!;

    expect(doDia.descoberto).toBe('ferias');
    expect(doDia.funcionario?.nome).toBe('Ana');
    expect(cobre(doDia)).toBe(false);
  });

  it('um turno que acumula trabalho e acionamento vira duas linhas', () => {
    const duplo = porRotulo('Trabalho + plantão');
    const celulas: EscalaCelula[] = [{
      id: 'c1',
      posicao_id: 'p1',
      semana: 1,
      dia_semana: 1,
      tipo_turno_id: duplo.id,
    }];
    const itens = agendaDoPeriodo({ ...base, escalaCelulas: celulas }, SEG, SEG);

    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.tipo).sort()).toEqual(['comercial', 'sobreaviso']);
  });

  it('ajuste manual de um dia chega à agenda', () => {
    const excecao: EscalaExcecao = {
      id: 'ex1',
      posicao_id: 'p1',
      data: '2026-01-06',
      tipo_turno_id: porRotulo('Plantão').id,
      observacao: '',
    };
    const itens = agendaDoPeriodo({ ...base, escalaExcecoes: [excecao] }, SEG, SEX);
    const doDia = itens.find((i) => i.data === '2026-01-06')!;

    expect(doDia.tipo).toBe('sobreaviso');
    expect(doDia.turno?.rotulo).toBe('Plantão');
  });

  it('equipe inativa não entra na agenda', () => {
    const itens = agendaDoPeriodo(
      { ...base, equipes: [{ ...EQUIPE, ativo: false }] },
      SEG,
      SEX,
    );
    expect(itens).toHaveLength(0);
  });
});

describe('equipesSemCoberturaNoDia', () => {
  it('conta a partir da escala, não só do que foi gerado', () => {
    // Antes, uma equipe com a escala montada mas sem o mês gerado aparecia
    // como descoberta — o alerta disparava por falta de clique, não de gente.
    const itens = agendaDoPeriodo(base, SEG, SEX);
    expect(equipesSemCoberturaNoDia(itens, [EQUIPE], SEG)).toEqual([]);
  });

  it('vaga aberta deixa a equipe descoberta', () => {
    const itens = agendaDoPeriodo(
      { ...base, escalaPosicoes: [posicao('p1', 'Posição 1', null)] },
      SEG,
      SEX,
    );
    expect(equipesSemCoberturaNoDia(itens, [EQUIPE], SEG)).toEqual([
      { equipe: EQUIPE, escalados: 0, faltam: 1 },
    ]);
  });

  it('backup não conta como cobertura', () => {
    const celulas: EscalaCelula[] = [{
      id: 'c1',
      posicao_id: 'p1',
      semana: 1,
      dia_semana: 1,
      tipo_turno_id: porRotulo('Backup de plantão').id,
    }];
    const itens = agendaDoPeriodo({ ...base, escalaCelulas: celulas }, SEG, SEG);

    expect(itens).toHaveLength(1);
    expect(itens[0].tipo).toBe('backup');
    expect(equipesSemCoberturaNoDia(itens, [EQUIPE], SEG)[0].faltam).toBe(1);
  });

  it('plantão trocado não conta — quem cobre é o substituto', () => {
    const trocado: Plantao = {
      id: 'p-trocado',
      funcionario_id: 'f1',
      data: SEG,
      hora_inicio: '08:00',
      hora_fim: '17:00',
      tipo: 'comercial',
      status: 'trocado',
      gerado_automaticamente: true,
    };
    const itens = agendaDoPeriodo({ ...base, plantoes: [trocado] }, SEG, SEG);
    expect(equipesSemCoberturaNoDia(itens, [EQUIPE], SEG)[0].faltam).toBe(1);
  });
});
