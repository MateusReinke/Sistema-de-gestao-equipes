import { useState } from 'react';
import { equipes as initialEquipes, colaboradores, clientes } from '@/data/mock';
import { Equipe } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Pencil, Users } from 'lucide-react';

export default function EquipesPage() {
  const [data, setData] = useState<Equipe[]>(initialEquipes);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Equipe | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = data.filter(e => e.nome.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditing({ id: `eq${Date.now()}`, nome: '', ativo: true });
    setIsNew(true); setOpen(true);
  };
  const openEdit = (e: Equipe) => { setEditing({ ...e }); setIsNew(false); setOpen(true); };
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
          <h1 className="text-2xl font-bold">Equipes</h1>
          <p className="text-sm text-muted-foreground">{data.length} equipes cadastradas</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Equipe</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar equipes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(eq => {
          const membros = colaboradores.filter(c => c.equipe_id === eq.id && c.ativo);
          const cliente = clientes.find(c => c.id === eq.cliente_id);
          return (
            <Card key={eq.id} className={!eq.ativo ? 'opacity-50' : ''}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{eq.nome}</CardTitle>
                  {cliente && <p className="text-xs text-muted-foreground mt-1">{cliente.nome}</p>}
                </div>
                <div className="flex gap-1">
                  <Badge variant={eq.ativo ? 'default' : 'secondary'}>{eq.ativo ? 'Ativa' : 'Inativa'}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(eq)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{membros.length} colaborador{membros.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {membros.slice(0, 3).map(m => (
                    <p key={m.id} className="text-xs">{m.nome}</p>
                  ))}
                  {membros.length > 3 && <p className="text-xs text-muted-foreground">+{membros.length - 3} mais</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{isNew ? 'Nova Equipe' : 'Editar Equipe'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
                <Label>Ativa</Label>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
