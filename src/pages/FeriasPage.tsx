import { useState } from 'react';
import { ferias as initial, colaboradores } from '@/data/mock';
import { Ferias, StatusFerias } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil } from 'lucide-react';

const statusLabels: Record<StatusFerias, string> = { aprovado: 'Aprovado', pendente: 'Pendente', rejeitado: 'Rejeitado' };
const statusVariant = (s: StatusFerias) => {
  switch (s) { case 'aprovado': return 'default' as const; case 'pendente': return 'secondary' as const; case 'rejeitado': return 'destructive' as const; }
};

export default function FeriasPage() {
  const [data, setData] = useState<Ferias[]>(initial);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ferias | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const filtered = data.filter(f => {
    const colab = colaboradores.find(c => c.id === f.colaborador_id);
    return colab?.nome.toLowerCase().includes(search.toLowerCase());
  });

  const openNew = () => {
    setEditing({ id: `f${Date.now()}`, colaborador_id: colaboradores[0]?.id || '', data_inicio: '', data_fim: '', status: 'pendente' });
    setIsNew(true); setOpen(true);
  };
  const openEdit = (f: Ferias) => { setEditing({ ...f }); setIsNew(false); setOpen(true); };
  const save = () => {
    if (!editing) return;
    if (isNew) setData(prev => [...prev, editing]);
    else setData(prev => prev.map(f => f.id === editing.id ? editing : f));
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Férias</h1>
          <p className="text-sm text-muted-foreground">{data.length} registros de férias</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Registrar Férias</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por colaborador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
            ) : filtered.map(f => {
              const colab = colaboradores.find(c => c.id === f.colaborador_id);
              const dias = f.data_inicio && f.data_fim
                ? Math.ceil((new Date(f.data_fim).getTime() - new Date(f.data_inicio).getTime()) / 86400000) + 1
                : 0;
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{colab?.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{f.data_inicio}</TableCell>
                  <TableCell className="font-mono text-xs">{f.data_fim}</TableCell>
                  <TableCell className="font-mono text-sm">{dias}</TableCell>
                  <TableCell><Badge variant={statusVariant(f.status)}>{statusLabels[f.status]}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{isNew ? 'Registrar Férias' : 'Editar Férias'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={editing.colaborador_id} onValueChange={v => setEditing({ ...editing, colaborador_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{colaboradores.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={editing.data_inicio} onChange={e => setEditing({ ...editing, data_inicio: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={editing.data_fim} onChange={e => setEditing({ ...editing, data_fim: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v as StatusFerias })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
