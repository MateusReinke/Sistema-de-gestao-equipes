/**
 * Consultas de alerta de uma integração de monitoramento.
 *
 * Uma consulta é um filtro nomeado sobre os problemas do Zabbix, amarrado a um
 * cliente. É o que responde "como está o ambiente do cliente X" — e o que pode
 * ser liberado para o próprio cliente enxergar.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Eye, Loader2, Pencil, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  FILTRO_PADRAO,
  SEVERIDADES,
  normalizarFiltro,
  resumirFiltro,
  rotuloSeveridade,
  type FiltroAlerta,
} from '@/lib/integracoes';
import { ErroApi } from '@/data/api';
import {
  useAcoesConsulta,
  useAlertas,
  useGruposDeHost,
  type ConsultaAlerta,
  type Integracao,
} from '@/data/integracoes';
import { useDados } from '@/data/store';
import { Aviso, CampoForm, EstadoVazio } from '@/components/comum';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatarDataHora } from '@/lib/date';
import { cn } from '@/lib/utils';

const SEM_CLIENTE = '__interna__';

interface Props {
  integracao: Integracao;
  consultas: ConsultaAlerta[];
}

export function ConsultasAlerta({ integracao, consultas }: Props) {
  const { clientes } = useDados();
  const { remover } = useAcoesConsulta();

  const [editando, setEditando] = useState<ConsultaAlerta | null>(null);
  const [criando, setCriando] = useState(false);
  const [previa, setPrevia] = useState<ConsultaAlerta | null>(null);

  const nomeCliente = (id: string | null) =>
    id ? (clientes.find((c) => c.id === id)?.nome ?? 'cliente removido') : null;

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">Consultas de alerta</h4>
          <p className="text-xs text-muted-foreground">
            Filtros salvos que mostram o estado do ambiente de cada cliente.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCriando(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova consulta
        </Button>
      </div>

      {consultas.length === 0 ? (
        <div className="rounded-lg border border-dashed">
          <EstadoVazio
            icone={TriangleAlert}
            titulo="Nenhuma consulta ainda"
            descricao="Crie uma para acompanhar o ambiente de um cliente."
          />
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {consultas.map((consulta) => (
            <li key={consulta.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{consulta.nome}</span>
                  {nomeCliente(consulta.cliente_id) && (
                    <Badge variant="outline">{nomeCliente(consulta.cliente_id)}</Badge>
                  )}
                  {consulta.visivel_para_cliente && <Badge variant="secondary">Visível ao cliente</Badge>}
                  {!consulta.ativo && <Badge variant="outline">Inativa</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {resumirFiltro(normalizarFiltro(consulta.filtro))}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPrevia(consulta)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Prévia
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditando(consulta)}>
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Editar {consulta.nome}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!confirm(`Remover a consulta “${consulta.nome}”?`)) return;
                    remover.mutate(consulta.id, {
                      onSuccess: () => toast.success('Consulta removida.'),
                      onError: () => toast.error('Não foi possível remover.'),
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  <span className="sr-only">Remover {consulta.nome}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DialogoConsulta
        aberto={criando || editando !== null}
        integracao={integracao}
        consulta={editando}
        aoFechar={() => {
          setCriando(false);
          setEditando(null);
        }}
      />

      <DialogoPrevia consulta={previa} aoFechar={() => setPrevia(null)} />
    </div>
  );
}

/* ------------------------------------------------------------- formulário */

function DialogoConsulta({
  aberto,
  integracao,
  consulta,
  aoFechar,
}: {
  aberto: boolean;
  integracao: Integracao;
  consulta: ConsultaAlerta | null;
  aoFechar: () => void;
}) {
  const { clientes } = useDados();
  const { criar, atualizar } = useAcoesConsulta();

  const [nome, setNome] = useState('');
  const [clienteId, setClienteId] = useState<string>(SEM_CLIENTE);
  const [visivel, setVisivel] = useState(false);
  const [filtro, setFiltro] = useState<FiltroAlerta>(FILTRO_PADRAO);
  const [erro, setErro] = useState<string | null>(null);

  // Só busca grupos quando o diálogo abre: é uma chamada à rede do cliente.
  const grupos = useGruposDeHost(integracao.id, aberto);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setNome(consulta?.nome ?? '');
    setClienteId(consulta?.cliente_id ?? SEM_CLIENTE);
    setVisivel(consulta?.visivel_para_cliente ?? false);
    setFiltro(normalizarFiltro(consulta?.filtro));
  }, [aberto, consulta]);

  const temCliente = clienteId !== SEM_CLIENTE;
  const salvando = criar.isPending || atualizar.isPending;

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);

    const dados = {
      integracao_id: integracao.id,
      nome: nome.trim(),
      filtro,
      cliente_id: temCliente ? clienteId : null,
      visivel_para_cliente: temCliente && visivel,
    };

    const aoDarErro = (e: unknown) =>
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar a consulta.');

    if (consulta) {
      atualizar.mutate(
        { id: consulta.id, ...dados },
        {
          onSuccess: () => {
            toast.success('Consulta salva.');
            aoFechar();
          },
          onError: aoDarErro,
        },
      );
    } else {
      criar.mutate(dados, {
        onSuccess: () => {
          toast.success('Consulta criada.');
          aoFechar();
        },
        onError: aoDarErro,
      });
    }
  };

  const alternarGrupo = (id: string) =>
    setFiltro((f) => ({
      ...f,
      grupos: f.grupos.includes(id) ? f.grupos.filter((g) => g !== id) : [...f.grupos, id],
    }));

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{consulta ? 'Editar consulta' : 'Nova consulta de alerta'}</DialogTitle>
          <DialogDescription>
            O resultado é buscado ao vivo em {integracao.nome} sempre que a consulta é aberta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          {erro && <Aviso tom="destructive">{erro}</Aviso>}

          <CampoForm rotulo="Nome da consulta">
            {(id) => (
              <Input
                id={id}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ambiente crítico"
                autoFocus
              />
            )}
          </CampoForm>

          <CampoForm
            rotulo="Cliente"
            dica="Define de quem é o ambiente. Sem cliente, a consulta é uma visão interna."
          >
            {(id) => (
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_CLIENTE}>Visão interna (sem cliente)</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CampoForm>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="min-w-0">
              <Label htmlFor="visivel-cliente" className="text-sm font-medium">
                Liberar para o cliente
              </Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {temCliente
                  ? 'O cliente poderá ver estes alertas do próprio ambiente.'
                  : 'Escolha um cliente acima para poder liberar.'}
              </p>
            </div>
            <Switch
              id="visivel-cliente"
              checked={temCliente && visivel}
              disabled={!temCliente}
              onCheckedChange={setVisivel}
            />
          </div>

          <CampoForm rotulo="Severidade mínima">
            {(id) => (
              <Select
                value={String(filtro.severidade_minima)}
                onValueChange={(v) => setFiltro((f) => ({ ...f, severidade_minima: Number(v) }))}
              >
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERIDADES.map((s) => (
                    <SelectItem key={s.valor} value={String(s.valor)}>
                      {s.rotulo} ou acima
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CampoForm>

          <div className="space-y-1.5">
            <Label>Grupos de host</Label>
            {grupos.isLoading && <Skeleton className="h-20" />}
            {grupos.isError && (
              <Aviso tom="warning">
                Não foi possível listar os grupos — teste a conexão da integração. A consulta pode
                ser salva sem recorte de grupo.
              </Aviso>
            )}
            {grupos.data && grupos.data.length > 0 && (
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border p-2.5">
                {grupos.data.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filtro.grupos.includes(g.id)}
                      onCheckedChange={() => alternarGrupo(g.id)}
                    />
                    {g.nome}
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Nenhum marcado significa todos os grupos que o token enxerga.
            </p>
          </div>

          <CampoForm
            rotulo="Tags"
            dica="Uma por linha, no formato tag:valor. Só a tag também vale."
          >
            {(id) => (
              <Input
                id={id}
                value={filtro.tags.map((t) => (t.valor ? `${t.tag}:${t.valor}` : t.tag)).join(', ')}
                onChange={(e) =>
                  setFiltro((f) => ({
                    ...f,
                    tags: e.target.value
                      .split(',')
                      .map((pedaco) => pedaco.trim())
                      .filter(Boolean)
                      .map((pedaco) => {
                        const [tag, ...resto] = pedaco.split(':');
                        return { tag: tag.trim(), valor: resto.join(':').trim() };
                      }),
                  }))
                }
                placeholder="servico:banco, ambiente:producao"
              />
            )}
          </CampoForm>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="nao-reconhecidos"
                checked={filtro.somente_nao_reconhecidos}
                onCheckedChange={(v) =>
                  setFiltro((f) => ({ ...f, somente_nao_reconhecidos: v === true }))
                }
              />
              <Label htmlFor="nao-reconhecidos" className="text-sm font-normal">
                Só não reconhecidos
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ocultar-suprimidos"
                checked={filtro.ocultar_suprimidos}
                onCheckedChange={(v) => setFiltro((f) => ({ ...f, ocultar_suprimidos: v === true }))}
              />
              <Label htmlFor="ocultar-suprimidos" className="text-sm font-normal">
                Esconder manutenção
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || !nome.trim()}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {consulta ? 'Salvar' : 'Criar consulta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ prévia */

const TOM_SEVERIDADE: Record<number, string> = {
  0: 'bg-muted text-muted-foreground',
  1: 'bg-info/15 text-info-strong',
  2: 'bg-info/15 text-info-strong',
  3: 'bg-warning/15 text-warning-strong',
  4: 'bg-destructive/15 text-destructive-strong',
  5: 'bg-destructive/25 text-destructive-strong',
};

function DialogoPrevia({
  consulta,
  aoFechar,
}: {
  consulta: ConsultaAlerta | null;
  aoFechar: () => void;
}) {
  const resultado = useAlertas(consulta?.id ?? null);

  return (
    <Dialog open={consulta !== null} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{consulta?.nome}</DialogTitle>
          <DialogDescription>
            {consulta && resumirFiltro(normalizarFiltro(consulta.filtro))}
          </DialogDescription>
        </DialogHeader>

        {resultado.isLoading && <Skeleton className="h-40" />}

        {resultado.isError && (
          <Aviso tom="destructive">
            {resultado.error instanceof ErroApi
              ? resultado.error.message
              : 'Não foi possível consultar o monitoramento.'}
          </Aviso>
        )}

        {resultado.data && resultado.data.alertas.length === 0 && (
          <EstadoVazio
            icone={TriangleAlert}
            titulo="Nenhum alerta agora"
            descricao="O ambiente está dentro do que este filtro considera normal."
          />
        )}

        {resultado.data && resultado.data.alertas.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {resultado.data.alertas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 p-3">
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium',
                    TOM_SEVERIDADE[a.severidade] ?? TOM_SEVERIDADE[0],
                  )}
                >
                  {rotuloSeveridade(a.severidade)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{a.nome}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.host} · desde {formatarDataHora(a.desde)}
                    {a.reconhecido && ' · reconhecido'}
                  </p>
                </div>
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map((t) => (
                      <Badge key={`${t.tag}${t.valor}`} variant="outline" className="text-[10px]">
                        {t.valor ? `${t.tag}: ${t.valor}` : t.tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {resultado.data && `Consultado em ${formatarDataHora(resultado.data.em)}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => resultado.refetch()}>
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', resultado.isFetching && 'animate-spin')} />
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
