/**
 * A tela de uma equipe: a escala em cima, a equipe embaixo.
 *
 * É onde a operação de uma equipe cabe inteira — o calendário do mês, a
 * legenda que aquela equipe usa, quem está nela e a situação de férias de cada
 * pessoa. O calendário é a projeção do rodízio cadastrado, calculada na hora
 * (`@/lib/projecaoEscala`), então a escala do mês que vem pode ser conferida
 * antes de existir plantão nenhum no banco.
 *
 * A legenda é por equipe de propósito: no NOC, "T.2" quer dizer turno noturno;
 * na infra, plantão. Enquanto a equipe não monta a dela, vale a embutida.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Palette,
  Pencil,
  Phone,
  Plus,
  Repeat,
  ShieldHalf,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  UsersRound,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Avatar,
  Aviso,
  BadgeStatus,
  CabecalhoPagina,
  Campo,
  EstadoVazio,
  Indicador,
} from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { EditorCiclo } from '@/components/escalas/EditorCiclo';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import {
  DIAS_SEMANA,
  diaDaSemana,
  formatarData,
  formatarMesAno,
  hoje,
  inicioDaSemana,
  paraIso,
} from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import { calcularSaldoFerias } from '@/lib/rh';
import {
  CORES_DISPONIVEIS,
  CORES_TURNO,
  ehFolga,
  classeDoTurno,
  codigoCurto,
  descricaoDoTurno,
  legendaDaEquipe,
  legendaInicialDaEquipe,
  type TurnoLegenda,
} from '@/lib/turnos';
import { coberturaPorDia, diasDoIntervalo, projetarEscalaEquipe } from '@/lib/projecaoEscala';
import { STATUS_FUNCIONARIO, CLASSE_STATUS_FUNCIONARIO, TIPO_PLANTAO } from '@/lib/labels';
import type { Acionamento, CorTurno, Funcionario, TipoPlantao, TipoTurno } from '@/types/sgo';

export default function EscalaEquipePage() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const {
    equipes,
    funcionarios,
    tiposTurno,
    escalaCadastros,
    escalaCelulas,
    escalaExcecoes,
    ferias,
    ausencias,
    gerarPlantoesEquipe,
    salvarTipoTurno,
    removerTipoTurno,
    salvarEscalaExcecao,
    removerEscalaExcecao,
    salvarCiclo,
    salvarFuncionario,
  } = useDados();
  const { podeGerenciar } = useAuth();

  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [gerando, setGerando] = useState(false);
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [pessoaAberta, setPessoaAberta] = useState<Funcionario | null>(null);
  /** Turno que o arrasto e o clique aplicam. */
  const [pincelId, setPincelId] = useState<string>('');
  /** O que está sendo arrastado agora — pessoa ou turno. */
  const [arrastando, setArrastando] = useState<
    { tipo: 'pessoa'; id: string } | { tipo: 'turno'; id: string } | null
  >(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [cicloEmEdicao, setCicloEmEdicao] = useState<Funcionario | null>(null);
  const [adicionarPessoa, setAdicionarPessoa] = useState(false);
  const [pessoaParaAdicionar, setPessoaParaAdicionar] = useState('');

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hojeIso = hoje();

  const primeiroDia = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = paraIso(new Date(ano, mes + 1, 0));
  const dias = useMemo(() => diasDoIntervalo(primeiroDia, ultimoDia), [primeiroDia, ultimoDia]);

  const equipe = equipes.find((e) => e.id === id);
  const legenda = useMemo(() => legendaDaEquipe(tiposTurno, id), [tiposTurno, id]);
  const legendaPropria = tiposTurno.some((t) => t.equipe_id === id);
  const folga = useMemo(() => legenda.find(ehFolga) ?? legenda[0], [legenda]);
  const pincel = legenda.find((t) => t.id === pincelId) ?? folga;

  const linhas = useMemo(
    () =>
      equipe
        ? projetarEscalaEquipe(
            {
              funcionarios,
              escalaCadastros,
              escalaCelulas,
              escalaExcecoes,
              ferias,
              ausencias,
              legenda,
            },
            equipe.id,
            primeiroDia,
            ultimoDia,
          )
        : [],
    [equipe, funcionarios, escalaCadastros, escalaCelulas, escalaExcecoes, ferias, ausencias, legenda, primeiroDia, ultimoDia],
  );

  const cobertura = useMemo(() => coberturaPorDia(linhas, dias), [linhas, dias]);
  const diasDescobertos = dias.filter((d) => (cobertura.get(d) ?? 0) < (equipe?.cobertura_minima ?? 0));
  const conflitos = linhas.reduce(
    (soma, l) => soma + [...l.dias.values()].filter((d) => d.indisponivel).length,
    0,
  );
  const semEscala = linhas.filter((l) => l.ciclo === 0);

  const gerar = async () => {
    if (!equipe) return;
    setGerando(true);
    try {
      const r = await gerarPlantoesEquipe(equipe.id, primeiroDia, ultimoDia);
      toast.success(
        `${r.criados} plantão(ões) criado(s), ${r.atualizados} atualizado(s), ${r.pulados} pulado(s).`,
      );
    } catch {
      // O erro já virou toast em useDados().
    } finally {
      setGerando(false);
    }
  };

  /**
   * Ajusta um dia solto de uma pessoa.
   *
   * Grava uma exceção por cima do ciclo, em vez de mexer na grade: trocar quem
   * cobre um sábado não pode mudar todos os outros sábados. Quando o turno
   * escolhido é o mesmo que o padrão já previa, a exceção é retirada — o dia
   * volta a seguir o rodízio, sem deixar um registro que não muda nada.
   */
  const ajustarDia = async (funcionarioId: string, data: string, turno: TurnoLegenda) => {
    if (!podeGerenciar) return;
    const existente = escalaExcecoes.find(
      (e) => e.funcionario_id === funcionarioId && e.data === data,
    );
    const doPadrao = linhas.find((l) => l.funcionario.id === funcionarioId)?.dias.get(data);

    // Comparar por rótulo, e não por id: a equipe pode estar usando a legenda
    // embutida, cujos ids mudam assim que ela ganha a própria.
    const voltaAoPadrao = !doPadrao?.ajustado && doPadrao?.turno.rotulo === turno.rotulo;

    try {
      if (voltaAoPadrao) {
        if (existente) await removerEscalaExcecao(existente.id);
        return;
      }

      // Um ajuste aponta para uma linha real de `tipos_turno`. Se a equipe
      // ainda está na legenda embutida, é aqui que ela ganha a própria — o
      // desenho continua idêntico, só passa a existir no banco.
      const propria = turno.equipe_id === id ? legenda : await copiarLegendaParaEquipe();
      const tipoTurnoId = propria.find((t) => t.rotulo === turno.rotulo)?.id ?? null;
      if (!tipoTurnoId) return;

      await salvarEscalaExcecao({
        id: existente?.id ?? novoId('ex'),
        funcionario_id: funcionarioId,
        data,
        tipo_turno_id: tipoTurnoId,
        observacao: '',
      });
    } catch {
      // Erro já virou toast em useDados().
    }
  };

  /** Materializa a legenda embutida como legenda desta equipe. */
  const copiarLegendaParaEquipe = async (): Promise<TurnoLegenda[]> => {
    if (legendaPropria) return legenda;
    const copia = legendaInicialDaEquipe(id, novoId);
    for (const turno of copia) await salvarTipoTurno(turno as TipoTurno);
    toast.info('Esta equipe passou a ter a própria legenda, para poder ser ajustada.');
    return copia;
  };

  /** Volta um dia ajustado ao que o ciclo manda. */
  const desfazerAjuste = async (funcionarioId: string, data: string) => {
    const existente = escalaExcecoes.find(
      (e) => e.funcionario_id === funcionarioId && e.data === data,
    );
    if (existente) await removerEscalaExcecao(existente.id);
  };

  const soltarEm = async (funcionarioIdDaLinha: string, data: string) => {
    setAlvo(null);
    if (!arrastando) return;
    // Arrastar uma pessoa escala aquela pessoa no dia; arrastar um turno pinta
    // a célula em que se soltou.
    if (arrastando.tipo === 'pessoa') {
      // Arrastar alguém escala a pessoa: folga como pincel não faria sentido.
      const turno = ehFolga(pincel) ? (legenda.find((t) => !ehFolga(t)) ?? pincel) : pincel;
      await ajustarDia(arrastando.id, data, turno);
    } else {
      const turno = legenda.find((t) => t.id === arrastando.id);
      if (turno) await ajustarDia(funcionarioIdDaLinha, data, turno);
    }
    setArrastando(null);
  };

  /** Move uma pessoa para esta equipe. */
  const porNaEquipe = async () => {
    const pessoa = funcionarios.find((f) => f.id === pessoaParaAdicionar);
    if (!pessoa) return toast.error('Escolha quem entra na equipe.');
    try {
      await salvarFuncionario({ ...pessoa, equipe_id: id });
      toast.success(`${pessoa.nome} agora é da equipe ${equipe?.nome ?? ''}.`);
      setPessoaParaAdicionar('');
      setAdicionarPessoa(false);
    } catch {
      // Erro já virou toast em useDados().
    }
  };

  const exportar = () =>
    baixarCsv(
      `escala-${equipe?.nome ?? 'equipe'}-${ano}-${String(mes + 1).padStart(2, '0')}`,
      linhas,
      [
        { cabecalho: 'Funcionário', valor: (l) => l.funcionario.nome },
        { cabecalho: 'Cargo', valor: (l) => l.funcionario.cargo },
        ...dias.map((data) => ({
          cabecalho: `${Number(data.slice(8))} ${DIAS_SEMANA[diaDaSemana(data)]}`,
          valor: (l: (typeof linhas)[number]) => {
            const dia = l.dias.get(data);
            if (!dia) return '';
            return dia.indisponivel
              ? `${dia.turno.rotulo} (${dia.indisponivel})`
              : dia.turno.rotulo;
          },
        })),
      ],
    );

  if (!equipe) {
    return (
      <Card className="shadow-card">
        <EstadoVazio
          icone={UsersRound}
          titulo="Equipe não encontrada"
          descricao="Ela pode ter sido removida ou você não tem acesso a ela."
          acao={<Button onClick={() => navegar('/equipes')}>Voltar para equipes</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo={equipe.nome}
        descricao="Escala do mês, legenda da equipe e quem está nela."
        acoes={
          <>
            <Button variant="ghost" onClick={() => navegar('/equipes')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Equipes
            </Button>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar mês
            </Button>
            {podeGerenciar && (
              <Button onClick={gerar} disabled={gerando}>
                <Wand2 className="mr-2 h-4 w-4" />
                {gerando ? 'Gerando...' : 'Gerar plantões do mês'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Pessoas na escala" valor={linhas.length - semEscala.length} icone={UsersRound} />
        <Indicador
          rotulo="Dias abaixo da cobertura"
          valor={diasDescobertos.length}
          icone={AlertTriangle}
          tom={diasDescobertos.length > 0 ? 'destructive' : 'success'}
          detalhe={`Mínimo ${equipe.cobertura_minima}/dia`}
        />
        <Indicador
          rotulo="Conflitos com férias"
          valor={conflitos}
          icone={CalendarDays}
          tom={conflitos > 0 ? 'warning' : 'success'}
        />
        <Indicador
          rotulo="Sem cadastro"
          valor={semEscala.length}
          icone={UsersRound}
          tom={semEscala.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {semEscala.length > 0 && (
        <Aviso>
          Sem cadastro de escala, então não aparecem no calendário:{' '}
          {semEscala.map((l) => l.funcionario.nome).join(', ')}.
        </Aviso>
      )}

      {/* ---------------------------------------------------------- escala */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="min-w-[190px] text-center text-lg first-letter:uppercase">
              {formatarMesAno(paraIso(mesAtual))}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMesAtual(new Date())}>
              Hoje
            </Button>
          </div>

          {podeGerenciar && (
            <Button variant="outline" size="sm" onClick={() => setLegendaAberta(true)}>
              <Palette className="mr-2 h-3.5 w-3.5" /> Editar legenda
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {podeGerenciar && linhas.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-2">
              <span className="mr-1 text-[11px] text-muted-foreground">Aplicar:</span>
              {legenda.map((turno) => (
                <button
                  key={turno.id}
                  type="button"
                  draggable
                  onDragStart={() => setArrastando({ tipo: 'turno', id: turno.id })}
                  onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                  onClick={() => setPincelId(turno.id)}
                  title={`${descricaoDoTurno(turno)} — clique para selecionar, ou arraste até um dia`}
                  className={`cursor-grab rounded border px-2 py-1 text-[11px] font-medium transition-all active:cursor-grabbing ${classeDoTurno(turno)} ${
                    pincelId === turno.id
                      ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {turno.rotulo}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-muted-foreground">
                Clique num dia para aplicar · arraste uma pessoa até a coluna · botão direito desfaz
              </span>
            </div>
          )}

          {linhas.length === 0 ? (
            <EstadoVazio
              icone={UsersRound}
              titulo="Nenhuma pessoa nesta equipe"
              descricao="Cadastre funcionários na equipe para montar a escala."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-[200px] border-b bg-card p-2 text-left font-medium text-muted-foreground">
                      Funcionário
                    </th>
                    {dias.map((data) => {
                      const diaSemana = diaDaSemana(data);
                      const fimDeSemana = diaSemana === 0 || diaSemana === 6;
                      return (
                        <th
                          key={data}
                          className={`min-w-[38px] border-b p-1 text-center font-medium ${
                            data === hojeIso
                              ? 'bg-primary/10 text-primary'
                              : fimDeSemana
                                ? 'bg-muted/60 text-muted-foreground'
                                : 'text-muted-foreground'
                          }`}
                        >
                          <div className="tabular text-[11px] leading-tight">{Number(data.slice(8))}</div>
                          <div className="text-[9px] font-normal leading-tight opacity-70">
                            {DIAS_SEMANA[diaSemana]}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.funcionario.id}>
                      <td className="sticky left-0 z-10 border-b bg-card p-1.5">
                        <button
                          type="button"
                          onClick={() => setPessoaAberta(linha.funcionario)}
                          className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-accent"
                        >
                          <Avatar nome={linha.funcionario.nome} tamanho="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium leading-tight">
                              {linha.funcionario.nome}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-muted-foreground">
                              {linha.funcionario.cargo}
                              {linha.ciclo > 0
                                ? ` · ciclo de ${linha.ciclo} semana(s)`
                                : ' · sem cadastro'}
                            </p>
                          </div>
                        </button>
                      </td>

                      {dias.map((data) => {
                        const dia = linha.dias.get(data);
                        const turno = dia?.turno;
                        const diaSemana = diaDaSemana(data);
                        const fimDeSemana = diaSemana === 0 || diaSemana === 6;

                        const chave = `${linha.funcionario.id}|${data}`;
                        return (
                          <td
                            key={data}
                            className={`border-b p-0.5 text-center ${fimDeSemana ? 'bg-muted/30' : ''}`}
                            onDragOver={(e) => {
                              if (!arrastando || !podeGerenciar) return;
                              e.preventDefault();
                              setAlvo(chave);
                            }}
                            onDragLeave={() => setAlvo((a) => (a === chave ? null : a))}
                            onDrop={() => soltarEm(linha.funcionario.id, data)}
                          >
                            <button
                              type="button"
                              disabled={!podeGerenciar}
                              onClick={() => ajustarDia(linha.funcionario.id, data, pincel)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                void desfazerAjuste(linha.funcionario.id, data);
                              }}
                              title={
                                dia && turno
                                  ? `${turno.rotulo} · ${dia.horario}${dia.ajustado ? ' · ajustado à mão' : ''}${
                                      dia.indisponivel
                                        ? dia.indisponivel === 'ferias'
                                          ? ' — de férias!'
                                          : ' — afastado!'
                                        : ''
                                    }`
                                  : 'Fora do ciclo — clique para aplicar o turno escolhido'
                              }
                              className={`w-full rounded border px-0.5 py-1 text-[9px] font-semibold transition-all ${
                                turno ? classeDoTurno(turno) : 'border-dashed text-muted-foreground/40'
                              } ${dia?.indisponivel ? 'opacity-45 line-through' : ''} ${
                                dia?.ajustado ? 'ring-1 ring-inset ring-foreground/40' : ''
                              } ${alvo === chave ? 'ring-2 ring-ring' : ''} ${
                                podeGerenciar ? 'hover:brightness-110' : ''
                              }`}
                            >
                              {turno ? codigoCurto(turno) : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Quantas pessoas realmente cobrem cada dia — backup não conta. */}
                  <tr>
                    <td className="sticky left-0 z-10 bg-card p-1.5 text-[11px] font-medium text-muted-foreground">
                      Cobertura (mín. {equipe.cobertura_minima})
                    </td>
                    {dias.map((data) => {
                      const total = cobertura.get(data) ?? 0;
                      const furo = total < equipe.cobertura_minima;
                      return (
                        <td key={data} className="p-0.5 text-center">
                          <div
                            className={`tabular rounded py-1 text-[10px] font-semibold ${
                              furo ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {total}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Legenda centralizada sob o calendário. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-3">
            {legenda.map((turno) => (
              <span
                key={turno.id}
                title={descricaoDoTurno(turno)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${classeDoTurno(turno)}`}>
                  {codigoCurto(turno)}
                </span>
                {turno.rotulo}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold line-through opacity-45">
                T.1
              </span>
              Escalado, mas de férias ou afastado
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- time */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Quem está na equipe</CardTitle>
            {podeGerenciar && (
              <Button variant="outline" size="sm" onClick={() => setAdicionarPessoa(true)}>
                <UserPlus className="mr-2 h-3.5 w-3.5" /> Adicionar pessoa
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém cadastrado nesta equipe.</p>
            ) : (
              <div className="space-y-1.5">
                {linhas.map((linha) => {
                  const saldo = calcularSaldoFerias(linha.funcionario, ferias);
                  const diasNoMes = [...linha.dias.values()].filter((d) => d.turno.trabalha).length;
                  return (
                    <button
                      key={linha.funcionario.id}
                      type="button"
                      draggable={podeGerenciar}
                      onDragStart={() => setArrastando({ tipo: 'pessoa', id: linha.funcionario.id })}
                      onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                      onClick={() => setPessoaAberta(linha.funcionario)}
                      title={
                        podeGerenciar
                          ? `Arraste até um dia do calendário para escalar ${linha.funcionario.nome}`
                          : undefined
                      }
                      className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent ${
                        podeGerenciar ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                    >
                      <Avatar nome={linha.funcionario.nome} tamanho="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{linha.funcionario.nome}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {linha.funcionario.cargo} · {diasNoMes} dia(s) no mês
                        </p>
                      </div>
                      {saldo.vencido ? (
                        <BadgeStatus
                          texto="Férias vencidas"
                          classe="bg-destructive/15 text-destructive border-destructive/30"
                          className="text-[10px]"
                        />
                      ) : saldo.vencendo ? (
                        <BadgeStatus
                          texto="Férias a vencer"
                          classe="bg-warning/15 text-warning-strong border-warning/30"
                          className="text-[10px]"
                        />
                      ) : (
                        <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                          {saldo.saldo}d
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro da escala</CardTitle>
            <p className="text-xs text-muted-foreground">
              Uma grade por pessoa, no formato da planilha: Semana 1, Semana 2… O ciclo tem o
              tamanho das semanas preenchidas e volta sozinho para o começo.
            </p>
          </CardHeader>
          <CardContent>
            {linhas.length === 0 ? (
              <EstadoVazio
                icone={CalendarDays}
                titulo="Nenhuma pessoa nesta equipe"
                descricao="Adicione alguém à equipe para montar o cadastro da escala."
              />
            ) : (
              <div className="space-y-1.5">
                {linhas.map((linha) => {
                  const cadastro = escalaCadastros.find(
                    (c) => c.funcionario_id === linha.funcionario.id,
                  );
                  return (
                    <div key={linha.funcionario.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <button
                        type="button"
                        onClick={() => podeGerenciar && setCicloEmEdicao(linha.funcionario)}
                        disabled={!podeGerenciar}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">{linha.funcionario.nome}</p>
                        <p className="tabular truncate text-[11px] text-muted-foreground">
                          {linha.ciclo > 0
                            ? `Ciclo de ${linha.ciclo} semana(s) · desde ${formatarData(cadastro?.inicio_em)}`
                            : 'Sem cadastro — o calendário fica vazio'}
                        </p>
                      </button>
                      {linha.ciclo === 0 && (
                        <BadgeStatus
                          texto="Em branco"
                          classe="bg-warning/15 text-warning-strong border-warning/30"
                          className="text-[10px]"
                        />
                      )}
                      {podeGerenciar && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={`Editar o ciclo de ${linha.funcionario.nome}`}
                          onClick={() => setCicloEmEdicao(linha.funcionario)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditorCiclo
        pessoa={cicloEmEdicao}
        cadastro={escalaCadastros.find((c) => c.funcionario_id === cicloEmEdicao?.id)}
        celulas={escalaCelulas.filter(
          (c) =>
            c.cadastro_id ===
            escalaCadastros.find((x) => x.funcionario_id === cicloEmEdicao?.id)?.id,
        )}
        legenda={legenda}
        colegas={funcionarios.filter(
          (f) => f.equipe_id === id && f.id !== cicloEmEdicao?.id && f.status !== 'desligado',
        )}
        aoFechar={() => setCicloEmEdicao(null)}
        garantirLegenda={copiarLegendaParaEquipe}
        salvarCiclo={salvarCiclo}
      />

      <Sheet open={adicionarPessoa} onOpenChange={(v) => !v && setAdicionarPessoa(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Adicionar pessoa a {equipe.nome}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              A pessoa passa a ser desta equipe e aparece no calendário acima. Ela sai da equipe
              anterior — alguém pertence a uma equipe de cada vez.
            </p>
            <div className="space-y-1.5">
              <Label>Funcionário</Label>
              <Select value={pessoaParaAdicionar} onValueChange={setPessoaParaAdicionar}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionarios
                    .filter((f) => f.status !== 'desligado' && f.equipe_id !== id)
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome} — {equipes.find((e) => e.id === f.equipe_id)?.nome ?? 'sem equipe'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setAdicionarPessoa(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={porNaEquipe}>Adicionar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EditorLegenda
        aberto={legendaAberta}
        aoFechar={() => setLegendaAberta(false)}
        equipeId={equipe.id}
        equipeNome={equipe.nome}
        legenda={legenda}
        legendaPropria={legendaPropria}
        salvar={salvarTipoTurno}
        remover={removerTipoTurno}
      />

      <FichaPessoa
        pessoa={pessoaAberta}
        aoFechar={() => setPessoaAberta(null)}
        linha={linhas.find((l) => l.funcionario.id === pessoaAberta?.id)}
      />
    </div>
  );

  /** Painel lateral com o que o gestor precisa saber de uma pessoa. */
  function FichaPessoa({
    pessoa,
    aoFechar,
    linha,
  }: {
    pessoa: Funcionario | null;
    aoFechar: () => void;
    linha?: (typeof linhas)[number];
  }) {
    if (!pessoa) return null;
    const saldo = calcularSaldoFerias(pessoa, ferias);
    const feriasDela = ferias
      .filter((f) => f.funcionario_id === pessoa.id && f.status !== 'rejeitada')
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
    const ausenciasDela = ausencias
      .filter((a) => a.funcionario_id === pessoa.id && a.status === 'aprovada')
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
    const porTurno = new Map<string, number>();
    for (const d of linha?.dias.values() ?? []) {
      porTurno.set(d.turno.id, (porTurno.get(d.turno.id) ?? 0) + 1);
    }

    return (
      <Sheet open onOpenChange={(v) => !v && aoFechar()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{pessoa.nome}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-3">
              <Avatar nome={pessoa.nome} tamanho="lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{pessoa.cargo}</p>
                <BadgeStatus
                  texto={STATUS_FUNCIONARIO[pessoa.status]}
                  classe={CLASSE_STATUS_FUNCIONARIO[pessoa.status]}
                  className="mt-1 text-[10px]"
                />
              </div>
            </div>

            {(saldo.vencido || saldo.vencendo) && (
              <Aviso tom={saldo.vencido ? 'destructive' : 'warning'}>
                {saldo.vencido
                  ? `Férias vencidas: o limite para gozar era ${formatarData(saldo.limiteConcessivo)}. A partir daí a empresa paga em dobro.`
                  : `Férias a vencer: precisa gozar até ${formatarData(saldo.limiteConcessivo)} (faltam ${saldo.diasAteVencer} dias).`}
              </Aviso>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { rotulo: 'Saldo', valor: `${saldo.saldo}d` },
                { rotulo: 'Usados', valor: `${saldo.usados}d` },
                { rotulo: 'Agendados', valor: `${saldo.agendados}d` },
              ].map((c) => (
                <div key={c.rotulo} className="rounded-lg border py-2">
                  <p className="tabular text-lg font-bold leading-none">{c.valor}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{c.rotulo}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Contato
              </p>
              <div className="space-y-1.5">
                <a
                  href={`mailto:${pessoa.email}`}
                  className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{pessoa.email}</span>
                </a>
                {pessoa.telefone && (
                  <a
                    href={`tel:${pessoa.telefone.replace(/\D/g, '')}`}
                    className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="tabular truncate">{pessoa.telefone}</span>
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Matrícula">{pessoa.matricula}</Campo>
              <Campo rotulo="Admissão">{formatarData(pessoa.data_admissao)}</Campo>
              <Campo rotulo="Local">{pessoa.local}</Campo>
              <Campo rotulo="Modelo">{pessoa.modelo_trabalho}</Campo>
            </div>

            {porTurno.size > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  No mês em exibição
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...porTurno.entries()].map(([turnoId, quantidade]) => {
                    const turno = legenda.find((t) => t.id === turnoId);
                    if (!turno) return null;
                    return (
                      <span
                        key={turnoId}
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium ${classeDoTurno(turno)}`}
                      >
                        {turno.rotulo}: {quantidade}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Férias
              </p>
              {feriasDela.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum período registrado.</p>
              ) : (
                feriasDela.slice(0, 4).map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span className="tabular">
                      {formatarData(f.data_inicio)} – {formatarData(f.data_fim)}
                    </span>
                    <span className="text-muted-foreground">{f.dias}d · {f.status}</span>
                  </div>
                ))
              )}
            </div>

            {ausenciasDela.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ausências aprovadas
                </p>
                {ausenciasDela.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span className="tabular">
                      {formatarData(a.data_inicio)} – {formatarData(a.data_fim)}
                    </span>
                    <span className="text-muted-foreground">{a.tipo}</span>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => navegar('/funcionarios')}>
              Abrir ficha completa
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
}

/**
 * Edição da legenda de uma equipe.
 *
 * Enquanto a equipe usa a legenda embutida, os itens aparecem aqui como ponto
 * de partida; a primeira gravação copia o conjunto para a equipe, e a partir
 * daí ela mexe só no dela — sem afetar as outras.
 */
function EditorLegenda({
  aberto,
  aoFechar,
  equipeId,
  equipeNome,
  legenda,
  legendaPropria,
  salvar,
  remover,
}: {
  aberto: boolean;
  aoFechar: () => void;
  equipeId: string;
  equipeNome: string;
  legenda: TurnoLegenda[];
  legendaPropria: boolean;
  salvar: (t: TipoTurno) => Promise<void>;
  remover: (id: string) => Promise<void>;
}) {
  const [salvando, setSalvando] = useState(false);

  /** Copia a legenda embutida para a equipe, para poder ser editada. */
  const adotarLegenda = async () => {
    setSalvando(true);
    try {
      for (const turno of legendaInicialDaEquipe(equipeId, novoId)) {
        await salvar(turno as TipoTurno);
      }
      toast.success('Legenda copiada para a equipe. Agora é só editar.');
    } catch {
      // Erro já virou toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  const adicionar = async () => {
    setSalvando(true);
    try {
      await salvar({
        id: novoId('tt'),
        equipe_id: equipeId,
        codigo: `T.${legenda.length + 1}`,
        rotulo: 'Novo turno',
        cor: 'cinza',
        trabalha: true,
        acionamento: 'nenhum',
        hora_inicio: '08:00',
        hora_fim: '17:00',
        acionamento_inicio: '00:00',
        acionamento_fim: '23:59',
        tipo_plantao: 'comercial',
        ordem: legenda.length + 1,
        ativo: true,
      });
    } catch {
      // Erro já virou toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Legenda de {equipeNome}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Os códigos que aparecem na grade e no calendário desta equipe. O horário mora aqui: um
            turno "Noturno 19:00–07:00" leva esse horário para todo dia em que for usado.
          </p>

          {!legendaPropria ? (
            <>
              <Aviso tom="info">
                Esta equipe ainda usa a legenda padrão do sistema, compartilhada com as demais. Copie
                para a equipe antes de editar — as outras equipes continuam com a delas.
              </Aviso>
              <div className="space-y-1.5">
                {legenda.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${classeDoTurno(t)}`}>
                      {t.codigo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.rotulo}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{descricaoDoTurno(t)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full" disabled={salvando} onClick={adotarLegenda}>
                {salvando ? 'Copiando...' : 'Copiar legenda para esta equipe'}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {legenda.map((turno) => (
                  <ItemLegenda key={turno.id} turno={turno} salvar={salvar} remover={remover} />
                ))}
              </div>
              <Button variant="outline" className="w-full" disabled={salvando} onClick={adicionar}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar turno
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Uma linha editável da legenda. Salva ao sair do campo, sem botão por item. */
function ItemLegenda({
  turno,
  salvar,
  remover,
}: {
  turno: TurnoLegenda;
  salvar: (t: TipoTurno) => Promise<void>;
  remover: (id: string) => Promise<void>;
}) {
  const [rascunho, setRascunho] = useState<TurnoLegenda>(turno);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(turno);

  const aplicar = (mudanca: Partial<TurnoLegenda>) => setRascunho({ ...rascunho, ...mudanca });

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded border px-2 py-1 text-[11px] font-semibold ${classeDoTurno(rascunho)}`}>
          {rascunho.codigo || '—'}
        </span>
        <Input
          className="h-8 flex-1"
          value={rascunho.rotulo}
          placeholder="Nome do turno"
          onChange={(e) => aplicar({ rotulo: e.target.value })}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          title="Remover da legenda"
          onClick={() => remover(turno.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Código</Label>
          <Input
            className="h-8"
            value={rascunho.codigo}
            onChange={(e) => aplicar({ codigo: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cor</Label>
          <Select value={rascunho.cor} onValueChange={(v) => aplicar({ cor: v as CorTurno })}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CORES_DISPONIVEIS.map((c) => (
                <SelectItem key={c} value={c}>{CORES_TURNO[c].rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Acionamento</Label>
          <Select
            value={rascunho.acionamento}
            onValueChange={(v) => aplicar({ acionamento: v as Acionamento })}
          >
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum</SelectItem>
              <SelectItem value="plantao">Plantão (1ª linha)</SelectItem>
              <SelectItem value="backup">Backup (2ª linha)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-2">
        <div>
          <Label className="text-xs">Cumpre turno de trabalho</Label>
          <p className="text-[11px] text-muted-foreground">
            Desligue para turnos que só põem a pessoa de sobreaviso.
          </p>
        </div>
        <Switch checked={rascunho.trabalha} onCheckedChange={(v) => aplicar({ trabalha: v })} />
      </div>

      {rascunho.trabalha && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={rascunho.tipo_plantao}
              onValueChange={(v) => aplicar({ tipo_plantao: v as TipoPlantao })}
            >
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['comercial', 'diurno', 'noturno', 'especial'] as TipoPlantao[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_PLANTAO[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Entra</Label>
            <Input
              className="h-8"
              type="time"
              value={rascunho.hora_inicio}
              onChange={(e) => aplicar({ hora_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sai</Label>
            <Input
              className="h-8"
              type="time"
              value={rascunho.hora_fim}
              onChange={(e) => aplicar({ hora_fim: e.target.value })}
            />
          </div>
        </div>
      )}

      {rascunho.acionamento !== 'nenhum' && (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-end pb-1.5">
            <p className="text-[11px] text-muted-foreground">Acionável das</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input
              className="h-8"
              type="time"
              value={rascunho.acionamento_inicio}
              onChange={(e) => aplicar({ acionamento_inicio: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fim</Label>
            <Input
              className="h-8"
              type="time"
              value={rascunho.acionamento_fim}
              onChange={(e) => aplicar({ acionamento_fim: e.target.value })}
            />
          </div>
        </div>
      )}

      {alterado && (
        <Button size="sm" className="w-full" onClick={() => salvar(rascunho as TipoTurno)}>
          Salvar "{rascunho.rotulo}"
        </Button>
      )}
    </div>
  );
}
