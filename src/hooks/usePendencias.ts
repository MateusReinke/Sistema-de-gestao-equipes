import { useMemo } from 'react';
import { useDados } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import type { Pendencia, StatusSolicitacao } from '@/types/sgo';
import { formatarData } from '@/lib/date';
import { NIVEL_ACESSO, TIPO_ACESSO, TIPO_AUSENCIA } from '@/lib/labels';

/**
 * Normaliza férias, ausências, acessos e trocas de plantão numa lista única.
 *
 * É o que permite a Central de Aprovações tratar os quatro fluxos com a mesma
 * interface — o RH não precisa abrir quatro telas para saber o que decidir.
 * A lista já vem recortada pelo alcance do usuário: gestor só enxerga as
 * próprias equipes, colaborador só os próprios pedidos.
 */
export function usePendencias(status: StatusSolicitacao = 'pendente') {
  const {
    ferias,
    ausencias,
    solicitacoesAcesso,
    trocasPlantao,
    funcionarios,
    sistemas,
    plantoes,
  } = useDados();
  const { sessao, ehRh, equipesVisiveis } = useAuth();

  const todas = useMemo<Pendencia[]>(() => {
    const equipeDe = (id: string) => funcionarios.find((f) => f.id === id)?.equipe_id;
    const nomeDe = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';

    const deFerias: Pendencia[] = ferias
      .filter((f) => f.status === status)
      .map((f) => ({
        id: f.id,
        tipo: 'ferias',
        protocolo: f.protocolo,
        funcionario_id: f.funcionario_id,
        titulo: `Férias · ${f.dias} dias`,
        detalhe: `${formatarData(f.data_inicio)} a ${formatarData(f.data_fim)}${
          f.dias_abono > 0 ? ` · ${f.dias_abono} dias de abono` : ''
        }`,
        solicitado_em: f.solicitado_em,
        status: f.status,
        equipe_id: equipeDe(f.funcionario_id),
      }));

    const deAusencias: Pendencia[] = ausencias
      .filter((a) => a.status === status)
      .map((a) => ({
        id: a.id,
        tipo: 'ausencia',
        protocolo: a.protocolo,
        funcionario_id: a.funcionario_id,
        titulo: `${TIPO_AUSENCIA[a.tipo]} · ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`,
        detalhe: `${formatarData(a.data_inicio)} a ${formatarData(a.data_fim)} — ${a.justificativa}`,
        solicitado_em: a.solicitado_em,
        status: a.status,
        equipe_id: equipeDe(a.funcionario_id),
      }));

    const deAcessos: Pendencia[] = solicitacoesAcesso
      .filter((s) => s.status === status)
      .map((s) => ({
        id: s.id,
        tipo: 'acesso',
        protocolo: s.protocolo,
        funcionario_id: s.funcionario_id,
        titulo: `${TIPO_ACESSO[s.tipo]} · ${sistemas.find((x) => x.id === s.sistema_id)?.nome ?? '—'}`,
        detalhe: `Nível ${NIVEL_ACESSO[s.nivel].toLowerCase()} — ${s.justificativa}`,
        solicitado_em: s.solicitado_em,
        status: s.status,
        equipe_id: equipeDe(s.funcionario_id),
      }));

    const deTrocas: Pendencia[] = trocasPlantao
      .filter((t) => t.status === status)
      .map((t) => {
        const plantao = plantoes.find((p) => p.id === t.plantao_id);
        return {
          id: t.id,
          tipo: 'troca',
          protocolo: t.protocolo,
          funcionario_id: t.funcionario_id,
          titulo: `Troca de plantão com ${nomeDe(t.substituto_id)}`,
          detalhe: plantao
            ? `${formatarData(plantao.data)} · ${plantao.hora_inicio}–${plantao.hora_fim} — ${t.motivo}`
            : t.motivo,
          solicitado_em: t.solicitado_em,
          status: t.status,
          equipe_id: equipeDe(t.funcionario_id),
        };
      });

    return [...deFerias, ...deAusencias, ...deAcessos, ...deTrocas].sort((a, b) =>
      a.solicitado_em.localeCompare(b.solicitado_em),
    );
  }, [ferias, ausencias, solicitacoesAcesso, trocasPlantao, funcionarios, sistemas, plantoes, status]);

  const pendencias = useMemo(() => {
    if (ehRh) return todas;
    if (!sessao) return [];
    if (equipesVisiveis === null) return todas;
    // Gestor enxerga as próprias equipes; colaborador, apenas o que é dele.
    return todas.filter(
      (p) =>
        p.funcionario_id === sessao.funcionario.id ||
        (p.equipe_id !== undefined && equipesVisiveis.includes(p.equipe_id)),
    );
  }, [todas, ehRh, sessao, equipesVisiveis]);

  return { pendencias, todas };
}
