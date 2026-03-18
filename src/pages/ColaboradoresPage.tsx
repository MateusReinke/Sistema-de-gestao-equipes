import { useState } from 'react';
import { colaboradores as initial, equipes, ferias } from '@/data/mock';
import { Colaborador, ModeloTrabalho, TipoContrato } from '@/types/sgo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil } from 'lucide-react';

const modeloLabels: Record<ModeloTrabalho, string> = { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' };
const contratoLabels: Record<TipoContrato, string> = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário' };

export default function ColaboradoresPage() {
  const [data, setData] = useState<Colaborador[]>(initial);
  const [search, setSearch] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('all');
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const emFerias = new Set(ferias.filter(f => f.status === 'aprovado' && f.data_inicio <= today && f.data_fim >= today).map(f => f.colaborador_id));

  const filtered = data.filter(c => {
    if (!c.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEquipe !== 'all' && c.equipe_id !== filterEquipe) return false;
    return true;
  });

  const openNew = () => {
    setEditing({ id: `col${Date.now()}`, nome: '', email: '', telefone: '', equipe_id: equipes[0]?.id || '', tipo_contrato: 'clt', modelo_trabalho: 'presencial', ativo: true });
    setIsNew(true); setOpen(true);
  };
  const openEdit = (c: Colaborador) => { setEditing({ ...c }); setIsNew(false); setOpen(true); };
  const save = () => {
    if (!editing) return;
    if (isNew) setData(prev => [...prev, editing]);
    else setData(prev => prev.map(c => c.id === editing.id ? editing : c));
    setOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{data.filter(c => c.ativo).length} ativos de {data.length}</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Colaborador</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEquipe} onValueChange={setFilterEquipe}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas equipes</SelectItem>
            {equipes.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum colaborador encontrado.</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className={!c.ativo ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {c.nome}
                  {emFerias.has(c.id) && <Badge variant="secondary" className="ml-2 text-[10px]">Férias</Badge>}
                </TableCell>
                <TableCell className="text-sm">{c.email}</TableCell>
                <TableCell className="text-sm">{equipes.find(e => e.id === c.equipe_id)?.nome}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{contratoLabels[c.tipo_contrato]}</Badge></TableCell>
                <TableCell className="text-xs">{modeloLabels[c.modelo_trabalho]}</TableCell>
                <TableCell><Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{isNew ? 'Novo Colaborador' : 'Editar Colaborador'}</SheetTitle></SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div className="space-y-2"><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={editing.telefone} onChange={e => setEditing({ ...editing, telefone: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Equipe</Label>
                <Select value={editing.equipe_id} onValueChange={v => setEditing({ ...editing, equipe_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{equipes.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo Contrato</Label>
                <Select value={editing.tipo_contrato} onValueChange={v => setEditing({ ...editing, tipo_contrato: v as TipoContrato })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(contratoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modelo Trabalho</Label>
                <Select value={editing.modelo_trabalho} onValueChange={v => setEditing({ ...editing, modelo_trabalho: v as ModeloTrabalho })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(modeloLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
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
