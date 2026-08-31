import { useMemo, useState } from 'react';
import { Download, Plus, Search, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { agora, dentroDoIntervalo, diasNoIntervalo, formatarData, hoje } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import { CLASSE_STATUS_SOLICITACAO, STATUS_SOLICITACAO, TIPO_AUSENCIA } from '@/lib/labels';
import type { Ausencia, StatusSolicitacao, TipoAusencia } from '@/types/sgo';

export default function AusenciasPage() {
  const { ausencias, funcionarios, plantoes, salvarAusencia } = useDados();
  const { sessao, ehRh, equipesVisiveis } = useAuth();

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoAusencia | 'todos'>('todos');
  const [emEdicao, setEmEdicao] = useState<Ausencia | null>(null);

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'desligado'), [funcionarios]);

  const visiveis = useMemo(() => {
    if (equipesVisiveis === null) return ausencias;
    if (!sessao) return [];
    const daEquipe = new Set(
      funcionarios.filter((f) => equipesVisiveis.includes(f.equipe_id)).map((f) => f.id),
    );
    return ausencias.filter(
      (a) => a.funcionario_id === sessao.funcionario.id || daEquipe.has(a.funcionario_id),
    );
  }, [ausencias, equipesVisiveis, funcionarios, sessao]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return visiveis
      .filter((a) => {
        const nome = funcionarios.find((f) => f.id === a.funcionario_id)?.nome ?? '';
        if (termo && !nome.toLowerCase().includes(termo) && !a.protocolo.toLowerCase().includes(termo))
          return false;
        if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false;
        return true;
      })
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  }, [visiveis, busca, filtroTipo, funcionarios]);

  const hojeIso = hoje();
  const ausentesHoje = visiveis.filter(
    (a) => a.status === 'aprovada' && dentroDoIntervalo(hojeIso, a.data_inicio, a.data_fim),
  );

  /** Plantões que a ausência em edição derruba — o gestor precisa ver antes. */
  const plantoesAfetados = useMemo(() => {
    if (!emEdicao?.data_inicio || !emEdicao.data_fim) return [];
    return plantoes.filter(
      (p) =>
        p.funcionario_id === emEdicao.funcionario_id &&
        p.status !== 'trocado' &&
        dentroDoIntervalo(p.data, emEdicao.data_inicio, emEdicao.data_fim),
    );
  }, [emEdicao, plantoes]);

  const abrirNova = () => {
    const alvo = ehRh ? ativos[0] : sessao?.funcionario;
    if (!alvo) return;
    setEmEdicao({
      id: novoId('au'),
      protocolo: proximoProtocolo('AUS', ausencias),
      funcionario_id: alvo.id,
      tipo: 'atestado',
      data_inicio: hojeIso,
      data_fim: hojeIso,
      dias: 1,
      justificativa: '',
      abonada: true,
      status: 'pendente',
      solicitado_por: sessao?.funcionario.id ?? 'sistema',
      solicitado_em: agora(),
    });
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.data_inicio || !emEdicao.data_fim) return toast.error('Informe o período.');
    if (emEdicao.data_fim < emEdicao.data_inicio)
      return toast.error('A data final não pode ser anterior à inicial.');
    if (emEdicao.justificativa.trim().length < 5)
      return toast.error('Descreva a justificativa.');

    salvarAusencia({
      ...emEdicao,
      dias: diasNoIntervalo(emEdicao.data_inicio, emEdicao.data_fim),
      justificativa: emEdicao.justificativa.trim(),
    });
    toast.success(`Ausência ${emEdicao.protocolo} registrada.`);
    setEmEdicao(null);
  };

  const exportar = () =>
    baixarCsv(`ausencias-${hojeIso}`, filtradas, [
      { cabecalho: 'Protocolo', valor: (a) => a.protocolo },
      { cabecalho: 'Funcionário', valor: (a) => funcionarios.find((f) => f.id === a.funcionario_id)?.nome },
      { cabecalho: 'Tipo', valor: (a) => TIPO_AUSENCIA[a.tipo] },
      { cabecalho: 'Início', valor: (a) => formatarData(a.data_inicio) },
      { cabecalho: 'Fim', valor: (a) => formatarData(a.data_fim) },
      { cabecalho: 'Dias', valor: (a) => a.dias },
      { cabecalho: 'Abonada', valor: (a) => (a.abonada ? 'Sim' : 'Não') },
      { cabecalho: 'Situação', valor: (a) => STATUS_SOLICITACAO[a.status] },
      { cabecalho: 'Justificativa', valor: (a) => a.justificativa },
    ]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Ausências e afastamentos"
        descricao="Atestados, licenças, faltas e folgas compensatórias."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Registrar ausência
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Ausentes hoje" valor={ausentesHoje.length} icone={Stethoscope} tom="warning" />
        <Indicador
          rotulo="Aguardando decisão"
          valor={visiveis.filter((a) => a.status === 'pendente').length}
          icone={Stethoscope}
          tom="info"
        />
        <Indicador
          rotulo="Não abonadas"
          valor={visiveis.filter((a) => !a.abonada).length}
          icone={Stethoscope}
          tom="destructive"
          detalhe="Impactam a folha"
        />
        <Indicador
          rotulo="Dias no total"
          valor={visiveis.reduce((soma, a) => soma + a.dias, 0)}
          icone={Stethoscope}
          tom="primary"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Funcionário ou protocolo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as TipoAusencia | 'todos')}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.keys(TIPO_AUSENCIA) as TipoAusencia[]).map((t) => (
              <SelectItem key={t} value={t}>{TIPO_AUSENCIA[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden shadow-card">
        {filtradas.length === 0 ? (
          <EstadoVazio
            icone={Stethoscope}
            titulo="Nenhuma ausência registrada"
            descricao="Atestados e licenças aparecem aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="hidden sm:table-cell">Dias</TableHead>
                  <TableHead className="hidden lg:table-cell">Justificativa</TableHead>
                  <TableHead className="hidden md:table-cell">Folha</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((a) => {
                  const pessoa = funcionarios.find((f) => f.id === a.funcionario_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                          <span className="font-medium">{pessoa?.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{TIPO_AUSENCIA[a.tipo]}</TableCell>
                      <TableCell className="tabular text-sm">
                        {formatarData(a.data_inicio)} – {formatarData(a.data_fim)}
                      </TableCell>
                      <TableCell className="tabular hidden text-sm sm:table-cell">{a.dias}</TableCell>
                      <TableCell className="hidden max-w-[280px] truncate text-xs text-muted-foreground lg:table-cell">
                        {a.justificativa}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`text-xs ${a.abonada ? 'text-success-strong' : 'text-destructive'}`}>
                          {a.abonada ? 'Abonada' : 'Descontada'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <BadgeStatus
                          texto={STATUS_SOLICITACAO[a.status]}
                          classe={CLASSE_STATUS_SOLICITACAO[a.status]}
                          className="text-[10px]"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Registrar ausência</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4 pb-6">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <Select
                  value={emEdicao.funcionario_id}
                  disabled={!ehRh}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, funcionario_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ativos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={emEdicao.tipo}
                  onValueChange={(v) =>
                    setEmEdicao({
                      ...emEdicao,
                      tipo: v as TipoAusencia,
                      // Falta é o único tipo que, por padrão, desconta da folha.
                      abonada: v !== 'falta',
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_AUSENCIA) as TipoAusencia[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_AUSENCIA[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input
                    type="date"
                    value={emEdicao.data_inicio}
                    onChange={(e) => setEmEdicao({ ...emEdicao, data_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input
                    type="date"
                    value={emEdicao.data_fim}
                    onChange={(e) => setEmEdicao({ ...emEdicao, data_fim: e.target.value })}
                  />
                </div>
              </div>

              {emEdicao.data_inicio && emEdicao.data_fim && emEdicao.data_fim >= emEdicao.data_inicio && (
                <p className="tabular text-sm text-muted-foreground">
                  {diasNoIntervalo(emEdicao.data_inicio, emEdicao.data_fim)} dias corridos
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Justificativa</Label>
                <Textarea
                  rows={3}
                  value={emEdicao.justificativa}
                  onChange={(e) => setEmEdicao({ ...emEdicao, justificativa: e.target.value })}
                  placeholder="Descreva o motivo e o documento comprobatório, se houver."
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Abonada</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Desmarque para descontar os dias na folha.
                  </p>
                </div>
                <Switch
                  checked={emEdicao.abonada}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, abonada: v })}
                />
              </div>

              {plantoesAfetados.length > 0 && (
                <Aviso>
                  Esta ausência atinge {plantoesAfetados.length} plantão(ões) já escalado(s):{' '}
                  {plantoesAfetados.slice(0, 3).map((p) => formatarData(p.data)).join(', ')}
                  {plantoesAfetados.length > 3 && ' …'}. Reescale a cobertura em Plantões.
                </Aviso>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvar}>Registrar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
