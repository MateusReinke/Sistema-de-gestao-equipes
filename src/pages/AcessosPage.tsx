import { useMemo, useState } from 'react';
import { Download, KeyRound, LogOut, Plus, Search, Server, ShieldAlert, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { FormularioLoteAcesso } from '@/components/acessos/FormularioLoteAcesso';
import { agora, formatarData, hoje } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import {
  CATEGORIA_SISTEMA,
  CLASSE_STATUS_SOLICITACAO,
  NIVEL_ACESSO,
  STATUS_SOLICITACAO,
  TIPO_ACESSO,
} from '@/lib/labels';
import type {
  CategoriaSistema,
  NivelAcesso,
  Sistema,
  SolicitacaoAcesso,
  StatusSolicitacao,
  TipoAcesso,
} from '@/types/sgo';

export default function AcessosPage() {
  const {
    solicitacoesAcesso,
    sistemas,
    funcionarios,
    salvarSolicitacaoAcesso,
    salvarSistema,
  } = useDados();
  const { sessao, ehRh, podeGerenciar, equipesVisiveis } = useAuth();

  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusSolicitacao | 'todos'>('todos');
  const [emEdicao, setEmEdicao] = useState<SolicitacaoAcesso | null>(null);
  const [sistemaEmEdicao, setSistemaEmEdicao] = useState<Sistema | null>(null);
  const [loteAberto, setLoteAberto] = useState<'concessao' | 'revogacao' | null>(null);

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'desligado'), [funcionarios]);
  const nomeDe = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';
  const sistemaDe = (id: string) => sistemas.find((s) => s.id === id);

  const visiveis = useMemo(() => {
    if (equipesVisiveis === null) return solicitacoesAcesso;
    if (!sessao) return [];
    const daEquipe = new Set(
      funcionarios.filter((f) => equipesVisiveis.includes(f.equipe_id)).map((f) => f.id),
    );
    return solicitacoesAcesso.filter(
      (s) => s.funcionario_id === sessao.funcionario.id || daEquipe.has(s.funcionario_id),
    );
  }, [solicitacoesAcesso, equipesVisiveis, funcionarios, sessao]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const nomePorId = new Map(funcionarios.map((f) => [f.id, f.nome]));
    const sistemaPorId = new Map(sistemas.map((s) => [s.id, s.nome]));

    return visiveis
      .filter((s) => {
        const alvo = `${nomePorId.get(s.funcionario_id) ?? ''} ${sistemaPorId.get(s.sistema_id) ?? ''} ${s.protocolo}`;
        if (termo && !alvo.toLowerCase().includes(termo)) return false;
        if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false;
        return true;
      })
      .sort((a, b) => b.solicitado_em.localeCompare(a.solicitado_em));
  }, [visiveis, busca, filtroStatus, funcionarios, sistemas]);

  const hojeIso = hoje();
  /** Acessos temporários vencidos que ninguém revogou — risco de segurança. */
  const expirados = visiveis.filter(
    (s) =>
      (s.status === 'aprovada' || s.status === 'concluida') &&
      s.tipo !== 'revogacao' &&
      s.expira_em !== undefined &&
      s.expira_em < hojeIso,
  );

  const abrirNova = () => {
    const alvo = ehRh ? ativos[0] : sessao?.funcionario;
    if (!alvo) return;
    setEmEdicao({
      id: novoId('sa'),
      protocolo: proximoProtocolo('ACS', solicitacoesAcesso),
      funcionario_id: alvo.id,
      sistema_id: sistemas.find((s) => s.ativo)?.id ?? '',
      tipo: 'concessao',
      nivel: 'leitura',
      justificativa: '',
      status: 'pendente',
      solicitado_por: sessao?.funcionario.id ?? 'sistema',
      solicitado_em: agora(),
    });
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.sistema_id) return toast.error('Selecione o sistema.');
    if (emEdicao.justificativa.trim().length < 10)
      return toast.error('Descreva a justificativa de negócio (mín. 10 caracteres).');

    salvarSolicitacaoAcesso({ ...emEdicao, justificativa: emEdicao.justificativa.trim() });
    toast.success(`Solicitação ${emEdicao.protocolo} enviada.`);
    setEmEdicao(null);
  };

  const abrirNovoSistema = () =>
    setSistemaEmEdicao({
      id: novoId('s'),
      nome: '',
      categoria: 'infraestrutura',
      descricao: '',
      responsavel_id: ativos[0]?.id ?? '',
      requer_aprovacao_gestor: false,
      ativo: true,
    });

  const salvarCatalogo = () => {
    if (!sistemaEmEdicao) return;
    if (!sistemaEmEdicao.nome.trim()) return toast.error('Informe o nome do sistema.');
    salvarSistema({ ...sistemaEmEdicao, nome: sistemaEmEdicao.nome.trim() });
    toast.success('Sistema salvo no catálogo.');
    setSistemaEmEdicao(null);
  };

  const exportar = () =>
    baixarCsv(`acessos-${hojeIso}`, filtradas, [
      { cabecalho: 'Protocolo', valor: (s) => s.protocolo },
      { cabecalho: 'Funcionário', valor: (s) => nomeDe(s.funcionario_id) },
      { cabecalho: 'Sistema', valor: (s) => sistemaDe(s.sistema_id)?.nome },
      { cabecalho: 'Operação', valor: (s) => TIPO_ACESSO[s.tipo] },
      { cabecalho: 'Nível', valor: (s) => NIVEL_ACESSO[s.nivel] },
      { cabecalho: 'Expira em', valor: (s) => (s.expira_em ? formatarData(s.expira_em) : 'Sem prazo') },
      { cabecalho: 'Situação', valor: (s) => STATUS_SOLICITACAO[s.status] },
      { cabecalho: 'Justificativa', valor: (s) => s.justificativa },
    ]);

  const sistemaSelecionado = emEdicao ? sistemaDe(emEdicao.sistema_id) : undefined;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Solicitações de acesso"
        descricao="Concessão, alteração e revogação de acesso aos sistemas internos."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            {ehRh && (
              <>
                <Button variant="outline" onClick={() => setLoteAberto('concessao')}>
                  <UserPlus className="mr-2 h-4 w-4" /> Acessos de admissão
                </Button>
                <Button variant="outline" onClick={() => setLoteAberto('revogacao')}>
                  <LogOut className="mr-2 h-4 w-4" /> Revogar (desligamento)
                </Button>
              </>
            )}
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Pedir acesso
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Aguardando decisão"
          valor={visiveis.filter((s) => s.status === 'pendente').length}
          icone={KeyRound}
          tom="warning"
        />
        <Indicador
          rotulo="Concedidos"
          valor={visiveis.filter((s) => s.status === 'aprovada' || s.status === 'concluida').length}
          icone={KeyRound}
          tom="success"
        />
        <Indicador
          rotulo="Acessos vencidos"
          valor={expirados.length}
          icone={ShieldAlert}
          tom={expirados.length > 0 ? 'destructive' : 'success'}
          detalhe="Temporários não revogados"
        />
        <Indicador
          rotulo="Sistemas no catálogo"
          valor={sistemas.filter((s) => s.ativo).length}
          icone={Server}
          tom="info"
        />
      </div>

      {expirados.length > 0 && (
        <Aviso tom="destructive">
          {expirados.length} acesso(s) temporário(s) passaram da data de expiração e continuam
          ativos:{' '}
          {expirados
            .slice(0, 3)
            .map((s) => `${nomeDe(s.funcionario_id)} — ${sistemaDe(s.sistema_id)?.nome}`)
            .join('; ')}
          . Abra uma revogação para encerrá-los.
        </Aviso>
      )}

      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo de sistemas</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Funcionário, sistema ou protocolo..."
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
                icone={KeyRound}
                titulo="Nenhuma solicitação de acesso"
                descricao="Peça acesso a um sistema para começar."
                acao={<Button onClick={abrirNova}><Plus className="mr-2 h-4 w-4" /> Pedir acesso</Button>}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Sistema</TableHead>
                      <TableHead className="hidden sm:table-cell">Operação</TableHead>
                      <TableHead className="hidden md:table-cell">Nível</TableHead>
                      <TableHead className="hidden lg:table-cell">Expira</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.map((s) => {
                      const vencido =
                        s.expira_em !== undefined &&
                        s.expira_em < hojeIso &&
                        (s.status === 'aprovada' || s.status === 'concluida');
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar nome={nomeDe(s.funcionario_id)} tamanho="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-medium">{nomeDe(s.funcionario_id)}</p>
                                <p className="tabular text-[11px] text-muted-foreground">{s.protocolo}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{sistemaDe(s.sistema_id)?.nome ?? '—'}</TableCell>
                          <TableCell className="hidden text-sm sm:table-cell">{TIPO_ACESSO[s.tipo]}</TableCell>
                          <TableCell className="hidden text-sm md:table-cell">{NIVEL_ACESSO[s.nivel]}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {s.expira_em ? (
                              <span className={`tabular text-xs ${vencido ? 'font-medium text-destructive' : ''}`}>
                                {formatarData(s.expira_em)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sem prazo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <BadgeStatus
                              texto={STATUS_SOLICITACAO[s.status]}
                              classe={CLASSE_STATUS_SOLICITACAO[s.status]}
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

        <TabsContent value="catalogo" className="mt-4 space-y-4">
          {podeGerenciar && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={abrirNovoSistema}>
                <Plus className="mr-2 h-4 w-4" /> Novo sistema
              </Button>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sistemas.map((s) => (
              <Card key={s.id} className={`shadow-card ${!s.ativo ? 'opacity-60' : ''}`}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
                        <Server className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CATEGORIA_SISTEMA[s.categoria]}
                        </p>
                      </div>
                    </div>
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        onClick={() => setSistemaEmEdicao({ ...s })}
                      >
                        Editar
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">{s.descricao}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                    <span>Responsável: {nomeDe(s.responsavel_id)}</span>
                    {s.requer_aprovacao_gestor && (
                      <BadgeStatus
                        texto="Exige aval do gestor"
                        classe="bg-warning/15 text-warning-strong border-warning/30"
                        className="text-[9px]"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Nova solicitação */}
      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Solicitar acesso</SheetTitle>
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
                <Label>Sistema</Label>
                <Select
                  value={emEdicao.sistema_id}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, sistema_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {sistemas.filter((s) => s.ativo).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sistemaSelecionado && (
                  <p className="text-[11px] text-muted-foreground">{sistemaSelecionado.descricao}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Operação</Label>
                  <Select
                    value={emEdicao.tipo}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo: v as TipoAcesso })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_ACESSO) as TipoAcesso[]).map((t) => (
                        <SelectItem key={t} value={t}>{TIPO_ACESSO[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nível</Label>
                  <Select
                    value={emEdicao.nivel}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, nivel: v as NivelAcesso })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(NIVEL_ACESSO) as NivelAcesso[]).map((n) => (
                        <SelectItem key={n} value={n}>{NIVEL_ACESSO[n]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Expira em (opcional)</Label>
                <Input
                  type="date"
                  value={emEdicao.expira_em ?? ''}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, expira_em: e.target.value || undefined })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Preencha para acesso temporário — o sistema alerta quando o prazo passa.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Justificativa de negócio</Label>
                <Textarea
                  rows={3}
                  value={emEdicao.justificativa}
                  onChange={(e) => setEmEdicao({ ...emEdicao, justificativa: e.target.value })}
                  placeholder="Por que este acesso é necessário para o trabalho?"
                />
              </div>

              {emEdicao.nivel === 'admin' && (
                <Aviso>
                  Nível administrador concede controle total. Confirme se leitura ou escrita não
                  resolvem antes de seguir.
                </Aviso>
              )}
              {sistemaSelecionado?.requer_aprovacao_gestor && (
                <Aviso tom="info">
                  Este sistema exige aval do gestor direto antes da liberação pelo responsável (
                  {nomeDe(sistemaSelecionado.responsavel_id)}).
                </Aviso>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvar}>Enviar solicitação</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Catálogo */}
      <Sheet open={sistemaEmEdicao !== null} onOpenChange={(v) => !v && setSistemaEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Sistema do catálogo</SheetTitle>
          </SheetHeader>
          {sistemaEmEdicao && (
            <div className="mt-6 space-y-4 pb-6">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={sistemaEmEdicao.nome}
                  onChange={(e) => setSistemaEmEdicao({ ...sistemaEmEdicao, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={sistemaEmEdicao.categoria}
                  onValueChange={(v) =>
                    setSistemaEmEdicao({ ...sistemaEmEdicao, categoria: v as CategoriaSistema })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORIA_SISTEMA) as CategoriaSistema[]).map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORIA_SISTEMA[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={sistemaEmEdicao.descricao}
                  onChange={(e) => setSistemaEmEdicao({ ...sistemaEmEdicao, descricao: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável pela concessão</Label>
                <Select
                  value={sistemaEmEdicao.responsavel_id}
                  onValueChange={(v) => setSistemaEmEdicao({ ...sistemaEmEdicao, responsavel_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ativos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Exige aprovação do gestor</Label>
                <Switch
                  checked={sistemaEmEdicao.requer_aprovacao_gestor}
                  onCheckedChange={(v) =>
                    setSistemaEmEdicao({ ...sistemaEmEdicao, requer_aprovacao_gestor: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Ativo no catálogo</Label>
                <Switch
                  checked={sistemaEmEdicao.ativo}
                  onCheckedChange={(v) => setSistemaEmEdicao({ ...sistemaEmEdicao, ativo: v })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setSistemaEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvarCatalogo}>Salvar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <FormularioLoteAcesso
        aberto={loteAberto !== null}
        aoFechar={() => setLoteAberto(null)}
        modo={loteAberto ?? 'concessao'}
      />
    </div>
  );
}
