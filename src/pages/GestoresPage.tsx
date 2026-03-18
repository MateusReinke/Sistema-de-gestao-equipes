import { useState } from 'react';
import { gestores as initial, equipes } from '@/data/mock';
import { Gestor } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Pencil, UserCog } from 'lucide-react';

export default function GestoresPage() {
  const [data, setData] = useState<Gestor[]>(initial);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Gestor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = data.filter(g => g.nome.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditing({ id: `g${Date.now()}`, nome: '', email: '', equipe_ids: [] });
    setIsNew(true); setOpen(true);
  };
  const openEdit = (g: Gestor) => { setEditing({ ...g, equipe_ids: [...g.equipe_ids] }); setIsNew(false); setOpen(true); };
  const save = () => {
    if (!editing) return;
    if (isNew) setData(prev => [...prev, editing]);
    else setData(prev => prev.map(g => g.id === editing.id ? editing : g));
    setOpen(false);
  };
  const toggleEquipe = (eqId: string) => {
    if (!editing) return;
    const ids = editing.equipe_ids.includes(eqId)
      ? editing.equipe_ids.filter(id => id !== eqId)
      : [...editing.equipe_ids, eqId];
    setEditing({ ...editing, equipe_ids: ids });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestores</h1>
          <p className="text-sm text-muted-foreground">{data.length} gestores</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Gestor</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar gestores..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(g => (
          <Card key={g.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{g.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground">{g.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(g)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">Equipes gerenciadas:</p>
              <div className="flex flex-wrap gap-1">
                {g.equipe_ids.map(eqId => {
                  const eq = equipes.find(e => e.id === eqId);
                  return <Badge key={eqId} variant="outline" className="text-xs">{eq?.nome || eqId}</Badge>;
                })}
                {g.equipe_ids.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma equipe vinculada</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{isNew ? 'Novo Gestor' : 'Editar Gestor'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Equipes</Label>
                <div className="space-y-2 border rounded-md p-3">
                  {equipes.filter(e => e.ativo).map(eq => (
                    <div key={eq.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={editing.equipe_ids.includes(eq.id)}
                        onCheckedChange={() => toggleEquipe(eq.id)}
                      />
                      <span className="text-sm">{eq.nome}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
