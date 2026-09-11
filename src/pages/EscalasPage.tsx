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
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { DIAS_SEMANA, diaDaSemana, duracaoTurnoHoras, formatarData, hoje, somarDias } from '@/lib/date';
import { PAPEL_ESCALA, TIPO_ESCALA, TIPO_PLANTAO } from '@/lib/labels';
import { gerarRevezamentoDiario, gerarRodizioComBackup } from '@/lib/composicaoEscalas';
import {
  FOLGA,
  FOLGA_ID,
  classeDoTurno,
  codigoCurto,
  descricaoDoTurno,
  detalhesDoTurno,
  gradeDeDetalhes,
  legendaDaEquipe,
  type TurnoLegenda,
} from '@/lib/turnos';
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

/**
 * Grade do ciclo — semana × dia da semana — pintada com a legenda da equipe.
 *
 * Substitui o formulário de "adicionar turno" (semana, dia, tipo, início, fim,
 * um de cada vez): monta-se um ciclo de 3 semanas clicando 21 vezes, e não
 * preenchendo 21 formulários. O horário não aparece aqui porque vive no item
 * da legenda ("T.2 Noturno 19:00–07:00") — a célula guarda só qual turno é,
 * como na planilha, onde o código está na célula e a hora no cadastro.
 */
function GradeCiclo({
  escala,
  detalhes,
  legenda,
  salvarGrade,
}: {
  escala: Escala;
  detalhes: EscalaDetalhe[];
  legenda: TurnoLegenda[];
  salvarGrade: (turnos: Omit<EscalaDetalhe, 'id' | 'escala_id'>[]) => Promise<void>;
}) {
  const paleta = [FOLGA, ...legenda];
  const [grade, setGrade] = useState<TurnoLegenda[][]>(() =>
    gradeDeDetalhes(detalhes, escala.ciclo_semanas, legenda),
  );
  const [pincelId, setPincelId] = useState<string>(legenda[0]?.id ?? FOLGA_ID);
  const [salvando, setSalvando] = useState(false);

  const pincel = paleta.find((t) => t.id === pincelId) ?? FOLGA;

  // O número de semanas é editado no formulário acima, então a grade se ajusta
  // no próprio render — sem efeito colateral que apagaria o que já foi pintado.
  const semanas: TurnoLegenda[][] = Array.from({ length: escala.ciclo_semanas }, (_, i) =>
    grade[i] ?? Array.from({ length: 7 }, () => FOLGA),
  );

  const pintar = (semana: number, dia: number) =>
    setGrade(
      semanas.map((linha, i) =>
        i === semana ? linha.map((t, d) => (d === dia ? pincel : t)) : linha,
      ),
    );

  const pintarSemana = (semana: number) =>
    setGrade(semanas.map((linha, i) => (i === semana ? linha.map(() => pincel) : linha)));

  const pintarDia = (dia: number) =>
    setGrade(semanas.map((linha) => linha.map((t, d) => (d === dia ? pincel : t))));

  const aplicarPreset = (preset: 'comercial' | 'limpar') =>
    setGrade(
      semanas.map(() =>
        Array.from({ length: 7 }, (_, d) =>
          preset === 'comercial' && d >= 1 && d <= 5 ? pincel : FOLGA,
        ),
      ),
    );

  const salvar = async () => {
    setSalvando(true);
    try {
      const turnos = semanas.flatMap((linha, i) =>
        linha.flatMap((turno, dia) => detalhesDoTurno(turno, i + 1, dia)),
      );
      await salvarGrade(turnos);
      toast.success('Grade salva.');
    } catch {
      // A mensagem de erro já apareceu via toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  const diasTrabalhados = semanas.flat().filter((t) => t.trabalha);
  const horasSemana =
    diasTrabalhados.reduce((soma, t) => soma + duracaoTurnoHoras(t.hora_inicio, t.hora_fim), 0) /
    escala.ciclo_semanas;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[11px] text-muted-foreground">
          Escolha um turno da legenda e clique nas células. O cabeçalho do dia pinta a coluna
          inteira; o número da semana, a linha.
        </p>
        <div className="flex flex-wrap gap-1">
          {paleta.map((turno) => (
            <button
              key={turno.id}
              type="button"
              onClick={() => setPincelId(turno.id)}
              title={descricaoDoTurno(turno)}
              className={`rounded border px-2 py-1 text-[11px] font-medium transition-all ${classeDoTurno(turno)} ${
                pincelId === turno.id
                  ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              {turno.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="p-1.5 text-left font-medium text-muted-foreground">Sem.</th>
              {DIAS_SEMANA.map((d, i) => (
                <th key={d} className="p-0 text-center font-medium text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => pintarDia(i)}
                    title={`Aplicar "${pincel.rotulo}" em toda coluna`}
                    className="w-full p-1.5 hover:bg-accent"
                  >
                    {d}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((linha, i) => (
              <tr key={i} className="border-t">
                <td className="p-0">
                  <button
                    type="button"
                    onClick={() => pintarSemana(i)}
                    title={`Aplicar "${pincel.rotulo}" na semana inteira`}
                    className="tabular w-full p-1.5 text-left text-muted-foreground hover:bg-accent"
                  >
                    {i + 1}
                  </button>
                </td>
                {linha.map((turno, dia) => (
                  <td key={dia} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => pintar(i, dia)}
                      title={`${turno.rotulo} — ${descricaoDoTurno(turno)}`}
                      className={`w-full rounded border px-1 py-1.5 text-[10px] font-medium transition-colors hover:brightness-110 ${classeDoTurno(turno)}`}
                    >
                      {turno.codigo}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => aplicarPreset('comercial')}
        >
          Seg a sex
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => aplicarPreset('limpar')}
        >
          Limpar
        </Button>
        <span className="tabular ml-auto text-[11px] text-muted-foreground">
          {Math.round(horasSemana * 10) / 10}h por semana
        </span>
      </div>

      <Button type="button" size="sm" className="w-full" disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando...' : 'Salvar grade'}
      </Button>
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
        turno_tipo: tipo,
        turno_inicio: horaInicio,
        turno_fim: horaFim,
        sobreaviso_inicio: horaInicio,
        sobreaviso_fim: horaFim,
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
        // Aqui o turno é o próprio plantão: as duas janelas são a mesma.
        turno_tipo: tipo,
        turno_inicio: horaInicio,
        turno_fim: horaFim,
        sobreaviso_inicio: horaInicio,
        sobreaviso_fim: horaFim,
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
          // Mesma grade da principal, mas marcada como backup: é o que faz o
          // calendário mostrar segunda linha e a cobertura não contá-la.
          ...rodizio.detalhes.map((d) =>
            salvarEscalaDetalhe({ ...d, tipo: 'backup', id: novoId('ed'), escala_id: idBackup }),
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
    tiposTurno,
    escalaDetalhes,
    escalaFuncionarios,
    funcionarios,
    equipes,
    salvarEscala,
    removerEscala,
    salvarEscalaDetalhe,
    salvarEscalaFuncionario,
    removerEscalaFuncionario,
    salvarGradeEscala,
  } = useDados();
  const { podeGerenciar } = useAuth();

  const [busca, setBusca] = useState('');
  const [emEdicao, setEmEdicao] = useState<Escala | null>(null);
  const [ehNova, setEhNova] = useState(false);
  const [assistente, setAssistente] = useState<'revezamento' | 'rodizio' | null>(null);
  const [aExcluir, setAExcluir] = useState<Escala | null>(null);

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
      turno_tipo: 'comercial',
      turno_inicio: '08:00',
      turno_fim: '17:00',
      sobreaviso_inicio: '00:00',
      sobreaviso_fim: '23:59',
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
                        className="h-7 w-7 text-destructive"
                        title="Excluir escala"
                        onClick={() => setAExcluir(esc)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
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

                  {/* O ciclo inteiro num relance — o mesmo desenho que o editor
                      pinta, em miniatura. Lista de horários repetidos não dizia
                      qual era o padrão. */}
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Ciclo de {esc.ciclo_semanas} semana(s)
                      </p>
                      <span className="tabular text-[11px] text-muted-foreground">
                        {esc.turno_inicio}–{esc.turno_fim}
                      </span>
                    </div>
                    {detalhes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Grade ainda não montada.</p>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="grid grid-cols-7 gap-0.5">
                          {DIAS_SEMANA.map((d) => (
                            <span key={d} className="text-center text-[9px] text-muted-foreground">
                              {d}
                            </span>
                          ))}
                        </div>
                        {gradeDeDetalhes(
                          detalhes,
                          esc.ciclo_semanas,
                          legendaDaEquipe(tiposTurno, esc.equipe_id),
                        ).map((linha, i) => (
                          <div key={i} className="grid grid-cols-7 gap-0.5">
                            {linha.map((turno, dia) => (
                              <span
                                key={dia}
                                title={`Semana ${i + 1} · ${DIAS_SEMANA[dia]} · ${turno.rotulo}`}
                                className={`rounded border py-0.5 text-center text-[9px] font-semibold ${classeDoTurno(turno)}`}
                              >
                                {codigoCurto(turno)}
                              </span>
                            ))}
                          </div>
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
                    <Label>O que acontece em cada dia do ciclo</Label>
                    <GradeCiclo
                      // Remontar ao trocar de escala: a grade tem estado local,
                      // e reaproveitar o componente mostraria a grade anterior.
                      key={emEdicao.id}
                      escala={emEdicao}
                      detalhes={escalaDetalhes.filter((d) => d.escala_id === emEdicao.id)}
                      legenda={legendaDaEquipe(tiposTurno, emEdicao.equipe_id)}
                      salvarGrade={(turnos) => salvarGradeEscala(emEdicao.id, turnos)}
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

      <AlertDialog open={aExcluir !== null} onOpenChange={(v) => !v && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a escala {aExcluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A grade do ciclo e os vínculos das pessoas somem junto. Os plantões que já foram
              gerados ficam no calendário — apague-os por lá se também não quiser mais.
              {aExcluir &&
                escalaFuncionarios.filter((v) => v.escala_id === aExcluir.id).length > 0 &&
                ` ${escalaFuncionarios.filter((v) => v.escala_id === aExcluir.id).length} pessoa(s) deixam de seguir esta escala.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!aExcluir) return;
                await removerEscala(aExcluir.id);
                toast.success('Escala excluída.');
                setAExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
