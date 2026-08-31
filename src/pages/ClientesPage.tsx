import { useMemo, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Download,
  FileWarning,
  Gauge,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Avatar,
  Aviso,
  BadgeStatus,
  CabecalhoPagina,
  CampoForm,
  EstadoVazio,
  Indicador,
} from '@/components/comum';
import { FichaCliente } from '@/components/clientes/FichaCliente';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import {
  contratosParaRenovar,
  contatoPrincipal,
  npsDaCarteira,
  saudeCliente,
  situacaoContrato,
} from '@/lib/clientes';
import { formatarData, hoje, humanizarPrazo, somarMeses } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import {
  CATEGORIA_SERVICO,
  CLASSE_NPS,
  CLASSE_STATUS_CONTRATO,
  REGIME_ATENDIMENTO,
  ROTULO_NPS,
  STATUS_CONTRATO,
  formatarMoeda,
} from '@/lib/labels';
import type {
  CategoriaServico,
  Cliente,
  RegimeAtendimento,
  Servico,
  StatusContrato,
} from '@/types/sgo';

export default function ClientesPage() {
  const dados = useDados();
  const { podeGerenciar } = useAuth();

  const {
    clientes,
    funcionarios,
    contatosCliente,
    servicos,
    servicosContratados,
    atendimentoEquipes,
    avaliacoesCliente,
    salvarCliente,
    salvarServico,
  } = dados;

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusContrato | 'todos'>('todos');
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Cliente | null>(null);
  const [ehNovo, setEhNovo] = useState(false);
  const [servicoEmEdicao, setServicoEmEdicao] = useState<Servico | null>(null);

  const hojeIso = hoje();
  const nomeDe = (id?: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return clientes
      .filter((c) => {
        if (
          termo &&
          ![c.nome, c.razao_social, c.cnpj, c.contrato_numero, c.segmento].some((campo) =>
            campo.toLowerCase().includes(termo),
          )
        ) {
          return false;
        }
        if (filtroStatus !== 'todos' && c.status_contrato !== filtroStatus) return false;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [clientes, busca, filtroStatus]);

  const ativos = clientes.filter((c) => c.status_contrato !== 'encerrado');
  const aRenovar = useMemo(() => contratosParaRenovar(clientes, hojeIso), [clientes, hojeIso]);
  const carteira = useMemo(
    () => npsDaCarteira(avaliacoesCliente, ativos, hojeIso),
    [avaliacoesCliente, ativos, hojeIso],
  );
  const receitaMensal = ativos.reduce((soma, c) => soma + c.valor_mensal, 0);

  const detalhe = clientes.find((c) => c.id === detalheId) ?? null;

  const abrirNovo = () => {
    setEmEdicao({
      id: novoId('c'),
      nome: '',
      razao_social: '',
      cnpj: '',
      id_whatsapp: '',
      segmento: '',
      gerente_conta_id: funcionarios.find((f) => f.status !== 'desligado')?.id ?? '',
      contrato_numero: '',
      contrato_inicio: hojeIso,
      contrato_fim: somarMeses(hojeIso, 12),
      renovacao_automatica: true,
      aviso_previa_dias: 60,
      valor_mensal: 0,
      status_contrato: 'ativo',
      regime: '8x5',
      sla_resposta_min: 60,
      sla_resolucao_horas: 8,
      ativo: true,
    });
    setEhNovo(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome do cliente.');
    if (!emEdicao.gerente_conta_id) return toast.error('Defina o gerente de conta.');
    if (!emEdicao.contrato_inicio || !emEdicao.contrato_fim)
      return toast.error('Informe o período de vigência.');
    if (emEdicao.contrato_fim <= emEdicao.contrato_inicio)
      return toast.error('A renovação deve ser posterior ao início da vigência.');
    if (emEdicao.sla_resposta_min <= 0) return toast.error('O SLA de resposta deve ser maior que zero.');

    salvarCliente({ ...emEdicao, nome: emEdicao.nome.trim() });
    toast.success(ehNovo ? 'Cliente cadastrado.' : 'Cliente atualizado.');
    setEmEdicao(null);
  };

  const salvarCatalogo = () => {
    if (!servicoEmEdicao) return;
    if (!servicoEmEdicao.nome.trim()) return toast.error('Informe o nome do serviço.');
    salvarServico({ ...servicoEmEdicao, nome: servicoEmEdicao.nome.trim() });
    toast.success('Serviço salvo no catálogo.');
    setServicoEmEdicao(null);
  };

  const exportar = () =>
    baixarCsv(`clientes-${hojeIso}`, filtrados, [
      { cabecalho: 'Cliente', valor: (c) => c.nome },
      { cabecalho: 'Razão social', valor: (c) => c.razao_social },
      { cabecalho: 'CNPJ', valor: (c) => c.cnpj },
      { cabecalho: 'Segmento', valor: (c) => c.segmento },
      { cabecalho: 'Contrato', valor: (c) => c.contrato_numero },
      { cabecalho: 'Início', valor: (c) => formatarData(c.contrato_inicio) },
      { cabecalho: 'Renovação', valor: (c) => formatarData(c.contrato_fim) },
      { cabecalho: 'Dias p/ renovar', valor: (c) => situacaoContrato(c, hojeIso).diasParaVencer },
      { cabecalho: 'Renovação automática', valor: (c) => (c.renovacao_automatica ? 'Sim' : 'Não') },
      { cabecalho: 'Aviso prévio (dias)', valor: (c) => c.aviso_previa_dias },
      { cabecalho: 'Situação', valor: (c) => STATUS_CONTRATO[c.status_contrato] },
      { cabecalho: 'Valor mensal', valor: (c) => c.valor_mensal },
      { cabecalho: 'Regime', valor: (c) => REGIME_ATENDIMENTO[c.regime] },
      { cabecalho: 'SLA resposta (min)', valor: (c) => c.sla_resposta_min },
      { cabecalho: 'SLA resolução (h)', valor: (c) => c.sla_resolucao_horas },
      { cabecalho: 'Gerente de conta', valor: (c) => nomeDe(c.gerente_conta_id) },
      { cabecalho: 'Responsável técnico', valor: (c) => nomeDe(c.responsavel_tecnico_id) },
      {
        cabecalho: 'Contato principal',
        valor: (c) => contatoPrincipal(contatosCliente, c.id)?.nome,
      },
      { cabecalho: 'Equipes', valor: (c) => atendimentoEquipes.filter((a) => a.cliente_id === c.id).length },
      { cabecalho: 'Serviços', valor: (c) => servicosContratados.filter((s) => s.cliente_id === c.id).length },
      { cabecalho: 'NPS', valor: (c) => saudeCliente(avaliacoesCliente, c.id, hojeIso).ultimaNota },
    ]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Contratos, contatos, escalonamento, equipes designadas e satisfação."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            {podeGerenciar && (
              <Button onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" /> Novo cliente
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Contratos vigentes" valor={ativos.length} icone={Building2} tom="primary" />
        <Indicador
          rotulo="Receita mensal"
          valor={formatarMoeda(receitaMensal)}
          icone={Wallet}
          tom="success"
          detalhe={`${formatarMoeda(receitaMensal * 12)} ao ano`}
        />
        <Indicador
          rotulo="A renovar"
          valor={aRenovar.length}
          icone={CalendarClock}
          tom={aRenovar.length > 0 ? 'warning' : 'success'}
          detalhe="Próximos 90 dias"
        />
        <Indicador
          rotulo="NPS da carteira"
          valor={carteira.nps}
          icone={Gauge}
          tom={carteira.nps >= 50 ? 'success' : carteira.nps >= 0 ? 'warning' : 'destructive'}
          detalhe={`${carteira.promotores} promotores · ${carteira.detratores} detratores`}
        />
      </div>

      {aRenovar.length > 0 && (
        <Card className="border-warning/40 shadow-card">
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <FileWarning className="h-4 w-4 text-warning" />
              Contratos que precisam de decisão
            </p>
            {aRenovar.map(({ cliente, situacao }) => (
              <Aviso key={cliente.id} tom={situacao.vencido ? 'destructive' : 'warning'}>
                <button
                  type="button"
                  className="text-left underline-offset-2 hover:underline"
                  onClick={() => setDetalheId(cliente.id)}
                >
                  <strong>{cliente.nome}</strong>
                </button>{' '}
                {situacao.vencido ? (
                  // Vencido: o prazo de aviso já não é acionável, então some.
                  `está com a vigência encerrada desde ${formatarData(cliente.contrato_fim)}. Formalize a renovação ou o encerramento.`
                ) : (
                  <>
                    {`renova ${humanizarPrazo(cliente.contrato_fim)} (${formatarData(cliente.contrato_fim)}). `}
                    {situacao.avisoVencido
                      ? cliente.renovacao_automatica
                        ? 'Prazo de aviso prévio encerrado — renova automaticamente.'
                        : 'Prazo de aviso prévio encerrado sem comunicação formal.'
                      : `Aviso prévio de não-renovação até ${formatarData(situacao.limiteAviso)}.`}
                  </>
                )}
              </Aviso>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          <TabsTrigger value="servicos">Catálogo de serviços</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome, razão social, CNPJ, contrato ou segmento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filtroStatus}
              onValueChange={(v) => setFiltroStatus(v as StatusContrato | 'todos')}
            >
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {(Object.keys(STATUS_CONTRATO) as StatusContrato[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONTRATO[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden shadow-card">
            {filtrados.length === 0 ? (
              <EstadoVazio
                icone={Building2}
                titulo="Nenhum cliente encontrado"
                descricao="Ajuste a busca ou os filtros."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="hidden lg:table-cell">Gerente de conta</TableHead>
                      <TableHead className="hidden xl:table-cell">Contato principal</TableHead>
                      <TableHead className="hidden md:table-cell">Equipes</TableHead>
                      <TableHead>Renovação</TableHead>
                      <TableHead className="hidden sm:table-cell">Mensal</TableHead>
                      <TableHead className="hidden lg:table-cell">NPS</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((c) => {
                      const situacao = situacaoContrato(c, hojeIso);
                      const saude = saudeCliente(avaliacoesCliente, c.id, hojeIso);
                      const principal = contatoPrincipal(contatosCliente, c.id);
                      const equipesDaConta = atendimentoEquipes.filter(
                        (a) => a.cliente_id === c.id,
                      ).length;

                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer"
                          onClick={() => setDetalheId(c.id)}
                        >
                          <TableCell>
                            <p className="font-medium">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.segmento} · {c.contrato_numero}
                            </p>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <Avatar nome={nomeDe(c.gerente_conta_id)} tamanho="sm" />
                              <span className="truncate text-sm">{nomeDe(c.gerente_conta_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {principal ? (
                              <div className="min-w-0">
                                <p className="truncate text-sm">{principal.nome}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {principal.cargo}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-destructive">Não cadastrado</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular hidden text-sm md:table-cell">
                            {equipesDaConta}
                          </TableCell>
                          <TableCell>
                            <p className="tabular text-sm">{formatarData(c.contrato_fim)}</p>
                            <p
                              className={`text-[11px] ${
                                situacao.vencido
                                  ? 'font-medium text-destructive'
                                  : situacao.aRenovar
                                    ? 'text-warning-strong'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {situacao.vencido
                                ? `vencido há ${Math.abs(situacao.diasParaVencer)}d`
                                : `em ${situacao.diasParaVencer}d`}
                            </p>
                          </TableCell>
                          <TableCell className="tabular hidden text-sm sm:table-cell">
                            {formatarMoeda(c.valor_mensal)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {saude.classe ? (
                              <BadgeStatus
                                texto={`${saude.ultimaNota} · ${ROTULO_NPS[saude.classe]}`}
                                classe={CLASSE_NPS[saude.classe]}
                                className="text-[10px]"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <BadgeStatus
                              texto={STATUS_CONTRATO[c.status_contrato]}
                              classe={CLASSE_STATUS_CONTRATO[c.status_contrato]}
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
        </TabsContent>

        <TabsContent value="servicos" className="mt-4 space-y-4">
          {podeGerenciar && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() =>
                  setServicoEmEdicao({
                    id: novoId('sv'),
                    nome: '',
                    categoria: 'suporte',
                    descricao: '',
                    ativo: true,
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Novo serviço
              </Button>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {servicos.map((s) => {
              const contratacoes = servicosContratados.filter((sc) => sc.servico_id === s.id);
              return (
                <Card key={s.id} className={`shadow-card ${!s.ativo ? 'opacity-60' : ''}`}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CATEGORIA_SERVICO[s.categoria]}
                        </p>
                      </div>
                      {podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => setServicoEmEdicao({ ...s })}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.descricao}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Contratado por{' '}
                      <strong className="text-foreground">{contratacoes.length}</strong>{' '}
                      {contratacoes.length === 1 ? 'cliente' : 'clientes'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Ficha da conta */}
      <Sheet open={detalhe !== null} onOpenChange={(v) => !v && setDetalheId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detalhe && (
            <FichaCliente
              cliente={detalhe}
              onEditar={() => {
                setEmEdicao({ ...detalhe });
                setEhNovo(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Cadastro / edição */}
      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{ehNovo ? 'Novo cliente' : 'Editar cliente'}</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4 pb-6">
              <CampoForm rotulo="Nome fantasia">
                {(id) => (
                  <Input
                    id={id}
                    value={emEdicao.nome}
                    onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                  />
                )}
              </CampoForm>
              <CampoForm rotulo="Razão social">
                {(id) => (
                  <Input
                    id={id}
                    value={emEdicao.razao_social}
                    onChange={(e) => setEmEdicao({ ...emEdicao, razao_social: e.target.value })}
                  />
                )}
              </CampoForm>
              <div className="grid grid-cols-2 gap-3">
                <CampoForm rotulo="CNPJ">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.cnpj}
                      placeholder="00.000.000/0001-00"
                      onChange={(e) => setEmEdicao({ ...emEdicao, cnpj: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Segmento">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.segmento}
                      placeholder="Financeiro, Logística..."
                      onChange={(e) => setEmEdicao({ ...emEdicao, segmento: e.target.value })}
                    />
                  )}
                </CampoForm>
              </div>
              <CampoForm rotulo="ID do WhatsApp">
                {(id) => (
                  <Input
                    id={id}
                    value={emEdicao.id_whatsapp}
                    placeholder="5511990000000"
                    onChange={(e) => setEmEdicao({ ...emEdicao, id_whatsapp: e.target.value })}
                  />
                )}
              </CampoForm>

              <CampoForm rotulo="Gerente de conta" dica="Responsável pela satisfação e pelo relacionamento com a conta.">
                {(id) => (
                  <Select
                    value={emEdicao.gerente_conta_id}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, gerente_conta_id: v })}
                  >
                    <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {funcionarios
                        .filter((f) => f.status !== 'desligado')
                        .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </CampoForm>

              <CampoForm rotulo="Responsável técnico">
                {(id) => (
                  <Select
                    value={emEdicao.responsavel_tecnico_id ?? 'nenhum'}
                    onValueChange={(v) =>
                      setEmEdicao({
                        ...emEdicao,
                        responsavel_tecnico_id: v === 'nenhum' ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Não definido</SelectItem>
                      {funcionarios
                        .filter((f) => f.status !== 'desligado')
                        .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </CampoForm>

              <div className="grid grid-cols-2 gap-3">
                <CampoForm rotulo="Nº do contrato">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.contrato_numero}
                      placeholder="CT-2026-001"
                      onChange={(e) => setEmEdicao({ ...emEdicao, contrato_numero: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Situação">
                  {(id) => (
                    <Select
                      value={emEdicao.status_contrato}
                      onValueChange={(v) =>
                        setEmEdicao({
                          ...emEdicao,
                          status_contrato: v as StatusContrato,
                          // Encerrar o contrato desativa a conta na operação.
                          ativo: v !== 'encerrado',
                        })
                      }
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_CONTRATO) as StatusContrato[]).map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_CONTRATO[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CampoForm rotulo="Início da vigência">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={emEdicao.contrato_inicio}
                      onChange={(e) => setEmEdicao({ ...emEdicao, contrato_inicio: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Data de renovação">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={emEdicao.contrato_fim}
                      onChange={(e) => setEmEdicao({ ...emEdicao, contrato_fim: e.target.value })}
                    />
                  )}
                </CampoForm>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CampoForm rotulo="Aviso prévio (dias)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      value={emEdicao.aviso_previa_dias}
                      onChange={(e) =>
                        setEmEdicao({ ...emEdicao, aviso_previa_dias: Number(e.target.value) || 0 })
                      }
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Valor mensal (R$)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={0}
                      value={emEdicao.valor_mensal}
                      onChange={(e) =>
                        setEmEdicao({ ...emEdicao, valor_mensal: Number(e.target.value) || 0 })
                      }
                    />
                  )}
                </CampoForm>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Renovação automática</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Renova sozinho se ninguém avisar dentro do prazo.
                  </p>
                </div>
                <Switch
                  checked={emEdicao.renovacao_automatica}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, renovacao_automatica: v })}
                />
              </div>

              <CampoForm rotulo="Regime de atendimento">
                {(id) => (
                  <Select
                    value={emEdicao.regime}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, regime: v as RegimeAtendimento })}
                  >
                    <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REGIME_ATENDIMENTO) as RegimeAtendimento[]).map((r) => (
                        <SelectItem key={r} value={r}>{REGIME_ATENDIMENTO[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CampoForm>

              <div className="grid grid-cols-2 gap-3">
                <CampoForm rotulo="SLA de resposta (min)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      value={emEdicao.sla_resposta_min}
                      onChange={(e) =>
                        setEmEdicao({ ...emEdicao, sla_resposta_min: Number(e.target.value) || 0 })
                      }
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="SLA de resolução (h)">
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      value={emEdicao.sla_resolucao_horas}
                      onChange={(e) =>
                        setEmEdicao({
                          ...emEdicao,
                          sla_resolucao_horas: Number(e.target.value) || 0,
                        })
                      }
                    />
                  )}
                </CampoForm>
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

      {/* Catálogo de serviços */}
      <Sheet open={servicoEmEdicao !== null} onOpenChange={(v) => !v && setServicoEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Serviço do catálogo</SheetTitle>
          </SheetHeader>
          {servicoEmEdicao && (
            <div className="mt-6 space-y-4">
              <CampoForm rotulo="Nome">
                {(id) => (
                  <Input
                    id={id}
                    value={servicoEmEdicao.nome}
                    onChange={(e) => setServicoEmEdicao({ ...servicoEmEdicao, nome: e.target.value })}
                  />
                )}
              </CampoForm>
              <CampoForm rotulo="Categoria">
                {(id) => (
                  <Select
                    value={servicoEmEdicao.categoria}
                    onValueChange={(v) =>
                      setServicoEmEdicao({ ...servicoEmEdicao, categoria: v as CategoriaServico })
                    }
                  >
                    <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORIA_SERVICO) as CategoriaServico[]).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORIA_SERVICO[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CampoForm>
              <CampoForm rotulo="Descrição">
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={servicoEmEdicao.descricao}
                    onChange={(e) =>
                      setServicoEmEdicao({ ...servicoEmEdicao, descricao: e.target.value })
                    }
                  />
                )}
              </CampoForm>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Ativo no catálogo</Label>
                <Switch
                  checked={servicoEmEdicao.ativo}
                  onCheckedChange={(v) => setServicoEmEdicao({ ...servicoEmEdicao, ativo: v })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setServicoEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvarCatalogo}>Salvar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
