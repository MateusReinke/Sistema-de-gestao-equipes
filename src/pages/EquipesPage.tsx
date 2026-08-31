import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { equipesSemCobertura } from '@/lib/rh';
import { hoje } from '@/lib/date';
import type { Equipe } from '@/types/sgo';

export default function EquipesPage() {
  const {
    equipes,
    funcionarios,
    clientes,
    departamentos,
    plantoes,
    ferias,
    ausencias,
    salvarEquipe,
  } = useDados();
  const { podeGerenciar, equipesVisiveis } = useAuth();

  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<Equipe | null>(null);
  const [ehNova, setEhNova] = useState(false);

  const visiveis = useMemo(
    () => (equipesVisiveis === null ? equipes : equipes.filter((e) => equipesVisiveis.includes(e.id))),
    [equipes, equipesVisiveis],
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return visiveis.filter((e) => e.nome.toLowerCase().includes(termo));
  }, [visiveis, busca]);

  const descobertas = useMemo(
    () =>
      new Map(
        equipesSemCobertura({ equipes, funcionarios, plantoes, ferias, ausencias }).map((s) => [
          s.equipe.id,
          s,
        ]),
      ),
    [equipes, funcionarios, plantoes, ferias, ausencias],
  );

  const hojeIso = hoje();

  const abrirNova = () => {
    setEmEdicao({
      id: novoId('eq'),
      nome: '',
      cobertura_minima: 1,
      ativo: true,
    });
    setEhNova(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome da equipe.');
    if (emEdicao.cobertura_minima < 0) return toast.error('A cobertura mínima não pode ser negativa.');

    salvarEquipe({ ...emEdicao, nome: emEdicao.nome.trim() });
    toast.success(ehNova ? 'Equipe criada.' : 'Equipe atualizada.');
    setEmEdicao(null);
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Equipes"
        descricao={`${visiveis.filter((e) => e.ativo).length} equipes ativas de ${visiveis.length}`}
        acoes={
          podeGerenciar && (
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Nova equipe
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar equipes..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtradas.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio icone={UsersRound} titulo="Nenhuma equipe encontrada" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((eq) => {
            const membros = funcionarios.filter(
              (f) => f.equipe_id === eq.id && f.status !== 'desligado',
            );
            const cliente = clientes.find((c) => c.id === eq.cliente_id);
            const gestor = funcionarios.find((f) => f.id === eq.gestor_id);
            const departamento = departamentos.find((d) => d.id === eq.departamento_id);
            const emFerias = membros.filter((m) =>
              ferias.some(
                (f) =>
                  f.funcionario_id === m.id &&
                  f.status === 'aprovada' &&
                  f.data_inicio <= hojeIso &&
                  f.data_fim >= hojeIso,
              ),
            );
            const furo = descobertas.get(eq.id);

            return (
              <Card key={eq.id} className={`shadow-card ${!eq.ativo ? 'opacity-60' : ''}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{eq.nome}</CardTitle>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[departamento?.nome, cliente?.nome].filter(Boolean).join(' · ') || 'Sem vínculo'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <BadgeStatus
                      texto={eq.ativo ? 'Ativa' : 'Inativa'}
                      classe={
                        eq.ativo
                          ? 'bg-success/15 text-success-strong border-success/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }
                      className="text-[10px]"
                    />
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEmEdicao({ ...eq });
                          setEhNova(false);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {furo && (
                    <Aviso tom="destructive">
                      Cobertura hoje: {furo.escalados}/{eq.cobertura_minima} — faltam {furo.faltam}.
                    </Aviso>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { rotulo: 'Membros', valor: membros.length },
                      { rotulo: 'De férias', valor: emFerias.length },
                      { rotulo: 'Cobertura mín.', valor: eq.cobertura_minima },
                    ].map((c) => (
                      <div key={c.rotulo} className="rounded-lg border py-2">
                        <p className="tabular text-lg font-bold leading-none">{c.valor}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{c.rotulo}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Gestor
                    </p>
                    {gestor ? (
                      <div className="flex items-center gap-2">
                        <Avatar nome={gestor.nome} tamanho="sm" />
                        <span className="truncate text-sm">{gestor.nome}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem gestor definido</p>
                    )}
                  </div>

                  {membros.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Time
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {membros.slice(0, 8).map((m) => (
                          <Avatar key={m.id} nome={m.nome} tamanho="sm" />
                        ))}
                        {membros.length > 8 && (
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                            +{membros.length - 8}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{ehNova ? 'Nova equipe' : 'Editar equipe'}</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={emEdicao.nome}
                  onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select
                  value={emEdicao.departamento_id ?? 'nenhum'}
                  onValueChange={(v) =>
                    setEmEdicao({ ...emEdicao, departamento_id: v === 'nenhum' ? undefined : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem departamento</SelectItem>
                    {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cliente atendido</Label>
                <Select
                  value={emEdicao.cliente_id ?? 'nenhum'}
                  onValueChange={(v) =>
                    setEmEdicao({ ...emEdicao, cliente_id: v === 'nenhum' ? undefined : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Equipe interna</SelectItem>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Gestor</Label>
                <Select
                  value={emEdicao.gestor_id ?? 'nenhum'}
                  onValueChange={(v) =>
                    setEmEdicao({ ...emEdicao, gestor_id: v === 'nenhum' ? undefined : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem gestor</SelectItem>
                    {funcionarios
                      .filter((f) => f.status !== 'desligado')
                      .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cobertura mínima diária</Label>
                <Input
                  type="number"
                  min={0}
                  value={emEdicao.cobertura_minima}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, cobertura_minima: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Quantas pessoas precisam estar escaladas por dia. O sistema alerta quando falta.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Equipe ativa</Label>
                <Switch
                  checked={emEdicao.ativo}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, ativo: v })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvar}>Salvar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
