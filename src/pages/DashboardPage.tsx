import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Cake,
  CalendarDays,
  ClipboardCheck,
  Clock,
  KeyRound,
  Megaphone,
  Palmtree,
  PartyPopper,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { usePendencias } from '@/hooks/usePendencias';
import {
  aniversariantesDoMes,
  aniversariosDeEmpresaDoMes,
  calcularSaldoFerias,
  equipesSemCobertura,
  plantoesDescobertos,
  plantoesEmCurso,
  turnoverDoMes,
} from '@/lib/rh';
import { formatarData, formatarDataCurta, hoje, humanizarPrazo } from '@/lib/date';
import {
  CLASSE_CATEGORIA_COMUNICADO,
  CLASSE_TIPO_PENDENCIA,
  CLASSE_TIPO_PLANTAO,
  CATEGORIA_COMUNICADO,
  TIPO_PENDENCIA,
  TIPO_PLANTAO,
} from '@/lib/labels';

/** Cores da marca aplicadas às barras do gráfico de headcount. */
const CORES_GRAFICO = [
  'hsl(var(--brand-orange))',
  'hsl(var(--brand-blue))',
  'hsl(var(--brand-coral))',
  'hsl(var(--brand-gold))',
  'hsl(var(--success))',
];

export default function DashboardPage() {
  const dados = useDados();
  const { sessao } = useAuth();
  const { pendencias } = usePendencias();
  const hojeIso = hoje();

  const {
    funcionarios,
    equipes,
    departamentos,
    plantoes,
    ferias,
    ausencias,
    comunicados,
  } = dados;

  const ativos = useMemo(
    () => funcionarios.filter((f) => f.status !== 'desligado'),
    [funcionarios],
  );

  const emPlantao = useMemo(
    () => plantoesEmCurso({ plantoes, ferias, ausencias }),
    [plantoes, ferias, ausencias],
  );

  /**
   * Agrupa os furos por pessoa. Uma licença de 15 dias gera um aviso por
   * plantão atingido; listar todos empurra o resto do painel para fora da tela
   * sem acrescentar informação.
   */
  const descobertos = useMemo(() => {
    const porPessoa = new Map<
      string,
      { funcionario_id: string; motivo: 'ferias' | 'ausencia'; datas: string[] }
    >();

    for (const { plantao, motivo } of plantoesDescobertos({ plantoes, ferias, ausencias })) {
      const chave = `${plantao.funcionario_id}-${motivo}`;
      const atual = porPessoa.get(chave);
      if (atual) atual.datas.push(plantao.data);
      else porPessoa.set(chave, { funcionario_id: plantao.funcionario_id, motivo, datas: [plantao.data] });
    }

    return [...porPessoa.values()]
      .map((g) => ({ ...g, datas: g.datas.sort() }))
      .sort((a, b) => a.datas[0].localeCompare(b.datas[0]))
      .slice(0, 4);
  }, [plantoes, ferias, ausencias]);

  const semCobertura = useMemo(
    () => equipesSemCobertura({ equipes, funcionarios, plantoes, ferias, ausencias }),
    [equipes, funcionarios, plantoes, ferias, ausencias],
  );

  /** Quem está com o período concessivo estourando — a dívida cara do RH. */
  const feriasCriticas = useMemo(
    () =>
      ativos
        .map((f) => ({ funcionario: f, saldo: calcularSaldoFerias(f, ferias, hojeIso) }))
        .filter((r) => r.saldo.vencido || r.saldo.vencendo)
        .sort((a, b) => (a.saldo.diasAteVencer ?? 0) - (b.saldo.diasAteVencer ?? 0)),
    [ativos, ferias, hojeIso],
  );

  const aniversariantes = useMemo(() => aniversariantesDoMes(ativos, hojeIso), [ativos, hojeIso]);
  const aniversariosEmpresa = useMemo(
    () => aniversariosDeEmpresaDoMes(ativos, hojeIso),
    [ativos, hojeIso],
  );
  const turnover = useMemo(() => turnoverDoMes(funcionarios, hojeIso), [funcionarios, hojeIso]);

  const headcount = useMemo(
    () =>
      departamentos
        .map((d) => ({
          nome: d.sigla,
          completo: d.nome,
          total: ativos.filter((f) => f.departamento_id === d.id).length,
        }))
        .filter((d) => d.total > 0),
    [departamentos, ativos],
  );

  const fixados = comunicados.filter((c) => c.fixado).slice(0, 2);
  const nomeCurto = sessao?.funcionario.nome.split(' ')[0] ?? '';
  const saudacao =
    new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo={`${saudacao}, ${nomeCurto}`}
        descricao={`Situação da operação em ${formatarData(hojeIso)}`}
        acoes={
          <Button asChild>
            <Link to="/aprovacoes">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Central de Aprovações
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo="Funcionários ativos" valor={ativos.length} icone={Users} tom="primary" />
        <Indicador rotulo="Em plantão agora" valor={emPlantao.length} icone={Clock} tom="info" />
        <Indicador
          rotulo="Aguardando decisão"
          valor={pendencias.length}
          icone={ClipboardCheck}
          tom={pendencias.length > 0 ? 'warning' : 'success'}
        />
        <Indicador
          rotulo="Férias em risco"
          valor={feriasCriticas.length}
          icone={Palmtree}
          tom={feriasCriticas.length > 0 ? 'destructive' : 'success'}
          detalhe="Período concessivo"
        />
        <Indicador
          rotulo="Turnover do mês"
          valor={`${turnover.taxa}%`}
          icone={TrendingDown}
          tom="info"
          detalhe={`${turnover.admissoes} admissões · ${turnover.desligamentos} saídas`}
        />
      </div>

      {/* Alertas que exigem ação hoje, antes de qualquer listagem. */}
      {(descobertos.length > 0 || semCobertura.length > 0 || feriasCriticas.length > 0) && (
        <Card className="border-warning/40 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Precisa de atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {semCobertura.map(({ equipe, escalados, faltam }) => (
              <Aviso key={equipe.id} tom="destructive">
                <strong>{equipe.nome}</strong> está com {escalados} de {equipe.cobertura_minima}{' '}
                pessoas escaladas hoje — faltam {faltam}.{' '}
                <Link to="/plantoes" className="underline underline-offset-2">
                  Ajustar escala
                </Link>
              </Aviso>
            ))}

            {descobertos.map(({ funcionario_id, motivo, datas }) => {
              const pessoa = funcionarios.find((f) => f.id === funcionario_id);
              const periodo =
                datas.length === 1
                  ? formatarData(datas[0])
                  : `${datas.length} plantões entre ${formatarData(datas[0])} e ${formatarData(datas[datas.length - 1])}`;
              return (
                <Aviso key={`${funcionario_id}-${motivo}`}>
                  <strong>{pessoa?.nome}</strong> está escalado em {periodo}, mas estará{' '}
                  {motivo === 'ferias' ? 'de férias' : 'afastado'}.{' '}
                  <Link to="/plantoes" className="underline underline-offset-2">
                    Ver escala
                  </Link>
                </Aviso>
              );
            })}

            {feriasCriticas.slice(0, 4).map(({ funcionario, saldo }) => (
              <Aviso key={funcionario.id} tom={saldo.vencido ? 'destructive' : 'warning'}>
                <strong>{funcionario.nome}</strong>{' '}
                {saldo.vencido
                  ? `está com período concessivo vencido desde ${formatarData(saldo.limiteConcessivo)} — férias devidas em dobro.`
                  : `tem ${saldo.saldo} dias a gozar e o prazo vence ${humanizarPrazo(saldo.limiteConcessivo!)}.`}{' '}
                <Link to="/ferias" className="underline underline-offset-2">
                  Programar férias
                </Link>
              </Aviso>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Plantão em curso */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Em serviço agora
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/plantoes">
                Escala <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {emPlantao.length === 0 ? (
              <EstadoVazio
                icone={Clock}
                titulo="Ninguém em plantão neste momento"
                descricao="Fora dos turnos configurados nas escalas ativas."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {emPlantao.map((p) => {
                  const pessoa = funcionarios.find((f) => f.id === p.funcionario_id);
                  const equipe = equipes.find((e) => e.id === pessoa?.equipe_id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <Avatar nome={pessoa?.nome ?? '?'} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{pessoa?.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {equipe?.nome} · <span className="tabular">{p.hora_inicio}–{p.hora_fim}</span>
                        </p>
                      </div>
                      <BadgeStatus
                        texto={TIPO_PLANTAO[p.tipo]}
                        classe={CLASSE_TIPO_PLANTAO[p.tipo]}
                        className="text-[10px]"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fila de aprovações */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Fila de aprovação
            </CardTitle>
            {pendencias.length > 0 && (
              <span className="tabular rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {pendencias.length}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {pendencias.length === 0 ? (
              <EstadoVazio icone={ClipboardCheck} titulo="Nada pendente" descricao="Fila zerada." />
            ) : (
              <div className="space-y-2">
                {pendencias.slice(0, 5).map((p) => {
                  const pessoa = funcionarios.find((f) => f.id === p.funcionario_id);
                  return (
                    <Link
                      key={`${p.tipo}-${p.id}`}
                      to="/aprovacoes"
                      className="flex items-start gap-2 rounded-lg border p-2.5 transition-colors hover:bg-accent/60"
                    >
                      <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{pessoa?.nome}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{p.titulo}</p>
                      </div>
                      <BadgeStatus
                        texto={TIPO_PENDENCIA[p.tipo]}
                        classe={CLASSE_TIPO_PENDENCIA[p.tipo]}
                        className="shrink-0 text-[9px]"
                      />
                    </Link>
                  );
                })}
                {pendencias.length > 5 && (
                  <Button asChild variant="ghost" size="sm" className="w-full">
                    <Link to="/aprovacoes">Ver todas as {pendencias.length}</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* Headcount por área */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Headcount por área</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={headcount} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    fontSize: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(valor: number) => [`${valor} pessoas`, '']}
                  labelFormatter={(_, carga) => carga?.[0]?.payload?.completo ?? ''}
                />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {headcount.map((_, i) => (
                    <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Datas do mês */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cake className="h-4 w-4 text-brand-coral" />
              Datas do mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Aniversariantes
              </p>
              {aniversariantes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum neste mês.</p>
              ) : (
                <div className="space-y-1.5">
                  {aniversariantes.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <Avatar nome={f.nome} tamanho="sm" />
                      <span className="min-w-0 flex-1 truncate text-xs">{f.nome}</span>
                      <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                        {formatarDataCurta(f.data_nascimento)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <PartyPopper className="h-3 w-3" /> Aniversários de casa
              </p>
              {aniversariosEmpresa.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum neste mês.</p>
              ) : (
                <div className="space-y-1.5">
                  {aniversariosEmpresa.map(({ funcionario, anos }) => (
                    <div key={funcionario.id} className="flex items-center gap-2">
                      <Avatar nome={funcionario.nome} tamanho="sm" />
                      <span className="min-w-0 flex-1 truncate text-xs">{funcionario.nome}</span>
                      <span className="shrink-0 rounded bg-brand-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning-strong">
                        {anos} {anos === 1 ? 'ano' : 'anos'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mural */}
      {fixados.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" />
              Comunicados fixados
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/comunicados">
                Ver mural <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {fixados.map((c) => (
              <div key={c.id} className="rounded-lg border p-3">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{c.titulo}</p>
                  <BadgeStatus
                    texto={CATEGORIA_COMUNICADO[c.categoria]}
                    classe={CLASSE_CATEGORIA_COMUNICADO[c.categoria]}
                    className="shrink-0 text-[10px]"
                  />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.corpo}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Atalhos */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: '/ferias', icone: Palmtree, titulo: 'Solicitar férias', texto: 'Programar período e verificar saldo' },
          { to: '/acessos', icone: KeyRound, titulo: 'Pedir acesso', texto: 'Sistemas internos e ferramentas' },
          { to: '/plantoes', icone: CalendarDays, titulo: 'Ver escala', texto: 'Calendário e trocas de plantão' },
        ].map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-raised"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
              <a.icone className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{a.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">{a.texto}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
