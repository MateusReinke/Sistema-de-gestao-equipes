import { useMemo, useState } from 'react';
import { Download, Palmtree, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import {
  calcularSaldoFerias,
  conflitosDeEquipe,
  periodoAquisitivoVigente,
  validarFerias,
} from '@/lib/rh';
import { agora, diasNoIntervalo, formatarData, hoje } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import { CLASSE_STATUS_SOLICITACAO, STATUS_SOLICITACAO } from '@/lib/labels';
import type { Ferias, StatusSolicitacao } from '@/types/sgo';

export default function FeriasPage() {
  const { ferias, funcionarios, equipes, salvarFerias } = useDados();
  const { sessao, ehRh, equipesVisiveis } = useAuth();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | 'todos'>('todos');
  const [emEdicao, setEmEdicao] = useState<Ferias | null>(null);

  const ativos = useMemo(
    () => funcionarios.filter((f) => f.status !== 'desligado'),
    [funcionarios],
  );

  /** Recorte por papel: gestor vê as equipes dele, colaborador vê o próprio. */
  const visiveis = useMemo(() => {
    if (equipesVisiveis === null) return ferias;
    if (!sessao) return [];
    const daEquipe = new Set(
      funcionarios.filter((f) => equipesVisiveis.includes(f.equipe_id)).map((f) => f.id),
    );
    return ferias.filter(
      (f) => f.funcionario_id === sessao.funcionario.id || daEquipe.has(f.funcionario_id),
    );
  }, [ferias, equipesVisiveis, funcionarios, sessao]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return visiveis
      .filter((f) => {
        const nome = funcionarios.find((x) => x.id === f.funcionario_id)?.nome ?? '';
        if (termo && !nome.toLowerCase().includes(termo) && !f.protocolo.toLowerCase().includes(termo))
          return false;
        if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false;
        return true;
      })
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  }, [visiveis, busca, filtroStatus, funcionarios]);

  /** Quem está com o período concessivo estourando ou já estourado. */
  const emRisco = useMemo(
    () =>
      ativos
        .map((f) => ({ funcionario: f, saldo: calcularSaldoFerias(f, ferias) }))
        .filter((r) => r.saldo.vencido || r.saldo.vencendo)
        .sort((a, b) => (a.saldo.diasAteVencer ?? 0) - (b.saldo.diasAteVencer ?? 0)),
    [ativos, ferias],
  );

  const emGozo = useMemo(() => {
    const hojeIso = hoje();
    return ferias.filter(
      (f) => f.status === 'aprovada' && f.data_inicio <= hojeIso && f.data_fim >= hojeIso,
    );
  }, [ferias]);

  const abrirNova = () => {
    const alvo = ehRh ? ativos[0] : sessao?.funcionario;
    if (!alvo) return;
    const periodo = periodoAquisitivoVigente(alvo.data_admissao);
    setEmEdicao({
      id: novoId('fe'),
      protocolo: proximoProtocolo('FER', ferias),
      funcionario_id: alvo.id,
      periodo_aquisitivo_inicio: periodo?.inicio ?? alvo.data_admissao,
      periodo_aquisitivo_fim: periodo?.fim ?? alvo.data_admissao,
      data_inicio: '',
      data_fim: '',
      dias: 0,
      dias_abono: 0,
      decimo_terceiro_antecipado: false,
      status: 'pendente',
      solicitado_por: sessao?.funcionario.id ?? 'sistema',
      solicitado_em: agora(),
    });
  };

  const validacao = useMemo(() => {
    if (!emEdicao || !emEdicao.data_inicio || !emEdicao.data_fim) return null;
    return validarFerias(
      {
        funcionario_id: emEdicao.funcionario_id,
        data_inicio: emEdicao.data_inicio,
        data_fim: emEdicao.data_fim,
        dias_abono: emEdicao.dias_abono,
        id: emEdicao.id,
      },
      { funcionarios, ferias },
    );
  }, [emEdicao, funcionarios, ferias]);

  const conflitos = useMemo(() => {
    if (!emEdicao || !emEdicao.data_inicio || !emEdicao.data_fim) return [];
    return conflitosDeEquipe(
      {
        funcionario_id: emEdicao.funcionario_id,
        data_inicio: emEdicao.data_inicio,
        data_fim: emEdicao.data_fim,
        id: emEdicao.id,
      },
      { funcionarios, ferias },
    );
  }, [emEdicao, funcionarios, ferias]);

  const salvar = () => {
    if (!emEdicao || !validacao) return toast.error('Informe o período das férias.');
    if (validacao.erros.length > 0) return toast.error(validacao.erros[0]);

    salvarFerias({ ...emEdicao, dias: diasNoIntervalo(emEdicao.data_inicio, emEdicao.data_fim) });
    toast.success(`Solicitação ${emEdicao.protocolo} registrada.`);
    setEmEdicao(null);
  };

  const exportar = () =>
    baixarCsv(`ferias-${hoje()}`, filtradas, [
      { cabecalho: 'Protocolo', valor: (f) => f.protocolo },
      { cabecalho: 'Funcionário', valor: (f) => funcionarios.find((x) => x.id === f.funcionario_id)?.nome },
      { cabecalho: 'Início', valor: (f) => formatarData(f.data_inicio) },
      { cabecalho: 'Fim', valor: (f) => formatarData(f.data_fim) },
      { cabecalho: 'Dias', valor: (f) => f.dias },
      { cabecalho: 'Abono', valor: (f) => f.dias_abono },
      { cabecalho: 'Período aquisitivo', valor: (f) => `${formatarData(f.periodo_aquisitivo_inicio)} a ${formatarData(f.periodo_aquisitivo_fim)}` },
      { cabecalho: 'Situação', valor: (f) => STATUS_SOLICITACAO[f.status] },
    ]);

  const saldoDoSelecionado = emEdicao
    ? calcularSaldoFerias(
        funcionarios.find((f) => f.id === emEdicao.funcionario_id)!,
        ferias.filter((f) => f.id !== emEdicao.id),
      )
    : null;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Férias"
        descricao="Saldo, programação e conformidade com a CLT."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Solicitar férias
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Em gozo agora" valor={emGozo.length} icone={Palmtree} tom="info" />
        <Indicador
          rotulo="Aguardando decisão"
          valor={visiveis.filter((f) => f.status === 'pendente').length}
          icone={Palmtree}
          tom="warning"
        />
        <Indicador
          rotulo="Vencendo em 90 dias"
          valor={emRisco.filter((r) => r.saldo.vencendo).length}
          icone={Palmtree}
          tom="warning"
        />
        <Indicador
          rotulo="Prazo vencido"
          valor={emRisco.filter((r) => r.saldo.vencido).length}
          icone={Palmtree}
          tom={emRisco.some((r) => r.saldo.vencido) ? 'destructive' : 'success'}
          detalhe="Férias em dobro"
        />
      </div>

      {ehRh && emRisco.length > 0 && (
        <Card className="border-warning/40 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Períodos concessivos em risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {emRisco.map(({ funcionario, saldo }) => (
              <div
                key={funcionario.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <Avatar nome={funcionario.nome} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{funcionario.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Admitido em {formatarData(funcionario.data_admissao)} ·{' '}
                    {equipes.find((e) => e.id === funcionario.equipe_id)?.nome}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-semibold">{saldo.saldo} dias</p>
                  <p
                    className={`text-xs ${saldo.vencido ? 'text-destructive' : 'text-warning-strong'}`}
                  >
                    {saldo.vencido
                      ? `vencido em ${formatarData(saldo.limiteConcessivo)}`
                      : `vence em ${formatarData(saldo.limiteConcessivo)}`}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusSolicitacao | 'todos')}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {(Object.keys(STATUS_SOLICITACAO) as StatusSolicitacao[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_SOLICITACAO[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden shadow-card">
        {filtradas.length === 0 ? (
          <EstadoVazio
            icone={Palmtree}
            titulo="Nenhuma solicitação de férias"
            descricao="Registre um período para começar."
            acao={<Button onClick={abrirNova}><Plus className="mr-2 h-4 w-4" /> Solicitar férias</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden sm:table-cell">Protocolo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="hidden md:table-cell">Dias</TableHead>
                  <TableHead className="hidden lg:table-cell">Aquisitivo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((f) => {
                  const pessoa = funcionarios.find((x) => x.id === f.funcionario_id);
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                          <span className="font-medium">{pessoa?.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular hidden text-xs text-muted-foreground sm:table-cell">
                        {f.protocolo}
                      </TableCell>
                      <TableCell className="tabular text-sm">
                        {formatarData(f.data_inicio)} – {formatarData(f.data_fim)}
                      </TableCell>
                      <TableCell className="tabular hidden text-sm md:table-cell">
                        {f.dias}
                        {f.dias_abono > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">+{f.dias_abono} abono</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular hidden text-xs text-muted-foreground lg:table-cell">
                        {formatarData(f.periodo_aquisitivo_inicio)} – {formatarData(f.periodo_aquisitivo_fim)}
                      </TableCell>
                      <TableCell>
                        <BadgeStatus
                          texto={STATUS_SOLICITACAO[f.status]}
                          classe={CLASSE_STATUS_SOLICITACAO[f.status]}
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
            <SheetTitle>Solicitar férias</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4 pb-6">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <Select
                  value={emEdicao.funcionario_id}
                  disabled={!ehRh}
                  onValueChange={(v) => {
                    const alvo = funcionarios.find((f) => f.id === v)!;
                    const periodo = periodoAquisitivoVigente(alvo.data_admissao);
                    setEmEdicao({
                      ...emEdicao,
                      funcionario_id: v,
                      periodo_aquisitivo_inicio: periodo?.inicio ?? alvo.data_admissao,
                      periodo_aquisitivo_fim: periodo?.fim ?? alvo.data_admissao,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ativos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {saldoDoSelecionado && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { rotulo: 'Direito', valor: saldoDoSelecionado.direito },
                    { rotulo: 'Usados', valor: saldoDoSelecionado.usados },
                    { rotulo: 'Saldo', valor: saldoDoSelecionado.saldo },
                  ].map((c) => (
                    <div key={c.rotulo} className="rounded-lg border p-3 text-center">
                      <p className="tabular text-xl font-bold">{c.valor}</p>
                      <p className="text-[11px] text-muted-foreground">{c.rotulo}</p>
                    </div>
                  ))}
                </div>
              )}

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

              {emEdicao.data_inicio && emEdicao.data_fim && (
                <p className="tabular text-sm text-muted-foreground">
                  {diasNoIntervalo(emEdicao.data_inicio, emEdicao.data_fim)} dias corridos
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Abono pecuniário (venda de dias)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={emEdicao.dias_abono}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, dias_abono: Number(e.target.value) || 0 })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Até 10 dias — 1/3 do período, conforme art. 143 da CLT.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Adiantar 13º salário</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Primeira parcela paga junto com as férias.
                  </p>
                </div>
                <Switch
                  checked={emEdicao.decimo_terceiro_antecipado}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, decimo_terceiro_antecipado: v })}
                />
              </div>

              {validacao?.erros.map((erro) => (
                <Aviso key={erro} tom="destructive">{erro}</Aviso>
              ))}
              {validacao?.alertas.map((alerta) => (
                <Aviso key={alerta}>{alerta}</Aviso>
              ))}
              {conflitos.length > 0 && (
                <Aviso>
                  Mesma equipe fora no período: {conflitos.map((c) => c.nome).join(', ')}.
                </Aviso>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={salvar}
                  disabled={!validacao || validacao.erros.length > 0}
                >
                  Enviar solicitação
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
