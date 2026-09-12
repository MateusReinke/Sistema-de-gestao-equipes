import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import {
  agendaDoPeriodo,
  brechasDaAgenda,
  cobre,
  equipesSemCoberturaNoDia,
  pendentesDeGeracao,
  type ItemAgenda,
} from '@/lib/agendaPlantoes';
import { turnoCobreMinuto } from '@/lib/date';
import {
  DIAS_SEMANA,
  agora,
  duracaoTurnoHoras,
  formatarData,
  formatarMesAno,
  hoje,
  paraData,
  paraIso,
} from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import {
  CLASSE_TIPO_PLANTAO,
  STATUS_PLANTAO,
  TIPO_PLANTAO,
  primeiroNome,
} from '@/lib/labels';
import type { Plantao, TipoPlantao, TrocaPlantao } from '@/types/sgo';

/** Por que o turno está sem ninguém, em palavras. */
const MOTIVO_BRECHA: Record<string, string> = {
  vaga: 'Vaga aberta',
  ferias: 'Ocupante de férias',
  ausencia: 'Ocupante afastado',
};

/** Em que pé o turno está: o registro gravado, ou "só previsto pela escala". */
function situacaoDoItem(item: ItemAgenda): string {
  if (item.descoberto) return MOTIVO_BRECHA[item.descoberto];
  if (item.plantao) return STATUS_PLANTAO[item.plantao.status];
  return 'Previsto pela escala';
}

export default function PlantoesPage() {
  const {
    plantoes,
    funcionarios,
    equipes,
    escalaPosicoes,
    escalaCelulas,
    escalaExcecoes,
    tiposTurno,
    ferias,
    ausencias,
    salvarPlantao,
    removerPlantao,
    salvarTrocaPlantao,
    trocasPlantao,
    gerarPlantoesEquipe,
  } = useDados();
  const { sessao, podeGerenciar, equipesVisiveis } = useAuth();

  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Plantao | null>(null);
  const [trocaDe, setTrocaDe] = useState<Plantao | null>(null);
  const [substitutoId, setSubstitutoId] = useState('');
  const [motivoTroca, setMotivoTroca] = useState('');

  const [gerarAberto, setGerarAberto] = useState(false);
  const [equipeGerar, setEquipeGerar] = useState('');
  const [deGerar, setDeGerar] = useState('');
  const [ateGerar, setAteGerar] = useState('');
  const [sobrescreverGerar, setSobrescreverGerar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resultadoGerar, setResultadoGerar] = useState<
    { criados: number; atualizados: number; pulados: number; vagas: number } | null
  >(null);

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hojeIso = hoje();

  const nomeDe = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';
  const equipeDoFuncionario = (id: string) => funcionarios.find((f) => f.id === id)?.equipe_id;

  const primeiroDoMes = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDoMes = paraIso(new Date(ano, mes + 1, 0));

  /**
   * O contexto da agenda: a escala das equipes mais o que já foi materializado.
   *
   * É a mesma projeção que a tela da equipe usa. Antes esta tela lia só a
   * tabela `plantoes`, então um mês que ninguém tinha gerado aparecia vazio
   * aqui e cheio lá — ver `@/lib/agendaPlantoes`.
   */
  const contextoAgenda = useMemo(
    () => ({
      equipes,
      funcionarios,
      escalaPosicoes,
      escalaCelulas,
      escalaExcecoes,
      tiposTurno,
      plantoes,
      ferias,
      ausencias,
    }),
    [equipes, funcionarios, escalaPosicoes, escalaCelulas, escalaExcecoes, tiposTurno, plantoes, ferias, ausencias],
  );

  /** Só o que o usuário pode ver, já filtrado pela equipe escolhida. */
  const noAlcance = (itens: ItemAgenda[]) =>
    itens.filter((i) => {
      const equipeId = i.equipe?.id;
      if (equipesVisiveis !== null && (!equipeId || !equipesVisiveis.includes(equipeId))) return false;
      if (filtroEquipe !== 'todas' && equipeId !== filtroEquipe) return false;
      return true;
    });

  const agendaDoMes = useMemo(
    () => noAlcance(agendaDoPeriodo(contextoAgenda, primeiroDoMes, ultimoDoMes)),
    // `noAlcance` depende só do filtro e do alcance, que já estão aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextoAgenda, primeiroDoMes, ultimoDoMes, filtroEquipe, equipesVisiveis],
  );

  /** A agenda de hoje, para os indicadores — hoje pode estar fora do mês aberto. */
  const agendaDeHoje = useMemo(
    () => noAlcance(agendaDoPeriodo(contextoAgenda, hojeIso, hojeIso)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextoAgenda, hojeIso, filtroEquipe, equipesVisiveis],
  );

  const emCurso = useMemo(() => {
    const minuto = new Date().getHours() * 60 + new Date().getMinutes();
    return agendaDeHoje.filter(
      (i) => cobre(i) && turnoCobreMinuto(i.hora_inicio, i.hora_fim, minuto),
    );
  }, [agendaDeHoje]);

  const semCobertura = useMemo(
    () => equipesSemCoberturaNoDia(agendaDeHoje, equipes, hojeIso),
    [agendaDeHoje, equipes, hojeIso],
  );

  const brechas = useMemo(
    () => brechasDaAgenda(agendaDoMes, primeiroDoMes, ultimoDoMes),
    [agendaDoMes, primeiroDoMes, ultimoDoMes],
  );

  const pendentes = useMemo(() => pendentesDeGeracao(agendaDoMes), [agendaDoMes]);

  /** Células do mês: nulos no começo para alinhar o dia 1 ao dia da semana. */
  const celulas = useMemo(() => {
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const dias: (string | null)[] = Array(primeiroDiaSemana).fill(null);
    for (let d = 1; d <= totalDias; d++) {
      dias.push(`${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dias;
  }, [ano, mes]);

  const doDia = (data: string) => agendaDoMes.filter((i) => i.data === data);

  const horasNoMes = agendaDoMes.reduce(
    (soma, i) => (cobre(i) ? soma + duracaoTurnoHoras(i.hora_inicio, i.hora_fim) : soma),
    0,
  );

  const abrirNovo = (data: string) => {
    const candidato = funcionarios.find(
      (f) =>
        f.status !== 'desligado' &&
        (equipesVisiveis === null || equipesVisiveis.includes(f.equipe_id)),
    );
    if (!candidato) return toast.error('Nenhum funcionário disponível.');
    setEmEdicao({
      id: novoId('p'),
      funcionario_id: candidato.id,
      data,
      hora_inicio: '08:00',
      hora_fim: '17:00',
      tipo: 'comercial',
      status: 'previsto',
      gerado_automaticamente: false,
    });
  };

  /**
   * Um turno previsto pela escala ainda não existe como registro. Trocar ou
   * editar precisa de um: aqui ele nasce, com os dados que a escala já dizia.
   *
   * Vaga aberta não materializa — não há a quem atribuir o plantão, e é essa
   * brecha que a tela precisa continuar mostrando.
   */
  const materializar = (item: ItemAgenda): Plantao | null => {
    if (item.plantao) return item.plantao;
    if (!item.funcionario) {
      toast.error('Esta posição está sem ninguém. Designe um ocupante na tela da equipe.');
      return null;
    }
    const plantao: Plantao = {
      id: novoId('p'),
      funcionario_id: item.funcionario.id,
      tipo_turno_id: item.turno?.id ?? null,
      data: item.data,
      hora_inicio: item.hora_inicio,
      hora_fim: item.hora_fim,
      tipo: item.tipo,
      status: item.data < hojeIso ? 'confirmado' : 'previsto',
      gerado_automaticamente: true,
    };
    salvarPlantao(plantao);
    return plantao;
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (emEdicao.hora_inicio === emEdicao.hora_fim)
      return toast.error('Início e fim do turno não podem ser iguais.');

    // Escalar alguém duas vezes no mesmo turno é erro de digitação, não intenção.
    const duplicado = plantoes.some(
      (p) =>
        p.id !== emEdicao.id &&
        p.funcionario_id === emEdicao.funcionario_id &&
        p.data === emEdicao.data &&
        p.hora_inicio === emEdicao.hora_inicio &&
        p.status !== 'trocado',
    );
    if (duplicado) return toast.error('Esta pessoa já está escalada neste turno.');

    salvarPlantao(emEdicao);
    toast.success('Plantão salvo.');
    setEmEdicao(null);
  };

  const pedirTroca = () => {
    if (!trocaDe) return;
    if (!substitutoId) return toast.error('Escolha quem assume o plantão.');
    if (motivoTroca.trim().length < 5) return toast.error('Descreva o motivo da troca.');

    const troca: TrocaPlantao = {
      id: novoId('tp'),
      protocolo: proximoProtocolo('TRC', trocasPlantao),
      plantao_id: trocaDe.id,
      funcionario_id: trocaDe.funcionario_id,
      substituto_id: substitutoId,
      motivo: motivoTroca.trim(),
      status: 'pendente',
      solicitado_por: sessao?.funcionario.id ?? 'sistema',
      solicitado_em: agora(),
    };
    salvarTrocaPlantao(troca);
    toast.success(`Troca ${troca.protocolo} enviada para aprovação.`);
    setTrocaDe(null);
    setSubstitutoId('');
    setMotivoTroca('');
  };

  const abrirGerar = () => {
    const primeiraEquipe = equipes.find(
      (e) => e.ativo && (equipesVisiveis === null || equipesVisiveis.includes(e.id)),
    );
    setEquipeGerar(primeiraEquipe?.id ?? '');
    setDeGerar(`${ano}-${String(mes + 1).padStart(2, '0')}-01`);
    setAteGerar(paraIso(new Date(ano, mes + 1, 0)));
    setSobrescreverGerar(false);
    setResultadoGerar(null);
    setGerarAberto(true);
  };

  const executarGerar = async () => {
    if (!equipeGerar) return toast.error('Escolha uma equipe.');
    if (!deGerar || !ateGerar || deGerar > ateGerar) {
      return toast.error('Informe um período válido, com início não posterior ao fim.');
    }
    setGerando(true);
    try {
      const resultado = await gerarPlantoesEquipe(equipeGerar, deGerar, ateGerar, sobrescreverGerar);
      setResultadoGerar(resultado);
      toast.success('Escala gerada.');
    } catch {
      // A mensagem de erro já apareceu via toast em useDados().
    } finally {
      setGerando(false);
    }
  };

  const exportar = () =>
    baixarCsv(`plantoes-${ano}-${String(mes + 1).padStart(2, '0')}`, agendaDoMes, [
      { cabecalho: 'Data', valor: (i) => formatarData(i.data) },
      { cabecalho: 'Equipe', valor: (i) => i.equipe?.nome ?? '' },
      { cabecalho: 'Posição', valor: (i) => i.posicao?.nome ?? 'Avulso' },
      { cabecalho: 'Funcionário', valor: (i) => i.funcionario?.nome ?? 'Vaga aberta' },
      { cabecalho: 'Início', valor: (i) => i.hora_inicio },
      { cabecalho: 'Fim', valor: (i) => i.hora_fim },
      { cabecalho: 'Horas', valor: (i) => duracaoTurnoHoras(i.hora_inicio, i.hora_fim) },
      { cabecalho: 'Tipo', valor: (i) => TIPO_PLANTAO[i.tipo] },
      { cabecalho: 'Situação', valor: (i) => situacaoDoItem(i) },
      { cabecalho: 'Brecha', valor: (i) => MOTIVO_BRECHA[i.descoberto ?? ''] ?? '' },
    ]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Plantões"
        descricao="Escala mensal, cobertura e trocas de turno."
        acoes={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar mês
            </Button>
            {podeGerenciar && (
              <>
                <Button variant="outline" onClick={abrirGerar}>
                  <Wand2 className="mr-2 h-4 w-4" /> Gerar plantões
                </Button>
                <Button onClick={() => abrirNovo(hojeIso)}>
                  <Plus className="mr-2 h-4 w-4" /> Escalar plantão
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Em serviço agora" valor={emCurso.length} icone={CalendarDays} tom="info" />
        <Indicador
          rotulo="Plantões no mês"
          valor={agendaDoMes.length}
          icone={CalendarDays}
          tom="primary"
          detalhe={pendentes.length > 0 ? `${pendentes.length} ainda não gerado(s)` : undefined}
        />
        <Indicador
          rotulo="Horas escaladas"
          valor={`${Math.round(horasNoMes)}h`}
          icone={CalendarDays}
          tom="primary"
        />
        <Indicador
          rotulo="Dias com brecha"
          valor={brechas.length}
          icone={AlertTriangle}
          tom={brechas.length > 0 ? 'destructive' : 'success'}
          detalhe="Escalado e sem ninguém"
        />
      </div>

      {semCobertura.length > 0 && (
        <Aviso tom="destructive">
          Cobertura mínima não atingida hoje:{' '}
          {semCobertura.map((s) => `${s.equipe.nome} (faltam ${s.faltam})`).join(', ')}.
        </Aviso>
      )}

      {pendentes.length > 0 && podeGerenciar && (
        <Aviso>
          {pendentes.length} turno(s) deste mês vêm da escala das equipes e ainda não foram
          gravados. Eles já aparecem no calendário abaixo; gere o mês para que entrem em trocas,
          relatórios e nas integrações.
        </Aviso>
      )}

      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* first-letter, não capitalize: "Agosto de 2026", não "Agosto De 2026". */}
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

          <Select value={filtroEquipe} onValueChange={setFiltroEquipe}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as equipes</SelectItem>
              {equipes
                .filter((e) => equipesVisiveis === null || equipesVisiveis.includes(e.id))
                .map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {celulas.map((data, i) => {
                if (data === null) return <div key={`v-${i}`} className="min-h-[104px] bg-card/50" />;

                const lista = doDia(data);
                const ehHoje = data === hojeIso;
                const conflitos = lista.filter((i) => i.descoberto).length;

                return (
                  <button
                    key={data}
                    type="button"
                    onClick={() => setDiaAberto(data)}
                    className={`min-h-[104px] cursor-pointer bg-card p-1.5 text-left transition-colors hover:bg-accent/40 ${
                      ehHoje ? 'ring-2 ring-inset ring-primary' : ''
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`tabular text-xs font-medium ${
                          ehHoje ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {Number(data.slice(8))}
                      </span>
                      {conflitos > 0 && <AlertTriangle className="h-3 w-3 text-destructive" />}
                    </div>

                    <div className="space-y-0.5">
                      {lista.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          title={`${item.posicao?.nome ?? 'Avulso'} · ${situacaoDoItem(item)}`}
                          className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${
                            item.descoberto
                              ? 'bg-destructive/10 text-destructive line-through'
                              : item.plantao?.status === 'trocado'
                                ? 'bg-muted text-muted-foreground line-through'
                                : item.plantao
                                  ? 'bg-muted/60'
                                  : // Previsto pela escala, ainda não gravado.
                                    'border border-dashed border-border bg-transparent text-muted-foreground'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              item.tipo === 'noturno'
                                ? 'bg-brand-blue'
                                : item.tipo === 'diurno'
                                  ? 'bg-brand-gold'
                                  : item.tipo === 'comercial'
                                    ? 'bg-brand-orange'
                                    : 'bg-brand-coral'
                            }`}
                          />
                          <span className="truncate">
                            {item.funcionario ? primeiroNome(item.funcionario.nome) : 'Vaga'}
                          </span>
                        </div>
                      ))}
                      {lista.length > 3 && (
                        <p className="px-1 text-[9px] text-muted-foreground">
                          +{lista.length - 3} mais
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {[
              ['bg-brand-gold', 'Diurno'],
              ['bg-brand-blue', 'Noturno'],
              ['bg-brand-orange', 'Comercial'],
              ['bg-brand-coral', 'Sobreaviso / especial'],
            ].map(([cor, rotulo]) => (
              <span key={rotulo} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${cor}`} /> {rotulo}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-destructive" /> Brecha: vaga aberta, férias ou
              afastamento
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded border border-dashed border-border" /> Previsto pela
              escala, ainda não gerado
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detalhe do dia */}
      <Sheet open={diaAberto !== null} onOpenChange={(v) => !v && setDiaAberto(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{diaAberto && formatarData(diaAberto)}</SheetTitle>
          </SheetHeader>

          {diaAberto && (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                {DIAS_SEMANA[paraData(diaAberto).getDay()]} · {doDia(diaAberto).length} plantão(ões)
              </p>

              {podeGerenciar && (
                <Button variant="outline" className="w-full" onClick={() => abrirNovo(diaAberto)}>
                  <Plus className="mr-2 h-4 w-4" /> Escalar neste dia
                </Button>
              )}

              {doDia(diaAberto).length === 0 ? (
                <EstadoVazio icone={CalendarDays} titulo="Nenhum plantão neste dia" />
              ) : (
                doDia(diaAberto).map((item) => (
                  <div key={item.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start gap-2.5">
                      {item.funcionario ? (
                        <Avatar nome={item.funcionario.nome} tamanho="sm" />
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-destructive/50 text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-medium ${
                            item.funcionario ? '' : 'text-destructive'
                          }`}
                        >
                          {item.funcionario?.nome ?? 'Vaga aberta'}
                        </p>
                        <p className="tabular text-xs text-muted-foreground">
                          {item.hora_inicio}–{item.hora_fim} ·{' '}
                          {duracaoTurnoHoras(item.hora_inicio, item.hora_fim)}h ·{' '}
                          {item.equipe?.nome ?? '—'}
                          {item.posicao && ` · ${item.posicao.nome}`}
                        </p>
                      </div>
                      <BadgeStatus
                        texto={TIPO_PLANTAO[item.tipo]}
                        classe={CLASSE_TIPO_PLANTAO[item.tipo]}
                        className="text-[10px]"
                      />
                    </div>

                    <p className="text-[11px] text-muted-foreground">{situacaoDoItem(item)}</p>

                    {item.descoberto === 'vaga' && (
                      <Aviso tom="destructive">
                        A escala prevê este turno, mas a posição está sem ninguém. Designe alguém na
                        tela da equipe para fechar a brecha.
                      </Aviso>
                    )}
                    {item.descoberto && item.descoberto !== 'vaga' && (
                      <Aviso tom="destructive">
                        Escalado, mas estará {item.descoberto === 'ferias' ? 'de férias' : 'afastado'}.
                        Providencie cobertura.
                      </Aviso>
                    )}
                    {item.origem === 'avulso' && (
                      <Aviso>
                        Lançado fora da escala da equipe — ou sobrou de uma escala que mudou depois
                        de gerada.
                      </Aviso>
                    )}

                    {item.funcionario && (
                      <div className="flex gap-2">
                        {item.plantao?.status !== 'trocado' && item.data >= hojeIso && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const plantao = materializar(item);
                              if (!plantao) return;
                              setTrocaDe(plantao);
                              setSubstitutoId('');
                              setMotivoTroca('');
                            }}
                          >
                            <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Trocar
                          </Button>
                        )}
                        {podeGerenciar && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                const plantao = materializar(item);
                                if (plantao) setEmEdicao({ ...plantao });
                              }}
                            >
                              Editar
                            </Button>
                            {item.plantao && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                title="Apagar o registro gravado"
                                onClick={() => {
                                  removerPlantao(item.plantao!.id);
                                  toast.success(
                                    item.origem === 'escala'
                                      ? 'Registro apagado. O dia continua previsto pela escala.'
                                      : 'Plantão removido da escala.',
                                  );
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Editor de plantão */}
      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Plantão</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Funcionário</Label>
                <Select
                  value={emEdicao.funcionario_id}
                  onValueChange={(v) => setEmEdicao({ ...emEdicao, funcionario_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {funcionarios
                      .filter(
                        (f) =>
                          f.status !== 'desligado' &&
                          (equipesVisiveis === null || equipesVisiveis.includes(f.equipe_id)),
                      )
                      .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={emEdicao.data}
                  onChange={(e) => setEmEdicao({ ...emEdicao, data: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={emEdicao.hora_inicio}
                    onChange={(e) => setEmEdicao({ ...emEdicao, hora_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={emEdicao.hora_fim}
                    onChange={(e) => setEmEdicao({ ...emEdicao, hora_fim: e.target.value })}
                  />
                </div>
              </div>

              <p className="tabular text-xs text-muted-foreground">
                Duração: {duracaoTurnoHoras(emEdicao.hora_inicio, emEdicao.hora_fim)}h
                {emEdicao.hora_fim < emEdicao.hora_inicio && ' (vira o dia)'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={emEdicao.tipo}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo: v as TipoPlantao })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_PLANTAO) as TipoPlantao[]).map((t) => (
                        <SelectItem key={t} value={t}>{TIPO_PLANTAO[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

      {/* Solicitação de troca */}
      <Sheet open={trocaDe !== null} onOpenChange={(v) => !v && setTrocaDe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Solicitar troca de plantão</SheetTitle>
          </SheetHeader>
          {trocaDe && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{nomeDe(trocaDe.funcionario_id)}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {formatarData(trocaDe.data)} · {trocaDe.hora_inicio}–{trocaDe.hora_fim}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Quem assume</Label>
                <Select value={substitutoId} onValueChange={setSubstitutoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o substituto" /></SelectTrigger>
                  <SelectContent>
                    {funcionarios
                      .filter((f) => f.status === 'ativo' && f.id !== trocaDe.funcionario_id)
                      .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Textarea
                  rows={3}
                  value={motivoTroca}
                  onChange={(e) => setMotivoTroca(e.target.value)}
                  placeholder="Combine antes com a pessoa e registre o motivo aqui."
                />
              </div>

              <Aviso tom="info">
                A troca só entra na escala depois de aprovada na Central de Aprovações.
              </Aviso>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setTrocaDe(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={pedirTroca}>Enviar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Geração em lote a partir do rodízio da equipe */}
      <Sheet open={gerarAberto} onOpenChange={(v) => !v && setGerarAberto(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Gerar plantões</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Projeta o rodízio cadastrado em Escalas sobre o período escolhido e cria os plantões —
              sem precisar lançar um por um.
            </p>

            <div className="space-y-1.5">
              <Label>Equipe</Label>
              <Select value={equipeGerar} onValueChange={setEquipeGerar} disabled={resultadoGerar !== null}>
                <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                <SelectContent>
                  {equipes
                    .filter((e) => e.ativo && (equipesVisiveis === null || equipesVisiveis.includes(e.id)))
                    .map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>De</Label>
                <Input
                  type="date"
                  value={deGerar}
                  disabled={resultadoGerar !== null}
                  onChange={(e) => setDeGerar(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input
                  type="date"
                  value={ateGerar}
                  disabled={resultadoGerar !== null}
                  onChange={(e) => setAteGerar(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm">Sobrescrever ajustes manuais</Label>
                <p className="text-xs text-muted-foreground">
                  Sem isto, um plantão lançado à mão no período não é alterado.
                </p>
              </div>
              <Switch
                checked={sobrescreverGerar}
                disabled={resultadoGerar !== null}
                onCheckedChange={setSobrescreverGerar}
              />
            </div>

            {resultadoGerar && (
              <>
                <Aviso tom="info">
                  {resultadoGerar.criados} criado(s), {resultadoGerar.atualizados} atualizado(s) e{' '}
                  {resultadoGerar.pulados} pulado(s) — já estavam ajustados à mão.
                </Aviso>
                {resultadoGerar.vagas > 0 && (
                  <Aviso tom="destructive">
                    {resultadoGerar.vagas} turno(s) do período não puderam ser gerados: a posição
                    está sem ninguém. Eles seguem no calendário como brecha.
                  </Aviso>
                )}
              </>
            )}

            <div className="flex gap-2 pt-2">
              {resultadoGerar ? (
                <Button className="flex-1" onClick={() => setGerarAberto(false)}>
                  Concluir
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1" onClick={() => setGerarAberto(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={executarGerar} disabled={gerando}>
                    {gerando ? 'Gerando...' : 'Gerar'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
