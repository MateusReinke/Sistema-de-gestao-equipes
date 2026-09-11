/**
 * Editor de uma escala: o padrão do ciclo e quem ocupa cada posição dele.
 *
 * Mora dentro da tela da equipe porque escala é da equipe — era em telas
 * separadas, e dava para mexer numa sem ver o efeito na outra.
 *
 * A ideia toda cabe em duas perguntas:
 *
 * 1. **O que acontece em cada dia do ciclo** — a grade, pintada com a legenda
 *    da equipe.
 * 2. **Quem ocupa cada posição** — numa escala de 2 semanas há 2 posições;
 *    quem está na 1 roda a semana 1 do ciclo enquanto quem está na 2 roda a
 *    semana 2, e na semana seguinte trocam. É assim que um par 12×36 alterna
 *    dia sim, dia não com uma escala só.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso } from '@/components/comum';
import { novoId } from '@/data/store';
import { DIAS_SEMANA, duracaoTurnoHoras, formatarData, somarDias } from '@/lib/date';
import { PAPEL_ESCALA, TIPO_ESCALA } from '@/lib/labels';
import { ancoraDaPosicao, posicaoDaAncora } from '@/lib/composicaoEscalas';
import {
  FOLGA,
  FOLGA_ID,
  classeDoTurno,
  descricaoDoTurno,
  detalhesDoTurno,
  gradeDeDetalhes,
  type TurnoLegenda,
} from '@/lib/turnos';
import type {
  Escala,
  EscalaDetalhe,
  EscalaFuncionario,
  Funcionario,
  PapelEscala,
  TipoEscala,
} from '@/types/sgo';

/** Grade do ciclo — semana × dia da semana — pintada com a legenda da equipe. */
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
      semanas.map((linha, i) => (i === semana ? linha.map((t, d) => (d === dia ? pincel : t)) : linha)),
    );
  const pintarSemana = (semana: number) =>
    setGrade(semanas.map((linha, i) => (i === semana ? linha.map(() => pincel) : linha)));
  const pintarDia = (dia: number) =>
    setGrade(semanas.map((linha) => linha.map((t, d) => (d === dia ? pincel : t))));

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarGrade(
        semanas.flatMap((linha, i) => linha.flatMap((turno, dia) => detalhesDoTurno(turno, i + 1, dia))),
      );
      toast.success('Grade salva.');
    } catch {
      // A mensagem de erro já apareceu via toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  const horasSemana =
    semanas
      .flat()
      .filter((t) => t.trabalha)
      .reduce((soma, t) => soma + duracaoTurnoHoras(t.hora_inicio, t.hora_fim), 0) /
    escala.ciclo_semanas;

  return (
    <div className="space-y-3">
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

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="p-1.5 text-left font-medium text-muted-foreground">Pos.</th>
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

      <div className="flex items-center gap-2">
        <span className="tabular text-[11px] text-muted-foreground">
          {Math.round(horasSemana * 10) / 10}h por semana, por posição
        </span>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={salvando}
          onClick={salvar}
        >
          {salvando ? 'Salvando...' : 'Salvar grade'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Quem ocupa cada posição do rodízio.
 *
 * Antes isto pedia uma *data de âncora* por pessoa, e acertar essa data era
 * onde a escala saía errada. A posição diz a mesma coisa sem conta nenhuma:
 * a âncora é derivada dela (`ancoraDaPosicao`).
 */
function PosicoesEscala({
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
  const [funcionarioId, setFuncionarioId] = useState('');
  const [posicao, setPosicao] = useState('0');

  const posicoes = Array.from({ length: escala.ciclo_semanas }, (_, i) => i);
  const disponiveis = funcionarios.filter(
    (f) => f.status !== 'desligado' && !vinculos.some((v) => v.funcionario_id === f.id),
  );

  const vincular = async () => {
    if (!funcionarioId) return toast.error('Escolha quem entra na escala.');
    await salvar({
      id: novoId('ef'),
      funcionario_id: funcionarioId,
      escala_id: escala.id,
      ancora_em: ancoraDaPosicao(escala.inicio_em, Number(posicao)),
      data_inicio: escala.inicio_em,
      // Escala é contínua: a vigência longa evita ter de renová-la todo ano.
      data_fim: somarDias(escala.inicio_em, 365 * 10),
    });
    setFuncionarioId('');
  };

  const mudarPosicao = async (vinculo: EscalaFuncionario, novaPosicao: number) => {
    await salvar({ ...vinculo, ancora_em: ancoraDaPosicao(escala.inicio_em, novaPosicao) });
  };

  return (
    <div className="space-y-3">
      {escala.ciclo_semanas > 1 && (
        <Aviso tom="info">
          São {escala.ciclo_semanas} posições. Quem está na posição 1 roda a semana 1 da grade
          enquanto a posição 2 roda a semana 2 — e na semana seguinte trocam. Duas pessoas em
          posições diferentes de um ciclo de 2 semanas se revezam dia sim, dia não.
        </Aviso>
      )}

      {vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguém nesta escala ainda.</p>
      ) : (
        <div className="space-y-1.5">
          {vinculos.map((v) => {
            const pessoa = funcionarios.find((f) => f.id === v.funcionario_id);
            const pos = posicaoDaAncora(escala.inicio_em, v.ancora_em, escala.ciclo_semanas);
            return (
              <div key={v.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{pessoa?.nome ?? '—'}</p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    até {formatarData(v.data_fim)}
                  </p>
                </div>
                {escala.ciclo_semanas > 1 && (
                  <Select value={String(pos)} onValueChange={(p) => mudarPosicao(v, Number(p))}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {posicoes.map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          Posição {p + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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

      <div className="flex gap-2">
        <Select value={funcionarioId} onValueChange={setFuncionarioId}>
          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Adicionar pessoa" /></SelectTrigger>
          <SelectContent>
            {disponiveis.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {escala.ciclo_semanas > 1 && (
          <Select value={posicao} onValueChange={setPosicao}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {posicoes.map((p) => (
                <SelectItem key={p} value={String(p)}>Posição {p + 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="button" size="sm" className="h-8 shrink-0" onClick={vincular}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function EditorEscala({
  escala,
  ehNova,
  aoFechar,
  legenda,
  detalhes,
  vinculos,
  funcionarios,
  salvarEscala,
  salvarGrade,
  salvarVinculo,
  removerVinculo,
}: {
  escala: Escala | null;
  ehNova: boolean;
  aoFechar: () => void;
  legenda: TurnoLegenda[];
  detalhes: EscalaDetalhe[];
  vinculos: EscalaFuncionario[];
  funcionarios: Funcionario[];
  salvarEscala: (e: Escala) => Promise<void>;
  salvarGrade: (escalaId: string, turnos: Omit<EscalaDetalhe, 'id' | 'escala_id'>[]) => Promise<void>;
  salvarVinculo: (v: EscalaFuncionario) => Promise<void>;
  removerVinculo: (id: string) => Promise<void>;
}) {
  const [rascunho, setRascunho] = useState<Escala | null>(escala);

  // Remonta ao trocar de escala: o rascunho é estado local.
  if (escala && rascunho?.id !== escala.id) setRascunho(escala);
  if (!escala || !rascunho) return null;

  const salvar = async () => {
    if (!rascunho.nome.trim()) return toast.error('Informe o nome da escala.');
    await salvarEscala({ ...rascunho, nome: rascunho.nome.trim() });
    toast.success(ehNova ? 'Escala criada. Agora monte a grade e as posições.' : 'Escala atualizada.');
    if (ehNova) aoFechar();
  };

  return (
    <Sheet open onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{ehNova ? 'Nova escala' : rascunho.nome || 'Escala'}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              value={rascunho.nome}
              placeholder="Ex.: NOC Noturno"
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={rascunho.tipo}
                onValueChange={(v) => setRascunho({ ...rascunho, tipo: v as TipoEscala })}
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
                value={rascunho.papel}
                onValueChange={(v) => setRascunho({ ...rascunho, papel: v as PapelEscala })}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Posições no rodízio</Label>
              <Input
                type="number"
                min={1}
                max={9}
                value={rascunho.ciclo_semanas}
                onChange={(e) =>
                  setRascunho({
                    ...rascunho,
                    ciclo_semanas: Math.max(1, Math.min(9, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rodízio começa em</Label>
              <Input
                type="date"
                value={rascunho.inicio_em}
                onChange={(e) => setRascunho({ ...rascunho, inicio_em: e.target.value })}
              />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Uma posição por semana do ciclo. Para um par 12×36 são 2 posições; para um plantão que
            gira entre três pessoas, 3. Só a semana da data conta, não o dia.
          </p>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={rascunho.descricao}
              placeholder="Ex.: Turno noturno 19h–07h em dias alternados"
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Escala ativa</Label>
            <Switch
              checked={rascunho.ativo}
              onCheckedChange={(v) => setRascunho({ ...rascunho, ativo: v })}
            />
          </div>

          <Button className="w-full" onClick={salvar}>
            {ehNova ? 'Criar escala' : 'Salvar alterações'}
          </Button>

          {!ehNova && (
            <>
              <div className="space-y-1.5 border-t pt-4">
                <Label>O que acontece em cada dia do ciclo</Label>
                <GradeCiclo
                  // A grade tem estado local, então precisa remontar quando o
                  // que está gravado muda — inclusive quando a escala acabou
                  // de ser criada e os turnos chegam do servidor depois.
                  key={`${rascunho.id}-${rascunho.ciclo_semanas}-${detalhes.length}`}
                  escala={rascunho}
                  detalhes={detalhes}
                  legenda={legenda}
                  salvarGrade={(turnos) => salvarGrade(rascunho.id, turnos)}
                />
              </div>

              <div className="space-y-1.5 border-t pt-4">
                <Label>Quem ocupa cada posição</Label>
                <PosicoesEscala
                  escala={rascunho}
                  vinculos={vinculos}
                  funcionarios={funcionarios}
                  salvar={salvarVinculo}
                  remover={removerVinculo}
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
