import { useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { DIAS_SEMANA, duracaoTurnoHoras, formatarData, hoje } from '@/lib/date';
import { TIPO_ESCALA } from '@/lib/labels';
import type { Escala, TipoEscala } from '@/types/sgo';

export default function EscalasPage() {
  const { escalas, escalaDetalhes, escalaFuncionarios, funcionarios, salvarEscala } = useDados();
  const { podeGerenciar } = useAuth();

  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<Escala | null>(null);
  const [ehNova, setEhNova] = useState(false);

  const hojeIso = hoje();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return escalas.filter(
      (e) => e.nome.toLowerCase().includes(termo) || e.descricao.toLowerCase().includes(termo),
    );
  }, [escalas, busca]);

  const abrirNova = () => {
    setEmEdicao({ id: novoId('esc'), nome: '', tipo: '5x2', descricao: '', ativo: true });
    setEhNova(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome da escala.');
    salvarEscala({ ...emEdicao, nome: emEdicao.nome.trim() });
    toast.success(ehNova ? 'Escala criada.' : 'Escala atualizada.');
    setEmEdicao(null);
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Escalas"
        descricao="Modelos de turno e quem está vinculado a cada um."
        acoes={
          podeGerenciar && (
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Nova escala
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar escalas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtradas.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio icone={CalendarClock} titulo="Nenhuma escala encontrada" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtradas.map((esc) => {
            const detalhes = escalaDetalhes
              .filter((d) => d.escala_id === esc.id)
              .sort((a, b) => a.dia_semana - b.dia_semana);
            const vinculos = escalaFuncionarios.filter(
              (v) => v.escala_id === esc.id && v.data_fim >= hojeIso,
            );
            const cargaSemanal = detalhes.reduce(
              (soma, d) => soma + duracaoTurnoHoras(d.hora_inicio, d.hora_fim),
              0,
            );

            return (
              <Card key={esc.id} className={`shadow-card ${!esc.ativo ? 'opacity-60' : ''}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                      <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{esc.nome}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">{esc.descricao}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <BadgeStatus
                      texto={TIPO_ESCALA[esc.tipo]}
                      classe="bg-primary/10 text-primary border-primary/25"
                      className="text-[10px]"
                    />
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEmEdicao({ ...esc });
                          setEhNova(false);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="tabular">
                      <strong className="text-foreground">{cargaSemanal}h</strong> por semana
                    </span>
                    <span className="tabular">
                      <strong className="text-foreground">{vinculos.length}</strong> vinculado(s)
                    </span>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Turnos
                    </p>
                    {detalhes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem horários definidos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {detalhes.map((d) => (
                          <span
                            key={d.id}
                            className="tabular rounded border bg-muted px-2 py-0.5 text-[11px]"
                          >
                            {DIAS_SEMANA[d.dia_semana]} {d.hora_inicio}–{d.hora_fim}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Vinculados
                    </p>
                    {vinculos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguém vinculado atualmente.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {vinculos.map((v) => {
                          const pessoa = funcionarios.find((f) => f.id === v.funcionario_id);
                          return (
                            <div key={v.id} className="flex items-center gap-2">
                              <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                              <span className="min-w-0 flex-1 truncate text-sm">{pessoa?.nome}</span>
                              <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                                até {formatarData(v.data_fim)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{ehNova ? 'Nova escala' : 'Editar escala'}</SheetTitle>
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
                <Label>Tipo</Label>
                <Select
                  value={emEdicao.tipo}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo: v as TipoEscala })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_ESCALA) as TipoEscala[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_ESCALA[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={emEdicao.descricao}
                  placeholder="Ex.: Turno diurno 07h–19h em dias alternados"
                  onChange={(e) => setEmEdicao({ ...emEdicao, descricao: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Escala ativa</Label>
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
