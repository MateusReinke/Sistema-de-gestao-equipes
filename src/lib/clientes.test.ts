import { describe, expect, it } from 'vitest';
import {
  classificarNps,
  contatoPrincipal,
  contratosParaRenovar,
  formatarMinutos,
  lacunasDoCliente,
  npsDaCarteira,
  saudeCliente,
  situacaoContrato,
  trilhaEscalonamento,
} from '@/lib/clientes';
import type {
  AvaliacaoCliente,
  Cliente,
  ContatoCliente,
  NivelEscalonamento,
} from '@/types/sgo';

const REF = '2026-06-15';

function cliente(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 'c1',
    nome: 'TechCorp',
    razao_social: 'TechCorp S.A.',
    cnpj: '12.345.678/0001-90',
    id_whatsapp: '5511990000001',
    segmento: 'Tecnologia',
    gerente_conta_id: 'f16',
    contrato_numero: 'CT-2024-001',
    contrato_inicio: '2024-01-01',
    contrato_fim: '2026-12-31',
    renovacao_automatica: true,
    aviso_previa_dias: 60,
    valor_mensal: 40_000,
    status_contrato: 'ativo',
    regime: '24x7',
    sla_resposta_min: 15,
    sla_resolucao_horas: 4,
    ativo: true,
    ...over,
  };
}

function avaliacao(over: Partial<AvaliacaoCliente> = {}): AvaliacaoCliente {
  return {
    id: 'av1',
    cliente_id: 'c1',
    data: '2026-05-01',
    nota: 9,
    registrado_por: 'f16',
    comentario: '',
    ...over,
  };
}

function nivel(over: Partial<NivelEscalonamento> = {}): NivelEscalonamento {
  return {
    id: 'ne1',
    cliente_id: 'c1',
    nivel: 1,
    titulo: 'Plantão N1',
    prazo_minutos: 30,
    canal: 'WhatsApp',
    instrucoes: '',
    ...over,
  };
}

describe('situação do contrato', () => {
  it('calcula os dias até a renovação', () => {
    const s = situacaoContrato(cliente({ contrato_fim: '2026-07-15' }), REF);
    expect(s.diasParaVencer).toBe(30);
    expect(s.vencido).toBe(false);
  });

  it('marca como vencido o contrato cuja vigência já passou', () => {
    const s = situacaoContrato(cliente({ contrato_fim: '2026-05-15' }), REF);
    expect(s.vencido).toBe(true);
    expect(s.diasParaVencer).toBe(-31);
    expect(s.precisaDecisao).toBe(true);
  });

  it('entra no radar dentro dos 90 dias que antecedem a renovação', () => {
    expect(situacaoContrato(cliente({ contrato_fim: '2026-09-01' }), REF).aRenovar).toBe(true);
    expect(situacaoContrato(cliente({ contrato_fim: '2026-11-01' }), REF).aRenovar).toBe(false);
  });

  it('deriva o limite de aviso a partir do prazo contratado', () => {
    const s = situacaoContrato(
      cliente({ contrato_fim: '2026-08-01', aviso_previa_dias: 30 }),
      REF,
    );
    expect(s.limiteAviso).toBe('2026-07-02');
    expect(s.avisoVencido).toBe(false);
  });

  it('acusa quando o prazo de aviso prévio já passou', () => {
    const s = situacaoContrato(
      cliente({ contrato_fim: '2026-07-01', aviso_previa_dias: 60 }),
      REF,
    );
    // Limite era 02/05; a referência é 15/06.
    expect(s.avisoVencido).toBe(true);
  });

  it('não cobra decisão de contrato já encerrado', () => {
    const s = situacaoContrato(
      cliente({ contrato_fim: '2025-01-01', status_contrato: 'encerrado' }),
      REF,
    );
    expect(s.vencido).toBe(true);
    expect(s.precisaDecisao).toBe(false);
  });

  it('lista os contratos a renovar do mais urgente para o mais distante', () => {
    const lista = contratosParaRenovar(
      [
        cliente({ id: 'a', contrato_fim: '2026-08-20' }),
        cliente({ id: 'b', contrato_fim: '2026-05-01' }),
        cliente({ id: 'c', contrato_fim: '2027-01-01' }),
        cliente({ id: 'd', contrato_fim: '2026-07-01' }),
      ],
      REF,
    );
    expect(lista.map((r) => r.cliente.id)).toEqual(['b', 'd', 'a']);
  });
});

describe('satisfação', () => {
  it('classifica as faixas de NPS', () => {
    expect(classificarNps(10)).toBe('promotor');
    expect(classificarNps(9)).toBe('promotor');
    expect(classificarNps(8)).toBe('neutro');
    expect(classificarNps(7)).toBe('neutro');
    expect(classificarNps(6)).toBe('detrator');
    expect(classificarNps(0)).toBe('detrator');
  });

  it('usa a medição mais recente e calcula a variação', () => {
    const s = saudeCliente(
      [
        avaliacao({ id: 'a1', data: '2026-01-10', nota: 6 }),
        avaliacao({ id: 'a2', data: '2026-05-10', nota: 9 }),
      ],
      'c1',
      REF,
    );
    expect(s.ultimaNota).toBe(9);
    expect(s.variacao).toBe(3);
    expect(s.classe).toBe('promotor');
    expect(s.media).toBe(7.5);
    expect(s.totalAvaliacoes).toBe(2);
  });

  it('trata conta nunca avaliada como sem leitura', () => {
    const s = saudeCliente([], 'c1', REF);
    expect(s.totalAvaliacoes).toBe(0);
    expect(s.ultimaNota).toBeUndefined();
    expect(s.semLeituraRecente).toBe(true);
  });

  it('acusa conta sem medição há mais de 180 dias', () => {
    const s = saudeCliente([avaliacao({ data: '2025-10-01' })], 'c1', REF);
    expect(s.semLeituraRecente).toBe(true);
  });

  it('não deixa avaliação de outro cliente vazar para a conta', () => {
    const s = saudeCliente([avaliacao({ cliente_id: 'c2', nota: 2 })], 'c1', REF);
    expect(s.totalAvaliacoes).toBe(0);
  });

  it('calcula o NPS da carteira como promotores menos detratores', () => {
    const carteira = npsDaCarteira(
      [
        avaliacao({ id: 'a1', cliente_id: 'c1', nota: 10 }),
        avaliacao({ id: 'a2', cliente_id: 'c2', nota: 9 }),
        avaliacao({ id: 'a3', cliente_id: 'c3', nota: 8 }),
        avaliacao({ id: 'a4', cliente_id: 'c4', nota: 4 }),
      ],
      [cliente({ id: 'c1' }), cliente({ id: 'c2' }), cliente({ id: 'c3' }), cliente({ id: 'c4' })],
      REF,
    );
    // 2 promotores, 1 neutro, 1 detrator em 4 → (50% − 25%) = 25.
    expect(carteira).toMatchObject({ promotores: 2, neutros: 1, detratores: 1, nps: 25 });
  });

  it('devolve NPS zero quando ninguém foi avaliado', () => {
    expect(npsDaCarteira([], [cliente()], REF).nps).toBe(0);
  });
});

describe('trilha de escalonamento', () => {
  it('ordena por nível e acumula o tempo de acionamento', () => {
    const trilha = trilhaEscalonamento(
      [
        nivel({ id: 'n3', nivel: 3, prazo_minutos: 120 }),
        nivel({ id: 'n1', nivel: 1, prazo_minutos: 30 }),
        nivel({ id: 'n2', nivel: 2, prazo_minutos: 60 }),
      ],
      'c1',
    );
    expect(trilha.map((d) => d.nivel.nivel)).toEqual([1, 2, 3]);
    // O primeiro degrau age na abertura; os seguintes somam os prazos anteriores.
    expect(trilha.map((d) => d.acionadoAposMinutos)).toEqual([0, 30, 90]);
  });

  it('ignora níveis de outro cliente', () => {
    const trilha = trilhaEscalonamento([nivel({ cliente_id: 'c2' })], 'c1');
    expect(trilha).toHaveLength(0);
  });

  it('formata minutos em horas legíveis', () => {
    expect(formatarMinutos(45)).toBe('45min');
    expect(formatarMinutos(60)).toBe('1h');
    expect(formatarMinutos(90)).toBe('1h 30min');
    expect(formatarMinutos(240)).toBe('4h');
  });
});

describe('contatos e lacunas de cadastro', () => {
  const contato = (over: Partial<ContatoCliente> = {}): ContatoCliente => ({
    id: 'ct1',
    cliente_id: 'c1',
    nome: 'João Pedro',
    cargo: 'Gerente de TI',
    email: 'joao@techcorp.com.br',
    telefone: '11 98800-1001',
    tipo: 'principal',
    principal: false,
    ...over,
  });

  it('prefere o contato marcado como principal', () => {
    const escolhido = contatoPrincipal(
      [
        contato({ id: 'ct1', nome: 'Secundário' }),
        contato({ id: 'ct2', nome: 'Principal', principal: true }),
      ],
      'c1',
    );
    expect(escolhido?.nome).toBe('Principal');
  });

  it('cai no primeiro contato quando nenhum está marcado', () => {
    expect(contatoPrincipal([contato({ nome: 'Único' })], 'c1')?.nome).toBe('Único');
  });

  it('aponta as lacunas que travam a operação num incidente', () => {
    const lacunas = lacunasDoCliente({
      cliente: cliente({ gerente_conta_id: '' }),
      contatos: [],
      niveis: [],
      equipesVinculadas: 0,
      servicosContratados: 0,
    });
    expect(lacunas).toHaveLength(5);
  });

  it('não aponta lacuna alguma numa conta completa', () => {
    const lacunas = lacunasDoCliente({
      cliente: cliente(),
      contatos: [contato({ principal: true })],
      niveis: [nivel()],
      equipesVinculadas: 2,
      servicosContratados: 3,
    });
    expect(lacunas).toHaveLength(0);
  });
});
