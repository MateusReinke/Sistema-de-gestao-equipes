/**
 * Regras sobre o que uma pessoa tem de acesso concedido agora.
 *
 * Não existe uma tabela de "acesso concedido" — só o histórico de
 * solicitações (concessão, alteração, revogação). O que a pessoa tem hoje é
 * derivado: por sistema, olha a solicitação decidida mais recente e vê se
 * foi revogação ou não.
 */
import type { NivelAcesso, SolicitacaoAcesso } from '@/types/sgo';

export interface AcessoAtivo {
  sistema_id: string;
  nivel: NivelAcesso;
}

/** Solicitações que efetivamente mudam o que a pessoa tem — as demais (pendente, rejeitada, cancelada) não. */
function decidida(s: SolicitacaoAcesso): boolean {
  return s.status === 'aprovada' || s.status === 'concluida';
}

/**
 * Acessos que `funcionarioId` tem hoje, um por sistema.
 *
 * Para cada sistema em que a pessoa já teve alguma solicitação decidida,
 * olha só a mais recente: se foi revogação, ela não tem mais acesso àquele
 * sistema; senão, tem — no nível daquela solicitação.
 */
export function acessosAtivos(
  funcionarioId: string,
  solicitacoes: SolicitacaoAcesso[],
): AcessoAtivo[] {
  const porSistema = new Map<string, SolicitacaoAcesso[]>();
  for (const s of solicitacoes) {
    if (s.funcionario_id !== funcionarioId || !decidida(s)) continue;
    const lista = porSistema.get(s.sistema_id) ?? [];
    lista.push(s);
    porSistema.set(s.sistema_id, lista);
  }

  const ativos: AcessoAtivo[] = [];
  for (const [sistemaId, lista] of porSistema) {
    const maisRecente = lista.reduce((a, b) => (a.solicitado_em > b.solicitado_em ? a : b));
    if (maisRecente.tipo !== 'revogacao') {
      ativos.push({ sistema_id: sistemaId, nivel: maisRecente.nivel });
    }
  }
  return ativos;
}
