import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Pencil, Plus, Search, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, Campo, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { calcularSaldoFerias, formatarTempoDeCasa, idade } from '@/lib/rh';
import { formatarData, hoje } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import {
  CLASSE_STATUS_FUNCIONARIO,
  CLASSE_STATUS_SOLICITACAO,
  CONTRATO,
  MODELO_TRABALHO,
  NIVEL_ACESSO,
  STATUS_FUNCIONARIO,
  STATUS_SOLICITACAO,
  TIPO_AUSENCIA,
} from '@/lib/labels';
import type { Funcionario, ModeloTrabalho, StatusFuncionario, TipoContrato } from '@/types/sgo';

export default function FuncionariosPage() {
  const dados = useDados();
  const { podeGerenciar, equipesVisiveis } = useAuth();
  const [params, setParams] = useSearchParams();

  const {
    funcionarios,
    equipes,
    departamentos,
    ferias,
    ausencias,
    solicitacoesAcesso,
    sistemas,
    plantoes,
    salvarFuncionario,
    desligarFuncionario,
  } = dados;

  const [busca, setBusca] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState<StatusFuncionario | 'todos'>('ativo');
  const [emEdicao, setEmEdicao] = useState<Funcionario | null>(null);
  const [ehNovo, setEhNovo] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [aDesligar, setADesligar] = useState<Funcionario | null>(null);

  // Permite chegar direto na ficha de alguém pela paleta de comandos.
  useEffect(() => {
    const id = params.get('id');
    if (id) {
      setDetalheId(id);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const equipesPermitidas = equipesVisiveis;

  const visiveis = useMemo(
    () =>
      equipesPermitidas === null
        ? funcionarios
        : funcionarios.filter((f) => equipesPermitidas.includes(f.equipe_id)),
    [funcionarios, equipesPermitidas],
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return visiveis
      .filter((f) => {
        if (termo && ![f.nome, f.email, f.cargo, f.matricula].some((c) => c.toLowerCase().includes(termo)))
          return false;
        if (filtroEquipe !== 'todas' && f.equipe_id !== filtroEquipe) return false;
        if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [visiveis, busca, filtroEquipe, filtroStatus]);

  const detalhe = funcionarios.find((f) => f.id === detalheId) ?? null;

  const nomeDe = (id?: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';
  const equipeDe = (id: string) => equipes.find((e) => e.id === id)?.nome ?? '—';
  const departamentoDe = (id: string) => departamentos.find((d) => d.id === id)?.nome ?? '—';

  const abrirNovo = () => {
    setEmEdicao({
      id: novoId('f'),
      matricula: String(Math.max(0, ...funcionarios.map((f) => Number(f.matricula) || 0)) + 1).padStart(6, '0'),
      nome: '',
      email: '',
      telefone: '',
      cargo: '',
      departamento_id: departamentos[0]?.id ?? '',
      equipe_id: equipes.find((e) => e.ativo)?.id ?? '',
      tipo_contrato: 'clt',
      modelo_trabalho: 'presencial',
      data_admissao: hoje(),
      data_nascimento: '',
      status: 'ativo',
      local: '',
    });
    setEhNovo(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome.');
    if (!emEdicao.email.trim()) return toast.error('Informe o e-mail.');
    if (!emEdicao.data_admissao) return toast.error('Informe a data de admissão.');
    if (!emEdicao.data_nascimento) return toast.error('Informe a data de nascimento.');

    // A matrícula identifica a pessoa na folha; duplicá-la quebra a conciliação.
    const duplicada = funcionarios.some(
      (f) => f.id !== emEdicao.id && f.matricula === emEdicao.matricula,
    );
    if (duplicada) return toast.error('Já existe funcionário com esta matrícula.');

    salvarFuncionario(emEdicao);
    toast.success(ehNovo ? 'Funcionário cadastrado.' : 'Cadastro atualizado.');
    setEmEdicao(null);
  };

  const confirmarDesligamento = () => {
    if (!aDesligar) return;
    desligarFuncionario(aDesligar.id, hoje());
    toast.success(`${aDesligar.nome} desligado. Plantões futuros liberados.`);
    setADesligar(null);
    setDetalheId(null);
  };

  const exportar = () =>
    baixarCsv(`funcionarios-${hoje()}`, filtrados, [
      { cabecalho: 'Matrícula', valor: (f) => f.matricula },
      { cabecalho: 'Nome', valor: (f) => f.nome },
      { cabecalho: 'E-mail', valor: (f) => f.email },
      { cabecalho: 'Telefone', valor: (f) => f.telefone },
      { cabecalho: 'Cargo', valor: (f) => f.cargo },
      { cabecalho: 'Departamento', valor: (f) => departamentoDe(f.departamento_id) },
      { cabecalho: 'Equipe', valor: (f) => equipeDe(f.equipe_id) },
      { cabecalho: 'Gestor', valor: (f) => nomeDe(f.gestor_id) },
      { cabecalho: 'Contrato', valor: (f) => CONTRATO[f.tipo_contrato] },
      { cabecalho: 'Modelo', valor: (f) => MODELO_TRABALHO[f.modelo_trabalho] },
      { cabecalho: 'Admissão', valor: (f) => formatarData(f.data_admissao) },
      { cabecalho: 'Situação', valor: (f) => STATUS_FUNCIONARIO[f.status] },
      { cabecalho: 'Local', valor: (f) => f.local },
    ]);

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Funcionários"
        descricao={`${visiveis.filter((f) => f.status !== 'desligado').length} pessoas ativas · ${visiveis.length} no total`}
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
            {podeGerenciar && (
              <Button onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" /> Novo funcionário
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nome, e-mail, cargo ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as equipes</SelectItem>
            {equipes
              .filter((e) => equipesPermitidas === null || equipesPermitidas.includes(e.id))
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusFuncionario | 'todos')}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {(Object.keys(STATUS_FUNCIONARIO) as StatusFuncionario[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_FUNCIONARIO[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden shadow-card">
        {filtrados.length === 0 ? (
          <EstadoVazio
            icone={Users}
            titulo="Nenhum funcionário encontrado"
            descricao="Ajuste a busca ou os filtros."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Equipe</TableHead>
                  <TableHead className="hidden xl:table-cell">Gestor</TableHead>
                  <TableHead className="hidden sm:table-cell">Contrato</TableHead>
                  <TableHead className="hidden xl:table-cell">Admissão</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => setDetalheId(f.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={f.nome} tamanho="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{f.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">{f.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm md:table-cell">{f.cargo}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{equipeDe(f.equipe_id)}</TableCell>
                    <TableCell className="hidden text-sm xl:table-cell">{nomeDe(f.gestor_id)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs">{CONTRATO[f.tipo_contrato]}</span>
                    </TableCell>
                    <TableCell className="tabular hidden text-xs xl:table-cell">
                      {formatarData(f.data_admissao)}
                    </TableCell>
                    <TableCell>
                      <BadgeStatus
                        texto={STATUS_FUNCIONARIO[f.status]}
                        classe={CLASSE_STATUS_FUNCIONARIO[f.status]}
                        className="text-[10px]"
                      />
                    </TableCell>
                    <TableCell>
                      {podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmEdicao({ ...f });
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

      {/* Ficha completa */}
      <Sheet open={detalhe !== null} onOpenChange={(v) => !v && setDetalheId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detalhe && <FichaFuncionario funcionario={detalhe} onDesligar={() => setADesligar(detalhe)} />}
        </SheetContent>
      </Sheet>

      {/* Cadastro / edição */}
      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{ehNovo ? 'Novo funcionário' : 'Editar funcionário'}</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4 pb-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Matrícula</Label>
                  <Input
                    value={emEdicao.matricula}
                    onChange={(e) => setEmEdicao({ ...emEdicao, matricula: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <Select
                    value={emEdicao.status}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, status: v as StatusFuncionario })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_FUNCIONARIO) as StatusFuncionario[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_FUNCIONARIO[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={emEdicao.nome} onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={emEdicao.email} onChange={(e) => setEmEdicao({ ...emEdicao, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={emEdicao.telefone} onChange={(e) => setEmEdicao({ ...emEdicao, telefone: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={emEdicao.cargo} onChange={(e) => setEmEdicao({ ...emEdicao, cargo: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <Select value={emEdicao.departamento_id} onValueChange={(v) => setEmEdicao({ ...emEdicao, departamento_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {departamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Equipe</Label>
                  <Select value={emEdicao.equipe_id} onValueChange={(v) => setEmEdicao({ ...emEdicao, equipe_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {equipes.filter((e) => e.ativo).map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Gestor direto</Label>
                <Select
                  value={emEdicao.gestor_id ?? 'nenhum'}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, gestor_id: v === 'nenhum' ? undefined : v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Sem gestor direto</SelectItem>
                    {funcionarios
                      .filter((f) => f.status !== 'desligado' && f.id !== emEdicao.id)
                      .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de contrato</Label>
                  <Select value={emEdicao.tipo_contrato} onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo_contrato: v as TipoContrato })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONTRATO) as TipoContrato[]).map((c) => <SelectItem key={c} value={c}>{CONTRATO[c]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo de trabalho</Label>
                  <Select value={emEdicao.modelo_trabalho} onValueChange={(v) => setEmEdicao({ ...emEdicao, modelo_trabalho: v as ModeloTrabalho })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODELO_TRABALHO) as ModeloTrabalho[]).map((m) => <SelectItem key={m} value={m}>{MODELO_TRABALHO[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Admissão</Label>
                  <Input type="date" value={emEdicao.data_admissao} onChange={(e) => setEmEdicao({ ...emEdicao, data_admissao: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nascimento</Label>
                  <Input type="date" value={emEdicao.data_nascimento} onChange={(e) => setEmEdicao({ ...emEdicao, data_nascimento: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Local</Label>
                <Input
                  value={emEdicao.local}
                  placeholder="Cidade — UF"
                  onChange={(e) => setEmEdicao({ ...emEdicao, local: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>Cancelar</Button>
                <Button className="flex-1" onClick={salvar}>Salvar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={aDesligar !== null} onOpenChange={(v) => !v && setADesligar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar {aDesligar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A situação passa a "Desligado" com a data de hoje e os plantões futuros dessa pessoa
              são retirados da escala, para que o gestor reescale conscientemente. O histórico é
              preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDesligamento}>Confirmar desligamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  /** Ficha com abas — dados, férias, agenda, ausências e acessos. */
  function FichaFuncionario({
    funcionario,
    onDesligar,
  }: {
    funcionario: Funcionario;
    onDesligar: () => void;
  }) {
    const saldo = calcularSaldoFerias(funcionario, ferias);
    const feriasDele = ferias.filter((f) => f.funcionario_id === funcionario.id);
    const ausenciasDele = ausencias.filter((a) => a.funcionario_id === funcionario.id);
    const acessosDele = solicitacoesAcesso.filter((s) => s.funcionario_id === funcionario.id);
    const proximosPlantoes = plantoes
      .filter((p) => p.funcionario_id === funcionario.id && p.data >= hoje() && p.status !== 'trocado')
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 8);

    return (
      <>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar nome={funcionario.nome} tamanho="lg" />
            <div className="min-w-0">
              <SheetTitle className="truncate text-left">{funcionario.nome}</SheetTitle>
              <p className="truncate text-sm text-muted-foreground">{funcionario.cargo}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          <BadgeStatus
            texto={STATUS_FUNCIONARIO[funcionario.status]}
            classe={CLASSE_STATUS_FUNCIONARIO[funcionario.status]}
          />
          <BadgeStatus texto={CONTRATO[funcionario.tipo_contrato]} classe="bg-muted text-muted-foreground border-border" />
          <BadgeStatus texto={MODELO_TRABALHO[funcionario.modelo_trabalho]} classe="bg-muted text-muted-foreground border-border" />
        </div>

        <Tabs defaultValue="dados" className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="ferias" className="flex-1">Férias</TabsTrigger>
            <TabsTrigger value="agenda" className="flex-1">Agenda</TabsTrigger>
            <TabsTrigger value="acessos" className="flex-1">Acessos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Matrícula">{funcionario.matricula}</Campo>
              <Campo rotulo="E-mail">{funcionario.email}</Campo>
              <Campo rotulo="Telefone">{funcionario.telefone}</Campo>
              <Campo rotulo="Local">{funcionario.local || '—'}</Campo>
              <Campo rotulo="Departamento">{departamentoDe(funcionario.departamento_id)}</Campo>
              <Campo rotulo="Equipe">{equipeDe(funcionario.equipe_id)}</Campo>
              <Campo rotulo="Gestor direto">{nomeDe(funcionario.gestor_id)}</Campo>
              <Campo rotulo="Idade">
                {funcionario.data_nascimento ? `${idade(funcionario.data_nascimento)} anos` : '—'}
              </Campo>
              <Campo rotulo="Admissão">{formatarData(funcionario.data_admissao)}</Campo>
              <Campo rotulo="Tempo de casa">{formatarTempoDeCasa(funcionario.data_admissao)}</Campo>
              {funcionario.data_desligamento && (
                <Campo rotulo="Desligamento">{formatarData(funcionario.data_desligamento)}</Campo>
              )}
            </div>

            {podeGerenciar && funcionario.status !== 'desligado' && (
              <Button variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onDesligar}>
                <UserMinus className="mr-2 h-4 w-4" /> Registrar desligamento
              </Button>
            )}
          </TabsContent>

          <TabsContent value="ferias" className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { rotulo: 'Direito', valor: saldo.direito },
                { rotulo: 'Usados', valor: saldo.usados },
                { rotulo: 'Saldo', valor: saldo.saldo },
              ].map((c) => (
                <div key={c.rotulo} className="rounded-lg border p-3 text-center">
                  <p className="tabular text-xl font-bold">{c.valor}</p>
                  <p className="text-[11px] text-muted-foreground">{c.rotulo}</p>
                </div>
              ))}
            </div>

            {saldo.vencido && (
              <Aviso tom="destructive">
                Período concessivo vencido em {formatarData(saldo.limiteConcessivo)} — férias devidas
                em dobro (art. 137 CLT).
              </Aviso>
            )}
            {saldo.vencendo && (
              <Aviso>
                Período concessivo vence em {formatarData(saldo.limiteConcessivo)} —{' '}
                {saldo.diasAteVencer} dias.
              </Aviso>
            )}

            {feriasDele.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum registro de férias.</p>
            ) : (
              <div className="space-y-2">
                {feriasDele
                  .slice()
                  .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))
                  .map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="min-w-0">
                        <p className="tabular text-sm">
                          {formatarData(f.data_inicio)} – {formatarData(f.data_fim)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {f.dias} dias{f.dias_abono > 0 && ` · ${f.dias_abono} de abono`} · {f.protocolo}
                        </p>
                      </div>
                      <BadgeStatus
                        texto={STATUS_SOLICITACAO[f.status]}
                        classe={CLASSE_STATUS_SOLICITACAO[f.status]}
                        className="text-[10px]"
                      />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agenda" className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Próximos plantões
              </p>
              {proximosPlantoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem plantões agendados.</p>
              ) : (
                <div className="space-y-1.5">
                  {proximosPlantoes.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <span className="tabular">{formatarData(p.data)}</span>
                      <span className="tabular text-muted-foreground">{p.hora_inicio}–{p.hora_fim}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ausências
              </p>
              {ausenciasDele.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ausência registrada.</p>
              ) : (
                <div className="space-y-1.5">
                  {ausenciasDele.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border p-2.5">
                      <div className="min-w-0">
                        <p className="text-sm">{TIPO_AUSENCIA[a.tipo]}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          {formatarData(a.data_inicio)} – {formatarData(a.data_fim)} · {a.dias}d
                        </p>
                      </div>
                      <BadgeStatus
                        texto={STATUS_SOLICITACAO[a.status]}
                        classe={CLASSE_STATUS_SOLICITACAO[a.status]}
                        className="text-[10px]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="acessos" className="mt-4">
            {acessosDele.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma solicitação de acesso.
              </p>
            ) : (
              <div className="space-y-2">
                {acessosDele.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {sistemas.find((x) => x.id === s.sistema_id)?.nome ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {NIVEL_ACESSO[s.nivel]} · {s.protocolo}
                      </p>
                    </div>
                    <BadgeStatus
                      texto={STATUS_SOLICITACAO[s.status]}
                      classe={CLASSE_STATUS_SOLICITACAO[s.status]}
                      className="text-[10px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  }
}
