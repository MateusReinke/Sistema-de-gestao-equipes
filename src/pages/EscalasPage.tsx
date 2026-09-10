import { useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { DIAS_SEMANA, duracaoTurnoHoras, formatarData, hoje, somarDias } from '@/lib/date';
import { PAPEL_ESCALA, TIPO_ESCALA, TIPO_PLANTAO } from '@/lib/labels';
import type {
  Escala,
  EscalaDetalhe,
  EscalaFuncionario,
  Funcionario,
  PapelEscala,
  TipoEscala,
  TipoPlantao,
} from '@/types/sgo';

/** Grade semana do ciclo × dia da semana: mostra e edita os turnos-modelo da escala. */
function GradeTurnos({
  escala,
  detalhes,
  salvar,
  remover,
}: {
  escala: Escala;
  detalhes: EscalaDetalhe[];
  salvar: (d: EscalaDetalhe) => Promise<void>;
  remover: (id: string) => Promise<void>;
}) {
  const [semana, setSemana] = useState('1');
  const [diaSemana, setDiaSemana] = useState('1');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('17:00');
  const [tipo, setTipo] = useState<TipoPlantao>('comercial');

  const semanas = Array.from({ length: escala.ciclo_semanas }, (_, i) => i + 1);
  const naCelula = (s: number, d: number) =>
    detalhes
      .filter((t) => t.semana_do_ciclo === s && t.dia_semana === d)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  const adicionar = async () => {
    await salvar({
      id: novoId('ed'),
      escala_id: escala.id,
      semana_do_ciclo: Number(semana),
      dia_semana: Number(diaSemana),
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      tipo,
    });
    toast.success('Turno adicionado ao modelo.');
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="p-1.5 text-left font-medium text-muted-foreground">Sem.</th>
              {DIAS_SEMANA.map((d) => (
                <th key={d} className="p-1.5 text-center font-medium text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s} className="border-t">
                <td className="tabular p-1.5 text-muted-foreground">{s}</td>
                {DIAS_SEMANA.map((_, d) => (
                  <td key={d} className="p-1 align-top">
                    <div className="flex flex-col gap-1">
                      {naCelula(s, d).map((t) => (
                        <span
                          key={t.id}
                          className="tabular flex items-center gap-1 rounded border bg-muted px-1 py-0.5 text-[10px]"
                          title={`${t.hora_inicio}–${t.hora_fim} · ${TIPO_PLANTAO[t.tipo]}`}
                        >
                          {t.hora_inicio}
                          <button
                            type="button"
                            onClick={() => remover(t.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Semana</Label>
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {semanas.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dia</Label>
          <Select value={diaSemana} onValueChange={setDiaSemana}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIAS_SEMANA.map((d, i) => (
                <SelectItem key={d} value={String(i)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPlantao)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TIPO_PLANTAO) as TipoPlantao[]).map((t) => (
                <SelectItem key={t} value={t}>{TIPO_PLANTAO[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Início</Label>
          <Input className="h-8" type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fim</Label>
          <Input className="h-8" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" size="sm" className="h-8 w-full" onClick={adicionar}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Quem segue esta escala, com data de vigência e a âncora do ciclo pessoal. */
function VinculosEscala({
  escala,
  vinculos,
  funcionarios,
  salvar,
  remover,
}: {
  escala: Escala;
  vinculos: EscalaFuncionario[];
  funcionarios: Funcionario[];
  salvar: (v: EscalaFuncionario) => Promise<void>;
  remover: (id: string) => Promise<void>;
}) {
  const hojeIso = hoje();
  const [funcionarioId, setFuncionarioId] = useState('');
  const [ancoraEm, setAncoraEm] = useState(hojeIso);
  const [dataInicio, setDataInicio] = useState(hojeIso);
  const [dataFim, setDataFim] = useState(somarDias(hojeIso, 180));

  const vincular = async () => {
    if (!funcionarioId) return toast.error('Escolha um funcionário.');
    await salvar({
      id: novoId('ef'),
      funcionario_id: funcionarioId,
      escala_id: escala.id,
      ancora_em: ancoraEm,
      data_inicio: dataInicio,
      data_fim: dataFim,
    });
    toast.success('Funcionário vinculado.');
    setFuncionarioId('');
  };

  return (
    <div className="space-y-3">
      {vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguém vinculado ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {vinculos.map((v) => {
            const pessoa = funcionarios.find((f) => f.id === v.funcionario_id);
            return (
              <div key={v.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{pessoa?.nome ?? '—'}</p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    âncora {formatarData(v.ancora_em)} · até {formatarData(v.data_fim)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => remover(v.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-3">
        <div className="space-y-1">
          <Label className="text-xs">Funcionário</Label>
          <Select value={funcionarioId} onValueChange={setFuncionarioId}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {funcionarios
                .filter((f) => f.status !== 'desligado')
                .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Âncora</Label>
            <Input className="h-8" type="date" value={ancoraEm} onChange={(e) => setAncoraEm(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Início</Label>
            <Input className="h-8" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fim</Label>
            <Input className="h-8" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Âncora é a data que marca a semana 1, dia 1 do ciclo — só para esta pessoa. É o que faz
          duas pessoas na mesma escala revezarem: mesma escala, âncoras diferentes.
        </p>
        <Button type="button" size="sm" className="w-full" onClick={vincular}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Vincular
        </Button>
      </div>
    </div>
  );
}

export default function EscalasPage() {
  const {
    escalas,
    escalaDetalhes,
    escalaFuncionarios,
    funcionarios,
    equipes,
    salvarEscala,
    salvarEscalaDetalhe,
    removerEscalaDetalhe,
    salvarEscalaFuncionario,
    removerEscalaFuncionario,
  } = useDados();
  const { podeGerenciar } = useAuth();

  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<Escala | null>(null);
  const [ehNova, setEhNova] = useState(false);

  const hojeIso = hoje();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return escalas.filter(
      (e) => e.nome.toLowerCase().includes(termo) || e.descricao.toLowerCase().includes(termo),
    );
  }, [escalas, busca]);

  const abrirNova = () => {
    setEmEdicao({
      id: novoId('esc'),
      nome: '',
      tipo: '5x2',
      descricao: '',
      ciclo_semanas: 1,
      papel: 'trabalho',
      ativo: true,
    });
    setEhNova(true);
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (!emEdicao.nome.trim()) return toast.error('Informe o nome da escala.');
    salvarEscala({ ...emEdicao, nome: emEdicao.nome.trim() });
    toast.success(ehNova ? 'Escala criada.' : 'Escala atualizada.');
    setEmEdicao(null);
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Escalas"
        descricao="Modelos de turno e quem está vinculado a cada um."
        acoes={
          podeGerenciar && (
            <Button onClick={abrirNova}>
              <Plus className="mr-2 h-4 w-4" /> Nova escala
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar escalas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtradas.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio icone={CalendarClock} titulo="Nenhuma escala encontrada" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtradas.map((esc) => {
            const detalhes = escalaDetalhes
              .filter((d) => d.escala_id === esc.id)
              .sort((a, b) => a.semana_do_ciclo - b.semana_do_ciclo || a.dia_semana - b.dia_semana);
            const vinculos = escalaFuncionarios.filter(
              (v) => v.escala_id === esc.id && v.data_fim >= hojeIso,
            );
            // Os turnos cobrem o ciclo inteiro, não uma semana só — a média
            // semanal é o total dividido pelo número de semanas do ciclo.
            const cargaSemanal =
              detalhes.reduce((soma, d) => soma + duracaoTurnoHoras(d.hora_inicio, d.hora_fim), 0) /
              esc.ciclo_semanas;

            return (
              <Card key={esc.id} className={`shadow-card ${!esc.ativo ? 'opacity-60' : ''}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10">
                      <CalendarClock className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{esc.nome}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">{esc.descricao}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {esc.equipe_id && (
                      <BadgeStatus
                        texto={equipes.find((e) => e.id === esc.equipe_id)?.nome ?? '—'}
                        classe="bg-muted text-muted-foreground border-border"
                        className="text-[10px]"
                      />
                    )}
                    <BadgeStatus
                      texto={TIPO_ESCALA[esc.tipo]}
                      classe="bg-primary/10 text-primary border-primary/25"
                      className="text-[10px]"
                    />
                    {podeGerenciar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEmEdicao({ ...esc });
                          setEhNova(false);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="tabular">
                      <strong className="text-foreground">{Math.round(cargaSemanal * 10) / 10}h</strong>{' '}
                      por semana
                    </span>
                    <span className="tabular">
                      <strong className="text-foreground">{vinculos.length}</strong> vinculado(s)
                    </span>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Turnos
                    </p>
                    {detalhes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem horários definidos.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {detalhes.map((d) => (
                          <span
                            key={d.id}
                            className="tabular rounded border bg-muted px-2 py-0.5 text-[11px]"
                          >
                            {esc.ciclo_semanas > 1 && `S${d.semana_do_ciclo} `}
                            {DIAS_SEMANA[d.dia_semana]} {d.hora_inicio}–{d.hora_fim}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Vinculados
                    </p>
                    {vinculos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ninguém vinculado atualmente.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {vinculos.map((v) => {
                          const pessoa = funcionarios.find((f) => f.id === v.funcionario_id);
                          return (
                            <div key={v.id} className="flex items-center gap-2">
                              <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                              <span className="min-w-0 flex-1 truncate text-sm">{pessoa?.nome}</span>
                              <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                                até {formatarData(v.data_fim)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{ehNova ? 'Nova escala' : 'Editar escala'}</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={emEdicao.nome}
                  onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Equipe</Label>
                <Select
                  value={emEdicao.equipe_id ?? 'nenhuma'}
                  onValueChange={(v) =>
                    setEmEdicao({ ...emEdicao, equipe_id: v === 'nenhuma' ? undefined : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma (escala global)</SelectItem>
                    {equipes.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={emEdicao.tipo}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo: v as TipoEscala })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TIPO_ESCALA) as TipoEscala[]).map((t) => (
                        <SelectItem key={t} value={t}>{TIPO_ESCALA[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  <Select
                    value={emEdicao.papel}
                    onValueChange={(v) => setEmEdicao({ ...emEdicao, papel: v as PapelEscala })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAPEL_ESCALA) as PapelEscala[]).map((p) => (
                        <SelectItem key={p} value={p}>{PAPEL_ESCALA[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Semanas no ciclo</Label>
                <Input
                  type="number"
                  min={1}
                  max={9}
                  value={emEdicao.ciclo_semanas}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, ciclo_semanas: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  1 para o mesmo padrão toda semana (5×2, 6×1). 2 já cobre 12×36 — o rodízio some e
                  volta a cair no mesmo dia da semana a cada 2 semanas.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={emEdicao.descricao}
                  placeholder="Ex.: Turno diurno 07h–19h em dias alternados"
                  onChange={(e) => setEmEdicao({ ...emEdicao, descricao: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label className="text-sm">Escala ativa</Label>
                <Switch
                  checked={emEdicao.ativo}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, ativo: v })}
                />
              </div>

              {!ehNova && (
                <>
                  <div className="space-y-1.5 border-t pt-4">
                    <Label>Turnos do ciclo</Label>
                    <GradeTurnos
                      escala={emEdicao}
                      detalhes={escalaDetalhes.filter((d) => d.escala_id === emEdicao.id)}
                      salvar={salvarEscalaDetalhe}
                      remover={removerEscalaDetalhe}
                    />
                  </div>
                  <div className="space-y-1.5 border-t pt-4">
                    <Label>Vinculados</Label>
                    <VinculosEscala
                      escala={emEdicao}
                      vinculos={escalaFuncionarios.filter((v) => v.escala_id === emEdicao.id)}
                      funcionarios={funcionarios}
                      salvar={salvarEscalaFuncionario}
                      remover={removerEscalaFuncionario}
                    />
                  </div>
                </>
              )}

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
    </div>
  );
}
