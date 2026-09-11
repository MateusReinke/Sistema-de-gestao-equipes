import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  Pencil,
  Plus,
  Repeat,
  Search,
  ShieldHalf,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { DIAS_SEMANA, diaDaSemana, duracaoTurnoHoras, formatarData, hoje, somarDias } from '@/lib/date';
import { PAPEL_ESCALA, TIPO_ESCALA, TIPO_PLANTAO } from '@/lib/labels';
import { gerarRevezamentoDiario, gerarRodizioComBackup } from '@/lib/composicaoEscalas';
import type {
  Equipe,
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
          Âncora é a data que marca a semana 1, dia 1 do ciclo — só para esta pessoa. Isso reveza
          direito quando o rodízio é por semana cheia (ex.: plantão de infra, uma pessoa por
          semana): mesma escala, âncoras espaçadas em semanas inteiras. Para um par que alterna
          dia sim, dia não (ex.: 12×36), uma âncora com 1 dia de diferença nesta mesma escala
          <strong> não fecha</strong> — use "Revezamento 12×36" no menu de nova escala, que monta
          o par certo sozinho.
        </p>
        <Button type="button" size="sm" className="w-full" onClick={vincular}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Vincular
        </Button>
      </div>
    </div>
  );
}

interface AssistenteProps {
  aberto: boolean;
  aoFechar: () => void;
  equipes: Equipe[];
  funcionarios: Funcionario[];
  salvarEscala: (e: Escala) => Promise<void>;
  salvarEscalaDetalhe: (d: EscalaDetalhe) => Promise<void>;
  salvarEscalaFuncionario: (v: EscalaFuncionario) => Promise<void>;
}

/**
 * "Nova escala" guiada para o caso mais comum e mais fácil de errar à mão: um
 * par que reveza dia sim, dia não (12×36). Preenchendo quem trabalha hoje, a
 * outra posição já fica definida para o dia seguinte — não pede para
 * desenhar a grade da segunda pessoa, porque `gerarRevezamentoDiario` deriva
 * o complemento exato a partir de um único dia de referência.
 */
function NovoRevezamentoDiario({
  aberto,
  aoFechar,
  equipes,
  funcionarios,
  salvarEscala,
  salvarEscalaDetalhe,
  salvarEscalaFuncionario,
}: AssistenteProps) {
  const hojeIso = hoje();
  const [equipeId, setEquipeId] = useState('');
  const [nomeBase, setNomeBase] = useState('');
  const [tipo, setTipo] = useState<TipoPlantao>('noturno');
  const [horaInicio, setHoraInicio] = useState('19:00');
  const [horaFim, setHoraFim] = useState('07:00');
  const [diaBase, setDiaBase] = useState(hojeIso);
  const [funcionario1Id, setFuncionario1Id] = useState('');
  const [funcionario2Id, setFuncionario2Id] = useState('');
  const [dataFim, setDataFim] = useState(somarDias(hojeIso, 365 * 5));
  const [salvando, setSalvando] = useState(false);

  const reiniciar = () => {
    setEquipeId('');
    setNomeBase('');
    setTipo('noturno');
    setHoraInicio('19:00');
    setHoraFim('07:00');
    setDiaBase(hoje());
    setFuncionario1Id('');
    setFuncionario2Id('');
    setDataFim(somarDias(hoje(), 365 * 5));
  };

  const funcionariosDaEquipe = funcionarios.filter(
    (f) => f.status !== 'desligado' && (!equipeId || f.equipe_id === equipeId),
  );

  const proximoDia = somarDias(diaBase, 1);
  const previaPosicao1 = [0, 2, 4, 6].map((n) => formatarData(somarDias(diaBase, n)));
  const previaPosicao2 = [0, 2, 4, 6].map((n) => formatarData(somarDias(proximoDia, n)));

  const salvar = async () => {
    if (!equipeId) return toast.error('Escolha a equipe.');
    if (!nomeBase.trim()) return toast.error('Dê um nome para a escala (ex.: "NOC Noturno").');
    if (!funcionario1Id || !funcionario2Id) {
      return toast.error('Escolha as duas pessoas que revezam entre si.');
    }
    if (funcionario1Id === funcionario2Id) {
      return toast.error('As duas posições precisam ser pessoas diferentes.');
    }
    if (horaInicio === horaFim) return toast.error('Início e fim do turno não podem ser iguais.');
    if (dataFim < diaBase) return toast.error('A vigência não pode terminar antes de começar.');

    setSalvando(true);
    try {
      const nome = nomeBase.trim();
      const base: Escala = {
        id: novoId('esc'),
        nome: `${nome} · Posição 1`,
        tipo: '12x36',
        descricao: `Revezamento 12×36 (dia sim, dia não) a partir de ${DIAS_SEMANA[diaDaSemana(diaBase)]}`,
        equipe_id: equipeId,
        ciclo_semanas: 2,
        papel: 'trabalho',
        ativo: true,
      };
      const escalaA: Escala = base;
      const escalaB: Escala = { ...base, id: novoId('esc'), nome: `${nome} · Posição 2` };

      await salvarEscala(escalaA);
      await salvarEscala(escalaB);

      const par = gerarRevezamentoDiario({ diaBase, horaInicio, horaFim, tipo });

      await Promise.all([
        ...par.detalhesPosicao1.map((d) =>
          salvarEscalaDetalhe({ ...d, id: novoId('ed'), escala_id: escalaA.id }),
        ),
        ...par.detalhesPosicao2.map((d) =>
          salvarEscalaDetalhe({ ...d, id: novoId('ed'), escala_id: escalaB.id }),
        ),
        salvarEscalaFuncionario({
          id: novoId('ef'),
          escala_id: escalaA.id,
          funcionario_id: funcionario1Id,
          ancora_em: diaBase,
          data_inicio: diaBase,
          data_fim: dataFim,
        }),
        salvarEscalaFuncionario({
          id: novoId('ef'),
          escala_id: escalaB.id,
          funcionario_id: funcionario2Id,
          ancora_em: diaBase,
          data_inicio: diaBase,
          data_fim: dataFim,
        }),
      ]);

      toast.success('Revezamento criado — as duas posições já ficam alternando sozinhas.');
      reiniciar();
      aoFechar();
    } catch {
      toast.error('Não foi possível criar o revezamento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Revezamento 12×36</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Duas pessoas revezando dia sim, dia não no mesmo horário. Preencha quem trabalha no dia
            de referência — a outra pessoa já fica marcada para o dia seguinte, sem precisar montar
            a grade dela à mão.
          </p>

          <div className="space-y-1.5">
            <Label>Equipe</Label>
            <Select value={equipeId} onValueChange={setEquipeId}>
              <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
              <SelectContent>
                {equipes.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da escala</Label>
            <Input
              value={nomeBase}
              placeholder="Ex.: NOC Noturno"
              onChange={(e) => setNomeBase(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Vira duas escalas — "{nomeBase.trim() || 'Nome'} · Posição 1" e "· Posição 2" — para
              cada metade do par.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPlantao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_PLANTAO) as TipoPlantao[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_PLANTAO[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Quem trabalha neste dia?</Label>
            <Input type="date" value={diaBase} onChange={(e) => setDiaBase(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              Dia de referência — não precisa ser hoje. A partir dele o par já se estende para
              qualquer data, para trás e para frente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Posição 1 ({formatarData(diaBase)})</Label>
              <Select value={funcionario1Id} onValueChange={setFuncionario1Id}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionariosDaEquipe.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Posição 2 ({formatarData(proximoDia)})</Label>
              <Select value={funcionario2Id} onValueChange={setFuncionario2Id}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {funcionariosDaEquipe.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {funcionario1Id && funcionario2Id && funcionario1Id !== funcionario2Id && (
            <Aviso tom="info">
              <span className="tabular">
                Posição 1 trabalha em {previaPosicao1.join(', ')}…<br />
                Posição 2 trabalha em {previaPosicao2.join(', ')}…
              </span>
            </Aviso>
          )}

          <div className="space-y-1.5">
            <Label>Vigência até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" disabled={salvando} onClick={aoFechar}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={salvando} onClick={salvar}>
              {salvando ? 'Criando...' : 'Criar revezamento'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * "Nova escala" guiada para sobreaviso rotativo com backup em cascata (ex.:
 * plantonista de infra): uma lista ordenada de pessoas, cada uma assumindo
 * por `semanasPorTurno` semanas, com a próxima da lista sempre coberta como
 * backup — `gerarRodizioComBackup` calcula as âncoras de cada vínculo.
 */
function NovoRodizioComBackup({
  aberto,
  aoFechar,
  equipes,
  funcionarios,
  salvarEscala,
  salvarEscalaDetalhe,
  salvarEscalaFuncionario,
}: AssistenteProps) {
  const hojeIso = hoje();
  const [equipeId, setEquipeId] = useState('');
  const [nomeBase, setNomeBase] = useState('');
  const [tipo, setTipo] = useState<TipoPlantao>('sobreaviso');
  const [horaInicio, setHoraInicio] = useState('00:00');
  const [horaFim, setHoraFim] = useState('23:59');
  const [dataInicio, setDataInicio] = useState(hojeIso);
  const [dataFim, setDataFim] = useState(somarDias(hojeIso, 365 * 3));
  const [semanasPorTurno, setSemanasPorTurno] = useState(1);
  const [comBackup, setComBackup] = useState(true);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [paraAdicionar, setParaAdicionar] = useState('');
  const [salvando, setSalvando] = useState(false);

  const reiniciar = () => {
    setEquipeId('');
    setNomeBase('');
    setTipo('sobreaviso');
    setHoraInicio('00:00');
    setHoraFim('23:59');
    setDataInicio(hoje());
    setDataFim(somarDias(hoje(), 365 * 3));
    setSemanasPorTurno(1);
    setComBackup(true);
    setParticipantes([]);
    setParaAdicionar('');
  };

  const funcionariosDaEquipe = funcionarios.filter(
    (f) => f.status !== 'desligado' && (!equipeId || f.equipe_id === equipeId),
  );
  const nomeDe = (id: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';

  const adicionarParticipante = () => {
    if (!paraAdicionar) return;
    if (participantes.includes(paraAdicionar)) {
      return toast.error('Essa pessoa já está na lista.');
    }
    setParticipantes([...participantes, paraAdicionar]);
    setParaAdicionar('');
  };

  const removerParticipante = (id: string) => setParticipantes(participantes.filter((p) => p !== id));

  const mover = (indice: number, direcao: -1 | 1) => {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= participantes.length) return;
    const copia = [...participantes];
    [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];
    setParticipantes(copia);
  };

  const salvar = async () => {
    if (!equipeId) return toast.error('Escolha a equipe.');
    if (!nomeBase.trim()) return toast.error('Dê um nome para a escala (ex.: "Plantão Infra").');
    if (participantes.length < 2) return toast.error('Adicione ao menos 2 pessoas ao rodízio.');
    if (horaInicio === horaFim) return toast.error('Início e fim do turno não podem ser iguais.');
    if (dataFim < dataInicio) return toast.error('A vigência não pode terminar antes de começar.');

    setSalvando(true);
    try {
      const nome = nomeBase.trim();
      const cicloSemanas = participantes.length * semanasPorTurno;
      const escalaPrincipal: Escala = {
        id: novoId('esc'),
        nome: `${nome} · Plantão`,
        tipo: 'personalizada',
        descricao: `Rodízio entre ${participantes.length} pessoas, ${semanasPorTurno} semana(s) cada`,
        equipe_id: equipeId,
        ciclo_semanas: cicloSemanas,
        papel: 'plantao',
        ativo: true,
      };
      await salvarEscala(escalaPrincipal);

      let escalaBackup: Escala | null = null;
      if (comBackup) {
        escalaBackup = {
          ...escalaPrincipal,
          id: novoId('esc'),
          nome: `${nome} · Backup`,
          papel: 'backup',
          descricao: 'Backup rotativo — sempre a próxima pessoa da lista do plantão principal',
        };
        await salvarEscala(escalaBackup);
      }

      const rodizio = gerarRodizioComBackup({
        participantes,
        dataInicio,
        dataFim,
        horaInicio,
        horaFim,
        tipo,
        semanasPorTurno,
      });

      const tarefas: Promise<void>[] = [
        ...rodizio.detalhes.map((d) =>
          salvarEscalaDetalhe({ ...d, id: novoId('ed'), escala_id: escalaPrincipal.id }),
        ),
        ...rodizio.vinculosPrincipal.map((v) =>
          salvarEscalaFuncionario({ ...v, id: novoId('ef'), escala_id: escalaPrincipal.id }),
        ),
      ];
      if (escalaBackup) {
        const idBackup = escalaBackup.id;
        tarefas.push(
          ...rodizio.detalhes.map((d) =>
            salvarEscalaDetalhe({ ...d, id: novoId('ed'), escala_id: idBackup }),
          ),
          ...rodizio.vinculosBackup.map((v) =>
            salvarEscalaFuncionario({ ...v, id: novoId('ef'), escala_id: idBackup }),
          ),
        );
      }
      await Promise.all(tarefas);

      toast.success('Rodízio criado — o backup já gira sozinho junto com o plantão principal.');
      reiniciar();
      aoFechar();
    } catch {
      toast.error('Não foi possível criar o rodízio. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && !salvando && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Sobreaviso rotativo com backup</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Uma lista ordenada de pessoas revezando o plantão semana a semana (ex.: G1, G2, G3).
            Enquanto uma está de plantão principal, a próxima da lista já fica de backup
            automaticamente — ao chegar no fim da lista, o backup volta para a primeira pessoa.
          </p>

          <div className="space-y-1.5">
            <Label>Equipe</Label>
            <Select value={equipeId} onValueChange={setEquipeId}>
              <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
              <SelectContent>
                {equipes.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da escala</Label>
            <Input
              value={nomeBase}
              placeholder="Ex.: Plantão Infra"
              onChange={(e) => setNomeBase(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPlantao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_PLANTAO) as TipoPlantao[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_PLANTAO[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Semanas por turno</Label>
              <Input
                type="number"
                min={1}
                max={8}
                value={semanasPorTurno}
                onChange={(e) => setSemanasPorTurno(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início do plantão</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim do plantão</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            00:00–23:59 cobre o dia inteiro. Se a equipe já tem cobertura em horário comercial à
            parte, use algo como 18:00–09:00 para o sobreaviso valer só fora desse horário.
          </p>

          <div className="space-y-1.5">
            <Label>Quando a 1ª pessoa da lista assume</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs">Ordem do rodízio</Label>
            {participantes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ninguém adicionado ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {participantes.map((id, i) => (
                  <div key={id} className="flex items-center gap-2 rounded-lg border p-2">
                    <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <Avatar nome={nomeDe(id)} tamanho="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm">{nomeDe(id)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={i === participantes.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removerParticipante(id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={paraAdicionar} onValueChange={setParaAdicionar}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Adicionar pessoa" /></SelectTrigger>
                <SelectContent>
                  {funcionariosDaEquipe
                    .filter((f) => !participantes.includes(f.id))
                    .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" className="h-8 shrink-0" onClick={adicionarParticipante}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Backup automático</Label>
              <p className="text-xs text-muted-foreground">
                Cria uma segunda escala de backup, revezando junto com a principal.
              </p>
            </div>
            <Switch checked={comBackup} onCheckedChange={setComBackup} />
          </div>

          {comBackup && participantes.length >= 2 && (
            <Aviso tom="info">
              <div className="space-y-0.5">
                {participantes.map((id, i) => {
                  const proximo = participantes[(i + 1) % participantes.length];
                  return (
                    <p key={id}>
                      Semana de <strong>{nomeDe(id)}</strong> → backup <strong>{nomeDe(proximo)}</strong>
                    </p>
                  );
                })}
              </div>
            </Aviso>
          )}

          <div className="space-y-1.5">
            <Label>Vigência até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" disabled={salvando} onClick={aoFechar}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={salvando} onClick={salvar}>
              {salvando ? 'Criando...' : 'Criar rodízio'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
  const [assistente, setAssistente] = useState<'revezamento' | 'rodizio' | null>(null);

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nova escala
                  <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onClick={() => setAssistente('revezamento')} className="gap-2.5 py-2.5">
                  <Repeat className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Revezamento 12×36</p>
                    <p className="text-xs text-muted-foreground">
                      Duas pessoas alternando dia sim, dia não. Ex.: NOC diurno/noturno.
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAssistente('rodizio')} className="gap-2.5 py-2.5">
                  <ShieldHalf className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Sobreaviso rotativo com backup</p>
                    <p className="text-xs text-muted-foreground">
                      Lista de pessoas revezando por semana, com backup automático. Ex.: plantão de infra.
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={abrirNova} className="gap-2.5 py-2.5">
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Avançado (manual)</p>
                    <p className="text-xs text-muted-foreground">
                      Monta a grade e os vínculos turno a turno. Para 5×2, 6×1 e casos fora do padrão.
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      <NovoRevezamentoDiario
        aberto={assistente === 'revezamento'}
        aoFechar={() => setAssistente(null)}
        equipes={equipes}
        funcionarios={funcionarios}
        salvarEscala={salvarEscala}
        salvarEscalaDetalhe={salvarEscalaDetalhe}
        salvarEscalaFuncionario={salvarEscalaFuncionario}
      />
      <NovoRodizioComBackup
        aberto={assistente === 'rodizio'}
        aoFechar={() => setAssistente(null)}
        equipes={equipes}
        funcionarios={funcionarios}
        salvarEscala={salvarEscala}
        salvarEscalaDetalhe={salvarEscalaDetalhe}
        salvarEscalaFuncionario={salvarEscalaFuncionario}
      />
    </div>
  );
}
