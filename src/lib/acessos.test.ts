import { describe, expect, it } from 'vitest';
import { acessosAtivos } from '@/lib/acessos';
import type { SolicitacaoAcesso } from '@/types/sgo';

function solicitacao(over: Partial<SolicitacaoAcesso> = {}): SolicitacaoAcesso {
  return {
    id: over.id ?? 'sa1',
    protocolo: 'ACS-2601',
    status: 'aprovada',
    solicitado_por: 'f1',
    solicitado_em: '2026-01-10T10:00:00.000Z',
    funcionario_id: 'f1',
    sistema_id: 's1',
    tipo: 'concessao',
    nivel: 'leitura',
    justificativa: 'Rotina do cargo.',
    ...over,
  };
}

describe('acessosAtivos', () => {
  it('inclui sistema com concessão aprovada', () => {
    expect(acessosAtivos('f1', [solicitacao()])).toEqual([{ sistema_id: 's1', nivel: 'leitura' }]);
  });

  it('ignora solicitação pendente ou rejeitada — ainda não mudou nada', () => {
    const pendente = solicitacao({ id: 'sa1', status: 'pendente' });
    const rejeitada = solicitacao({ id: 'sa2', status: 'rejeitada' });
    expect(acessosAtivos('f1', [pendente, rejeitada])).toEqual([]);
  });

  it('revogação decidida depois da concessão remove o acesso', () => {
    const concedido = solicitacao({
      id: 'sa1',
      tipo: 'concessao',
      solicitado_em: '2026-01-10T10:00:00.000Z',
    });
    const revogado = solicitacao({
      id: 'sa2',
      tipo: 'revogacao',
      solicitado_em: '2026-02-01T10:00:00.000Z',
    });
    expect(acessosAtivos('f1', [concedido, revogado])).toEqual([]);
  });

  it('concessão nova depois de uma revogação antiga devolve o acesso', () => {
    const revogado = solicitacao({
      id: 'sa1',
      tipo: 'revogacao',
      solicitado_em: '2026-01-01T10:00:00.000Z',
    });
    const reconcedido = solicitacao({
      id: 'sa2',
      tipo: 'concessao',
      nivel: 'escrita',
      solicitado_em: '2026-03-01T10:00:00.000Z',
    });
    expect(acessosAtivos('f1', [revogado, reconcedido])).toEqual([
      { sistema_id: 's1', nivel: 'escrita' },
    ]);
  });

  it('não mistura acessos de outro funcionário ou outro sistema', () => {
    const doOutro = solicitacao({ id: 'sa1', funcionario_id: 'f2' });
    const outroSistema = solicitacao({ id: 'sa2', sistema_id: 's2', nivel: 'admin' });
    expect(acessosAtivos('f1', [doOutro, outroSistema])).toEqual([
      { sistema_id: 's2', nivel: 'admin' },
    ]);
  });
});
