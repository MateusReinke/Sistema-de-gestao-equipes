import { useMemo, useState } from 'react';
import { Download, FileClock, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados } from '@/data/store';
import { formatarDataHora, hoje } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import type { AcaoAuditoria } from '@/types/sgo';

const ROTULO_ACAO: Record<AcaoAuditoria, string> = {
  criou: 'Criou',
  atualizou: 'Atualizou',
  removeu: 'Removeu',
  aprovou: 'Aprovou',
  rejeitou: 'Rejeitou',
  cancelou: 'Cancelou',
};

const CLASSE_ACAO: Record<AcaoAuditoria, string> = {
  criou: 'bg-success/15 text-success-strong border-success/30',
  atualizou: 'bg-info/15 text-info-strong border-info/30',
  removeu: 'bg-destructive/15 text-destructive border-destructive/30',
  aprovou: 'bg-success/15 text-success-strong border-success/30',
  rejeitou: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelou: 'bg-muted text-muted-foreground border-border',
};

export default function AuditoriaPage() {
  const { auditoria, restaurarSeed } = useDados();
  const [busca, setBusca] = useState('');
  const [filtroAcao, setFiltroAcao] = useState<AcaoAuditoria | 'todas'>('todas');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return auditoria.filter((e) => {
      if (filtroAcao !== 'todas' && e.acao !== filtroAcao) return false;
      if (!termo) return true;
      return `${e.ator_nome} ${e.entidade} ${e.descricao}`.toLowerCase().includes(termo);
    });
  }, [auditoria, busca, filtroAcao]);

  const exportar = () =>
    baixarCsv(`auditoria-${hoje()}`, filtrados, [
      { cabecalho: 'Data/hora', valor: (e) => formatarDataHora(e.em) },
      { cabecalho: 'Usuário', valor: (e) => e.ator_nome },
      { cabecalho: 'Ação', valor: (e) => ROTULO_ACAO[e.acao] },
      { cabecalho: 'Entidade', valor: (e) => e.entidade },
      { cabecalho: 'Registro', valor: (e) => e.entidade_id },
      { cabecalho: 'Descrição', valor: (e) => e.descricao },
    ]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Trilha de auditoria"
        descricao="Quem alterou o quê, e quando. Mantém os 500 eventos mais recentes."
        acoes={
          <>
            <Button variant="outline" onClick={exportar} disabled={filtrados.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar dados de exemplo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar a base de demonstração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os cadastros, solicitações e a própria trilha de auditoria voltam ao
                    estado inicial. Como os dados ficam no navegador, esta ação não pode ser
                    desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      restaurarSeed();
                      toast.success('Base restaurada.');
                    }}
                  >
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Usuário, entidade ou descrição..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroAcao} onValueChange={(v) => setFiltroAcao(v as AcaoAuditoria | 'todas')}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            {(Object.keys(ROTULO_ACAO) as AcaoAuditoria[]).map((a) => (
              <SelectItem key={a} value={a}>{ROTULO_ACAO[a]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden shadow-card">
        {filtrados.length === 0 ? (
          <EstadoVazio
            icone={FileClock}
            titulo="Nenhum evento registrado"
            descricao="As alterações feitas no sistema aparecem aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Quem</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="hidden sm:table-cell">Entidade</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular whitespace-nowrap text-xs text-muted-foreground">
                      {formatarDataHora(e.em)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar nome={e.ator_nome} tamanho="sm" />
                        <span className="text-sm">{e.ator_nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BadgeStatus
                        texto={ROTULO_ACAO[e.acao]}
                        classe={CLASSE_ACAO[e.acao]}
                        className="text-[10px]"
                      />
                    </TableCell>
                    <TableCell className="hidden text-sm capitalize sm:table-cell">
                      {e.entidade}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.descricao}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
