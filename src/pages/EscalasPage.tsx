import { useState } from 'react';
import { escalas as initial, escalaDetalhes, escalaColaboradores, colaboradores } from '@/data/mock';
import { Escala, TipoEscala } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, CalendarClock } from 'lucide-react';

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const tipoLabels: Record<TipoEscala, string> = { '12x36': '12×36', '5x2': '5×2', personalizada: 'Personalizada' };

export default function EscalasPage() {
  const [data, setData] = useState<Escala[]>(initial);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Escala | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = data.filter(e => e.nome.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditing({ id: `esc${Date.now()}`, nome: '', tipo: '5x2', descricao: '' });
    setIsNew(true); setOpen(true);
  };
  const openEdit = (e: Escala) => { setEditing({ ...e }); setIsNew(false); setOpen(true); };
  const save = () => {
    if (!editing) return;
    if (isNew) setData(prev => [...prev, editing]);
    else setData(prev => prev.map(e => e.id === editing.id ? editing : e));
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalas</h1>
          <p className="text-sm text-muted-foreground">{data.length} escalas configuradas</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Escala</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar escalas..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(esc => {
          const detalhes = escalaDetalhes.filter(d => d.escala_id === esc.id);
          const vinculados = escalaColaboradores.filter(ec => ec.escala_id === esc.id);
          return (
            <Card key={esc.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarClock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{esc.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{esc.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline">{tipoLabels[esc.tipo]}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(esc)}><Pencil className="h-3 w-3" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Horários:</p>
                  <div className="flex flex-wrap gap-1">
                    {detalhes.map(d => (
                      <Badge key={d.id} variant="secondary" className="text-xs font-mono">
                        {diasSemana[d.dia_semana]} {d.hora_inicio}–{d.hora_fim}
                      </Badge>
                    ))}
                    {detalhes.length === 0 && <span className="text-xs text-muted-foreground">Sem horários definidos</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Colaboradores ({vinculados.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {vinculados.map(ec => {
                      const col = colaboradores.find(c => c.id === ec.colaborador_id);
                      return <Badge key={ec.id} variant="outline" className="text-xs">{col?.nome}</Badge>;
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{isNew ? 'Nova Escala' : 'Editar Escala'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editing.tipo} onValueChange={v => setEditing({ ...editing, tipo: v as TipoEscala })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={editing.descricao} onChange={e => setEditing({ ...editing, descricao: e.target.value })} /></div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
