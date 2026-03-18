import { useState } from 'react';
import { clientes, colaboradores } from '@/data/mock';
import { Cliente } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Pencil } from 'lucide-react';

export default function ClientesPage() {
  const [data, setData] = useState<Cliente[]>(clientes);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = data.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => {
    setEditing({ id: `c${Date.now()}`, nome: '', id_whatsapp: '', escalation: '', responsavel_interno_id: '', ativo: true });
    setIsNew(true);
    setOpen(true);
  };

  const openEdit = (c: Cliente) => { setEditing({ ...c }); setIsNew(false); setOpen(true); };

  const save = () => {
    if (!editing) return;
    if (isNew) setData(prev => [...prev, editing]);
    else setData(prev => prev.map(c => c.id === editing.id ? editing : c));
    setOpen(false);
  };

  const getResponsavel = (id: string) => colaboradores.find(c => c.id === id)?.nome || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{data.length} registros</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Escalation</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className={!c.ativo ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="font-mono text-xs">{c.id_whatsapp}</TableCell>
                <TableCell className="text-sm">{c.escalation}</TableCell>
                <TableCell className="text-sm">{getResponsavel(c.responsavel_interno_id)}</TableCell>
                <TableCell><Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{isNew ? 'Novo Cliente' : 'Editar Cliente'}</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp ID</Label>
                <Input value={editing.id_whatsapp} onChange={e => setEditing({ ...editing, id_whatsapp: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Escalation</Label>
                <Input value={editing.escalation} onChange={e => setEditing({ ...editing, escalation: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
                <Label>Ativo</Label>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card shadow-sm overflow-hidden">{children}</div>;
}
