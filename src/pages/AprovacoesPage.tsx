import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Filter, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { usePendencias } from '@/hooks/usePendencias';
import { conflitosDeEquipe } from '@/lib/rh';
import { formatarDataHora } from '@/lib/date';
import {
  CLASSE_STATUS_SOLICITACAO,
  CLASSE_TIPO_PENDENCIA,
  STATUS_SOLICITACAO,
  TIPO_PENDENCIA,
} from '@/lib/labels';
import type { Pendencia, StatusSolicitacao, TipoPendencia } from '@/types/sgo';

type Decisao = Extract<StatusSolicitacao, 'aprovada' | 'rejeitada'>;

export default function AprovacoesPage() {
  const { decidir, funcionarios, ferias } = useDados();
  const { podeAprovar } = useAuth();
  const [aba, setAba] = useState<StatusSolicitacao>('pendente');
  const [filtroTipo, setFiltroTipo] = useState<TipoPendencia | 'todos'>('todos');
  const [emDecisao, setEmDecisao] = useState<{ pendencia: Pendencia; decisao: Decisao } | null>(null);
  const [observacao, setObservacao] = useState('');

  const { pendencias } = usePendencias(aba);

  const lista = useMemo(
    () => (filtroTipo === 'todos' ? pendencias : pendencias.filter((p) => p.tipo === filtroTipo)),
    [pendencias, filtroTipo],
  );

  const contagemPorTipo = useMemo(() => {
    const mapa = { ferias: 0, ausencia: 0, acesso: 0, troca: 0 } as Record<TipoPendencia, number>;
    pendencias.forEach((p) => (mapa[p.tipo] += 1));
    return mapa;
  }, [pendencias]);

  const abrirDecisao = (pendencia: Pendencia, decisao: Decisao) => {
    setEmDecisao({ pendencia, decisao });
    setObservacao('');
  };

  const confirmar = () => {
    if (!emDecisao) return;
    const { pendencia, decisao } = emDecisao;

    // Rejeição sem justificativa deixa o solicitante sem saber o motivo.
    if (decisao === 'rejeitada' && observacao.trim().length < 5) {
      toast.error('Descreva o motivo da rejeição.');
      return;
    }

    decidir(pendencia.tipo, pendencia.id, decisao, observacao.trim() || undefined);
    toast.success(
      decisao === 'aprovada'
        ? `${pendencia.protocolo} aprovada.`
        : `${pendencia.protocolo} rejeitada.`,
    );
    setEmDecisao(null);
  };

  /**
   * Contexto extra por tipo. Em férias, mostrar quem mais da equipe estará
   * fora no mesmo período é a informação que evita aprovar um furo de escala.
   */
  const contexto = (p: Pendencia) => {
    if (p.tipo !== 'ferias') return null;
    const registro = ferias.find((f) => f.id === p.id);
    if (!registro) return null;

    const conflitos = conflitosDeEquipe(
      {
        funcionario_id: registro.funcionario_id,
        data_inicio: registro.data_inicio,
        data_fim: registro.data_fim,
        id: registro.id,
      },
      { funcionarios, ferias },
    );
    if (conflitos.length === 0) return null;

    return (
      <Aviso tom="warning">
        Mesmo período de {conflitos.map((c) => c.nome).join(', ')} — mesma equipe.
      </Aviso>
    );
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Central de Aprovações"
        descricao="Férias, ausências, acessos e trocas de plantão numa fila só."
      />

      {!podeAprovar && (
        <Aviso tom="info">
          Seu perfil acompanha as solicitações, mas a decisão cabe ao RH ou à administração.
        </Aviso>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={aba} onValueChange={(v) => setAba(v as StatusSolicitacao)}>
          <TabsList>
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="aprovada">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejeitada">Rejeitadas</TabsTrigger>
            <TabsTrigger value="concluida">Concluídas</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoPendencia | 'todos')}>
          <SelectTrigger className="w-full sm:w-56">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos ({pendencias.length})</SelectItem>
            {(Object.keys(TIPO_PENDENCIA) as TipoPendencia[]).map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_PENDENCIA[t]} ({contagemPorTipo[t]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {lista.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio
            icone={ClipboardCheck}
            titulo={aba === 'pendente' ? 'Fila zerada' : 'Nada por aqui'}
            descricao={
              aba === 'pendente'
                ? 'Nenhuma solicitação aguardando decisão.'
                : `Nenhuma solicitação ${STATUS_SOLICITACAO[aba].toLowerCase()}.`
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {lista.map((p) => {
            const pessoa = funcionarios.find((f) => f.id === p.funcionario_id);
            return (
              <Card key={`${p.tipo}-${p.id}`} className="shadow-card">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <Avatar nome={pessoa?.nome ?? '?'} />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{pessoa?.nome}</span>
                      <BadgeStatus
                        texto={TIPO_PENDENCIA[p.tipo]}
                        classe={CLASSE_TIPO_PENDENCIA[p.tipo]}
                        className="text-[10px]"
                      />
                      <BadgeStatus
                        texto={STATUS_SOLICITACAO[p.status]}
                        classe={CLASSE_STATUS_SOLICITACAO[p.status]}
                        className="text-[10px]"
                      />
                      <span className="tabular text-[11px] text-muted-foreground">
                        {p.protocolo}
                      </span>
                    </div>

                    <p className="text-sm font-medium">{p.titulo}</p>
                    <p className="text-sm text-muted-foreground">{p.detalhe}</p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Solicitado em {formatarDataHora(p.solicitado_em)}
                    </p>

                    {contexto(p)}
                  </div>

                  {p.status === 'pendente' && podeAprovar && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => abrirDecisao(p, 'rejeitada')}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                      </Button>
                      <Button size="sm" onClick={() => abrirDecisao(p, 'aprovada')}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={emDecisao !== null} onOpenChange={(v) => !v && setEmDecisao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {emDecisao?.decisao === 'aprovada' ? 'Aprovar solicitação' : 'Rejeitar solicitação'}
            </DialogTitle>
            <DialogDescription>
              {emDecisao?.pendencia.protocolo} — {emDecisao?.pendencia.titulo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação {emDecisao?.decisao === 'rejeitada' && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={
                emDecisao?.decisao === 'aprovada'
                  ? 'Opcional — fica registrado no histórico.'
                  : 'Explique o motivo para quem solicitou.'
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmDecisao(null)}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              variant={emDecisao?.decisao === 'rejeitada' ? 'destructive' : 'default'}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
