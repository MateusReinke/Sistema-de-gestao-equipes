import { useMemo, useState } from 'react';
import { Building2, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import type { Cliente } from '@/types/sgo';

export default function ClientesPage() {
  const { clientes, funcionarios, equipes, salvarCliente } = useDados();
  const { podeGerenciar } = useAuth();

  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<Cliente | null>(null);
  const [ehNovo, setEhNovo] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes.filter((c) => c.nome.toLowerCase().includes(termo));
  }, [clientes, busca]);

  const responsavel = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';
  const equipesDoCliente = (id: string) => equipes.filter((e) => e.cliente_id === id);

  const abrirNovo = () => {
    setEmEdicao({
      id: novoId('c'),
      nome: '',
      id_whatsapp: '',
      escalation: '',
      responsavel_interno_id: funcionarios.find((f) => f.status !== 'desligado')?.id ?? '',
      sla_resposta_min: 30,
      ativo: true,
    });
    setEhNovo(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome do cliente.');
    if (emEdicao.sla_resposta_min <= 0) return toast.error('O SLA deve ser maior que zero.');

    salvarCliente({ ...emEdicao, nome: emEdicao.nome.trim() });
    toast.success(ehNovo ? 'Cliente cadastrado.' : 'Cliente atualizado.');
    setEmEdicao(null);
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Clientes"
        descricao={`${clientes.filter((c) => c.ativo).length} contratos ativos de ${clientes.length}`}
        acoes={
          podeGerenciar && (
            <Button onClick={abrirNovo}>
              <Plus className="mr-2 h-4 w-4" /> Novo cliente
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden shadow-card">
        {filtrados.length === 0 ? (
          <EstadoVazio icone={Building2} titulo="Nenhum cliente encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden lg:table-cell">Equipes</TableHead>
                  <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                  <TableHead className="hidden xl:table-cell">Escalonamento</TableHead>
                  <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id} className={!c.ativo ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {equipesDoCliente(c.id).map((e) => (
                          <span
                            key={e.id}
                            className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {e.nome}
                          </span>
                        ))}
                        {equipesDoCliente(c.id).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular hidden text-xs md:table-cell">{c.id_whatsapp}</TableCell>
                    <TableCell className="hidden max-w-[220px] truncate text-xs xl:table-cell">
                      {c.escalation}
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {responsavel(c.responsavel_interno_id)}
                    </TableCell>
                    <TableCell className="tabular text-sm">{c.sla_resposta_min} min</TableCell>
                    <TableCell>
                      <BadgeStatus
                        texto={c.ativo ? 'Ativo' : 'Inativo'}
                        classe={
                          c.ativo
                            ? 'bg-success/15 text-success-strong border-success/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }
                        className="text-[10px]"
                      />
                    </TableCell>
                    <TableCell>
                      {podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEmEdicao({ ...c });
                            setEhNovo(false);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{ehNovo ? 'Novo cliente' : 'Editar cliente'}</SheetTitle>
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
                <Label>ID do WhatsApp</Label>
                <Input
                  value={emEdicao.id_whatsapp}
                  placeholder="5511990000000"
                  onChange={(e) => setEmEdicao({ ...emEdicao, id_whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contato de escalonamento</Label>
                <Input
                  value={emEdicao.escalation}
                  placeholder="Nome — cargo"
                  onChange={(e) => setEmEdicao({ ...emEdicao, escalation: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável interno</Label>
                <Select
                  value={emEdicao.responsavel_interno_id}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, responsavel_interno_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {funcionarios
                      .filter((f) => f.status !== 'desligado')
                      .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>SLA de resposta (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  value={emEdicao.sla_resposta_min}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, sla_resposta_min: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Contrato ativo</Label>
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
