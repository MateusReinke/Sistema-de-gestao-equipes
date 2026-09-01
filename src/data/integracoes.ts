/**
 * Acesso às integrações pela API.
 *
 * Os tipos aqui espelham o que as rotas devolvem. O campo `segredos` nunca
 * aparece: o servidor manda apenas `segredos_gravados`, a lista de chaves que
 * já estão cifradas no banco.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FiltroAlerta, TipoIntegracao } from '@/lib/integracoes';
import { api } from '@/data/api';

export interface Integracao {
  id: string;
  tipo: TipoIntegracao;
  nome: string;
  descricao: string;
  ativo: boolean;
  parametros: Record<string, string | number | undefined>;
  /** Chaves de segredo já cifradas no banco. */
  segredos_gravados: string[];
  ultimo_teste_em: string | null;
  ultimo_teste_ok: boolean | null;
  ultimo_teste_detalhe: string | null;
  criado_em: string;
  atualizado_em: string | null;
}

export interface ConsultaAlerta {
  id: string;
  integracao_id: string;
  nome: string;
  descricao: string;
  filtro: FiltroAlerta;
  cliente_id: string | null;
  visivel_para_cliente: boolean;
  ordem: number;
  ativo: boolean;
}

export interface Alerta {
  id: string;
  nome: string;
  severidade: number;
  desde: string;
  reconhecido: boolean;
  host: string;
  tags: { tag: string; valor: string }[];
}

export interface ResultadoTeste {
  ok: boolean;
  detalhe: string;
}

export interface GrupoHost {
  id: string;
  nome: string;
}

/** Erro de validação vindo da API, com a mensagem por campo. */
export interface ErroComCampos {
  erro: string;
  campos?: Record<string, string>;
}

export const chaveIntegracoes = ['admin', 'integracoes'] as const;
export const chaveConsultas = ['admin', 'consultas'] as const;

export function useIntegracoes() {
  return useQuery({
    queryKey: chaveIntegracoes,
    queryFn: () => api.get<Integracao[]>('/api/admin/integracoes'),
  });
}

export function useConsultas() {
  return useQuery({
    queryKey: chaveConsultas,
    queryFn: () => api.get<ConsultaAlerta[]>('/api/admin/consultas'),
  });
}

/** Grupos de host do Zabbix. Só busca quando a integração já foi testada. */
export function useGruposDeHost(integracaoId: string | null, habilitado: boolean) {
  return useQuery({
    queryKey: ['admin', 'integracoes', integracaoId, 'grupos'],
    queryFn: () => api.get<GrupoHost[]>(`/api/admin/integracoes/${integracaoId}/grupos`),
    enabled: Boolean(integracaoId) && habilitado,
    // A lista muda pouco e a chamada sai pela rede do cliente.
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAcoesIntegracao() {
  const cliente = useQueryClient();
  const recarregar = () => cliente.invalidateQueries({ queryKey: chaveIntegracoes });

  const criar = useMutation({
    mutationFn: (dados: {
      tipo: TipoIntegracao;
      nome: string;
      descricao: string;
      valores: Record<string, string | number | undefined>;
    }) => api.post<Integracao>('/api/admin/integracoes', dados),
    onSuccess: recarregar,
  });

  const atualizar = useMutation({
    mutationFn: ({ id, ...dados }: { id: string } & Record<string, unknown>) =>
      api.put<Integracao>(`/api/admin/integracoes/${id}`, dados),
    onSuccess: recarregar,
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.remover(`/api/admin/integracoes/${id}`),
    onSuccess: () => {
      recarregar();
      // As consultas caem junto por cascata no banco.
      cliente.invalidateQueries({ queryKey: chaveConsultas });
    },
  });

  const testar = useMutation({
    mutationFn: (id: string) => api.post<ResultadoTeste>(`/api/admin/integracoes/${id}/testar`),
    onSuccess: recarregar,
  });

  return { criar, atualizar, remover, testar };
}

export function useAcoesConsulta() {
  const cliente = useQueryClient();
  const recarregar = () => cliente.invalidateQueries({ queryKey: chaveConsultas });

  const criar = useMutation({
    mutationFn: (dados: Record<string, unknown>) =>
      api.post<ConsultaAlerta>('/api/admin/consultas', dados),
    onSuccess: recarregar,
  });

  const atualizar = useMutation({
    mutationFn: ({ id, ...dados }: { id: string } & Record<string, unknown>) =>
      api.put<ConsultaAlerta>(`/api/admin/consultas/${id}`, dados),
    onSuccess: recarregar,
  });

  const remover = useMutation({
    mutationFn: (id: string) => api.remover(`/api/admin/consultas/${id}`),
    onSuccess: recarregar,
  });

  return { criar, atualizar, remover };
}

/** Roda a consulta contra o monitoramento. Usada na prévia e no painel. */
export function useAlertas(consultaId: string | null) {
  return useQuery({
    queryKey: ['consultas', consultaId, 'alertas'],
    queryFn: () =>
      api.get<{ consulta: string; em: string; alertas: Alerta[] }>(
        `/api/consultas/${consultaId}/alertas`,
      ),
    enabled: Boolean(consultaId),
    retry: false,
  });
}
