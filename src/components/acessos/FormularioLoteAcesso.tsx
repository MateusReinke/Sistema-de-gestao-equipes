/**
 * Pedido de acesso em lote — o que o RH realmente preenche numa admissão
 * (vários sistemas de uma vez, não um formulário por sistema) ou num
 * desligamento (revogar tudo que a pessoa tinha, de uma vez).
 *
 * Continua gerando uma `SolicitacaoAcesso` por sistema — mesmo fluxo de
 * aprovação de sempre — só empacota a repetição que o RH faria à mão.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Aviso } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { acessosAtivos } from '@/lib/acessos';
import { agora } from '@/lib/date';
import { NIVEL_ACESSO } from '@/lib/labels';
import type { NivelAcesso, SolicitacaoAcesso } from '@/types/sgo';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  modo: 'concessao' | 'revogacao';
}

export function FormularioLoteAcesso({ aberto, aoFechar, modo }: Props) {
  const { funcionarios, sistemas, solicitacoesAcesso, salvarSolicitacaoAcesso } = useDados();
  const { sessao, ehRh } = useAuth();

  const [funcionarioId, setFuncionarioId] = useState('');
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [niveis, setNiveis] = useState<Record<string, NivelAcesso>>({});
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);

  const candidatos =
    modo === 'concessao' ? funcionarios.filter((f) => f.status !== 'desligado') : funcionarios;

  const ativosDaPessoa = funcionarioId ? acessosAtivos(funcionarioId, solicitacoesAcesso) : [];
  const opcoes =
    modo === 'concessao'
      ? sistemas.filter((s) => s.ativo).map((s) => ({ sistema_id: s.id, nivel: 'leitura' as NivelAcesso }))
      : ativosDaPessoa;

  // Reabrir precisa recomeçar do zero — senão sobra marcação da vez anterior.
  useEffect(() => {
    if (!aberto) return;
    setFuncionarioId(ehRh ? '' : sessao?.funcionario.id ?? '');
    setMarcados({});
    setNiveis({});
    setJustificativa(modo === 'revogacao' ? 'Desligamento — revogação de todos os acessos.' : '');
  }, [aberto, modo, ehRh, sessao]);

  // Trocar de funcionário no modo revogação muda quais sistemas existem para marcar.
  useEffect(() => {
    if (modo !== 'revogacao') return;
    setMarcados(Object.fromEntries(ativosDaPessoa.map((a) => [a.sistema_id, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId, modo]);

  const nomeDoSistema = (id: string) => sistemas.find((s) => s.id === id)?.nome ?? '—';
  const selecionados = opcoes.filter((o) => marcados[o.sistema_id]);

  const enviar = async () => {
    if (!funcionarioId) return toast.error('Selecione o funcionário.');
    if (selecionados.length === 0) return toast.error('Marque ao menos um sistema.');
    if (justificativa.trim().length < 10) {
      return toast.error('Descreva a justificativa de negócio (mín. 10 caracteres).');
    }

    setEnviando(true);
    try {
      // `proximoProtocolo` olha pro que já existe — ao mandar várias de uma
      // vez, a lista só chega atualizada depois que o servidor responde e a
      // base recarrega, então sem isto todas sairiam com o mesmo número.
      // Cresce a cópia local a cada envio para as próximas contarem com ela.
      const jaEnviadas = [...solicitacoesAcesso];
      for (const item of selecionados) {
        const nova: SolicitacaoAcesso = {
          id: novoId('sa'),
          protocolo: proximoProtocolo('ACS', jaEnviadas),
          funcionario_id: funcionarioId,
          sistema_id: item.sistema_id,
          tipo: modo,
          nivel: modo === 'concessao' ? niveis[item.sistema_id] ?? item.nivel : item.nivel,
          justificativa: justificativa.trim(),
          status: 'pendente',
          solicitado_por: sessao?.funcionario.id ?? 'sistema',
          solicitado_em: agora(),
        };
        jaEnviadas.push(nova);
        await salvarSolicitacaoAcesso(nova);
      }
      toast.success(
        `${selecionados.length} solicitação(ões) de ${modo === 'concessao' ? 'acesso' : 'revogação'} enviada(s).`,
      );
      aoFechar();
    } catch {
      // erro de alguma gravação já foi avisado pelo contexto de dados —
      // o que já foi enviado fica enviado, não há o que desfazer aqui.
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {modo === 'concessao' ? 'Acessos de admissão' : 'Revogar acessos (desligamento)'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4 pb-6">
          <div className="space-y-1.5">
            <Label>Funcionário</Label>
            <Select value={funcionarioId} disabled={!ehRh} onValueChange={setFuncionarioId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {candidatos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{modo === 'concessao' ? 'Sistemas a conceder' : 'Acessos ativos a revogar'}</Label>
            {!funcionarioId ? (
              <p className="text-xs text-muted-foreground">Selecione o funcionário para listar os sistemas.</p>
            ) : opcoes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {modo === 'concessao'
                  ? 'Nenhum sistema ativo no catálogo.'
                  : 'Esta pessoa não tem nenhum acesso ativo registrado.'}
              </p>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                {opcoes.map((o) => (
                  <div key={o.sistema_id} className="flex items-center justify-between gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <Checkbox
                        checked={marcados[o.sistema_id] ?? false}
                        onCheckedChange={(v) =>
                          setMarcados({ ...marcados, [o.sistema_id]: v === true })
                        }
                      />
                      <span className="truncate">{nomeDoSistema(o.sistema_id)}</span>
                    </label>
                    {modo === 'concessao' && marcados[o.sistema_id] && (
                      <Select
                        value={niveis[o.sistema_id] ?? o.nivel}
                        onValueChange={(v) => setNiveis({ ...niveis, [o.sistema_id]: v as NivelAcesso })}
                      >
                        <SelectTrigger className="h-8 w-32 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(NIVEL_ACESSO) as NivelAcesso[]).map((n) => (
                            <SelectItem key={n} value={n}>{NIVEL_ACESSO[n]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {modo === 'revogacao' && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {NIVEL_ACESSO[o.nivel]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Justificativa</Label>
            <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
          </div>

          <Aviso tom="info">
            Cada sistema marcado vira uma solicitação de {modo === 'concessao' ? 'concessão' : 'revogação'}{' '}
            independente, na fila de Aprovações — nenhum acesso muda antes de decidida.
          </Aviso>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={aoFechar}>Cancelar</Button>
            <Button className="flex-1" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando...' : `Enviar (${selecionados.length})`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
