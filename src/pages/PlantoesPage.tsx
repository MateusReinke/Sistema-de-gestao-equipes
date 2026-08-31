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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados, novoId, proximoProtocolo } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { equipesSemCobertura, plantoesDescobertos, plantoesEmCurso } from '@/lib/rh';
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

export default function PlantoesPage() {
  const {
    plantoes,
    funcionarios,
    equipes,
    escalas,
    ferias,
    ausencias,
    salvarPlantao,
    removerPlantao,
    salvarTrocaPlantao,
    trocasPlantao,
  } = useDados();
  const { sessao, podeGerenciar, equipesVisiveis } = useAuth();

  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [filtroEquipe, setFiltroEquipe] = useState('todas');
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [emEdicao, setEmEdicao] = useState<Plantao | null>(null);
  const [trocaDe, setTrocaDe] = useState<Plantao | null>(null);
  const [substitutoId, setSubstitutoId] = useState('');
  const [motivoTroca, setMotivoTroca] = useState('');

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hojeIso = hoje();

  const nomeDe = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';
  const equipeDoFuncionario = (id: string) => funcionarios.find((f) => f.id === id)?.equipe_id;

  /** Plantões dentro do alcance do usuário e do filtro de equipe. */
  const visiveis = useMemo(() => {
    const equipePorFuncionario = new Map(funcionarios.map((f) => [f.id, f.equipe_id]));
    return plantoes.filter((p) => {
      const equipe = equipePorFuncionario.get(p.funcionario_id);
      if (equipesVisiveis !== null && (!equipe || !equipesVisiveis.includes(equipe))) return false;
      if (filtroEquipe !== 'todas' && equipe !== filtroEquipe) return false;
      return true;
    });
  }, [plantoes, equipesVisiveis, filtroEquipe, funcionarios]);

  const indisponiveis = useMemo(() => {
    const mapa = new Map<string, 'ferias' | 'ausencia'>();
    plantoesDescobertos({ plantoes, ferias, ausencias, aPartirDe: '0000-01-01' }).forEach((d) =>
      mapa.set(d.plantao.id, d.motivo),
    );
    return mapa;
  }, [plantoes, ferias, ausencias]);

  const emCurso = useMemo(
    () => plantoesEmCurso({ plantoes: visiveis, ferias, ausencias }),
    [visiveis, ferias, ausencias],
  );

  const semCobertura = useMemo(
    () => equipesSemCobertura({ equipes, funcionarios, plantoes, ferias, ausencias }),
    [equipes, funcionarios, plantoes, ferias, ausencias],
  );

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

  const doDia = (data: string) =>
    visiveis
      .filter((p) => p.data === data)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  const noMes = useMemo(
    () => visiveis.filter((p) => p.data.startsWith(`${ano}-${String(mes + 1).padStart(2, '0')}`)),
    [visiveis, ano, mes],
  );

  const horasNoMes = noMes.reduce(
    (soma, p) => soma + duracaoTurnoHoras(p.hora_inicio, p.hora_fim),
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
    });
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

  const exportar = () =>
    baixarCsv(`plantoes-${ano}-${String(mes + 1).padStart(2, '0')}`, noMes, [
      { cabecalho: 'Data', valor: (p) => formatarData(p.data) },
      { cabecalho: 'Funcionário', valor: (p) => nomeDe(p.funcionario_id) },
      { cabecalho: 'Equipe', valor: (p) => equipes.find((e) => e.id === equipeDoFuncionario(p.funcionario_id))?.nome },
      { cabecalho: 'Início', valor: (p) => p.hora_inicio },
      { cabecalho: 'Fim', valor: (p) => p.hora_fim },
      { cabecalho: 'Horas', valor: (p) => duracaoTurnoHoras(p.hora_inicio, p.hora_fim) },
      { cabecalho: 'Tipo', valor: (p) => TIPO_PLANTAO[p.tipo] },
      { cabecalho: 'Situação', valor: (p) => STATUS_PLANTAO[p.status] },
      { cabecalho: 'Conflito', valor: (p) => (indisponiveis.has(p.id) ? indisponiveis.get(p.id) : '') },
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
              <Button onClick={() => abrirNovo(hojeIso)}>
                <Plus className="mr-2 h-4 w-4" /> Escalar plantão
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Em serviço agora" valor={emCurso.length} icone={CalendarDays} tom="info" />
        <Indicador rotulo="Plantões no mês" valor={noMes.length} icone={CalendarDays} tom="primary" />
        <Indicador
          rotulo="Horas escaladas"
          valor={`${Math.round(horasNoMes)}h`}
          icone={CalendarDays}
          tom="primary"
        />
        <Indicador
          rotulo="Equipes descobertas"
          valor={semCobertura.length}
          icone={AlertTriangle}
          tom={semCobertura.length > 0 ? 'destructive' : 'success'}
          detalhe="Hoje"
        />
      </div>

      {semCobertura.length > 0 && (
        <Aviso tom="destructive">
          Cobertura mínima não atingida hoje:{' '}
          {semCobertura.map((s) => `${s.equipe.nome} (faltam ${s.faltam})`).join(', ')}.
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
                const conflitos = lista.filter((p) => indisponiveis.has(p.id)).length;

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
                      {lista.slice(0, 3).map((p) => {
                        const conflito = indisponiveis.get(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] ${
                              conflito
                                ? 'bg-destructive/10 text-destructive line-through'
                                : p.status === 'trocado'
                                  ? 'bg-muted text-muted-foreground line-through'
                                  : 'bg-muted/60'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                p.tipo === 'noturno'
                                  ? 'bg-brand-blue'
                                  : p.tipo === 'diurno'
                                    ? 'bg-brand-gold'
                                    : p.tipo === 'comercial'
                                      ? 'bg-brand-orange'
                                      : 'bg-brand-coral'
                              }`}
                            />
                            <span className="truncate">{primeiroNome(nomeDe(p.funcionario_id))}</span>
                          </div>
                        );
                      })}
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
              <AlertTriangle className="h-3 w-3 text-destructive" /> Conflito com férias/ausência
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
                doDia(diaAberto).map((p) => {
                  const conflito = indisponiveis.get(p.id);
                  const pessoa = funcionarios.find((f) => f.id === p.funcionario_id);
                  return (
                    <div key={p.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start gap-2.5">
                        <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{pessoa?.nome}</p>
                          <p className="tabular text-xs text-muted-foreground">
                            {p.hora_inicio}–{p.hora_fim} ·{' '}
                            {duracaoTurnoHoras(p.hora_inicio, p.hora_fim)}h ·{' '}
                            {equipes.find((e) => e.id === pessoa?.equipe_id)?.nome}
                          </p>
                        </div>
                        <BadgeStatus
                          texto={TIPO_PLANTAO[p.tipo]}
                          classe={CLASSE_TIPO_PLANTAO[p.tipo]}
                          className="text-[10px]"
                        />
                      </div>

                      {conflito && (
                        <Aviso tom="destructive">
                          Escalado, mas estará {conflito === 'ferias' ? 'de férias' : 'afastado'}.
                          Providencie cobertura.
                        </Aviso>
                      )}

                      <div className="flex gap-2">
                        {p.status !== 'trocado' && p.data >= hojeIso && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setTrocaDe(p);
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
                              onClick={() => setEmEdicao({ ...p })}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                removerPlantao(p.id);
                                toast.success('Plantão removido da escala.');
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
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
                <div className="space-y-1.5">
                  <Label>Escala</Label>
                  <Select
                    value={emEdicao.escala_id ?? 'nenhuma'}
                    onValueChange={(v) =>
                      setEmEdicao({ ...emEdicao, escala_id: v === 'nenhuma' ? undefined : v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Avulso</SelectItem>
                      {escalas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
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
    </div>
  );
}
