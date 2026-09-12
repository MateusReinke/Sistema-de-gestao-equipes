/**
 * A escala de uma posição da equipe — a grade que a planilha tem na aba
 * "Cadastro": uma linha por semana do ciclo, uma coluna por dia da semana.
 *
 * A posição é a vaga ("NOC Diurno 1"), e quem a ocupa é escolhido aqui também.
 * A escala fica na vaga, não na pessoa: trocar o ocupante — ou deixar a vaga
 * aberta — não mexe no ciclo, e é o que faz a brecha aparecer no calendário em
 * vez de a linha sumir.
 *
 * A regra que faz tudo funcionar é a mesma da planilha: **o ciclo tem o tamanho
 * das semanas preenchidas e volta sozinho para o começo**. Preencheu só a
 * Semana 1, toda semana é igual. Preencheu até a 3, a quarta semana do
 * calendário já é a Semana 1 de novo. Por isso não existe campo "tamanho do
 * ciclo": acrescentar ou tirar uma linha aqui é o que muda o ciclo.
 *
 * O botão de girar é o que transforma uma posição num rodízio inteiro: as três
 * vagas do plantão de infra têm a mesma grade de 3 semanas, cada uma girada de
 * uma semana — é assim na planilha, e é o que faz o backup cair sozinho no
 * lugar certo.
 */
import { useEffect, useMemo, useState } from 'react';
import { CopyPlus, Minus, Plus, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/comum';
import { MAXIMO_SEMANAS, girarCiclo, semanaDoCiclo, turnoDoDia } from '@/lib/cicloEscala';
import { classeDoTurno, codigoCurto, descricaoDoTurno, type TurnoLegenda } from '@/lib/turnos';
import { DIAS_SEMANA, formatarDataCurta, hoje, somarDias } from '@/lib/date';
import type { EscalaCelula, EscalaPosicao, Funcionario } from '@/types/sgo';

/** Valor do seletor para "ninguém ocupa esta vaga". */
const VAGA = 'vaga';

/** Uma célula por gravar: sem id, porque o ciclo inteiro é trocado de uma vez. */
type CelulaNova = Omit<EscalaCelula, 'id' | 'posicao_id'>;

interface Props {
  posicao: EscalaPosicao | null;
  celulas: EscalaCelula[];
  legenda: TurnoLegenda[];
  /** Quem pode ocupar a vaga — os ativos da equipe. */
  candidatos: Funcionario[];
  /** As outras posições da equipe, para girar a grade e montar o rodízio. */
  outrasPosicoes: EscalaPosicao[];
  aoFechar: () => void;
  /**
   * Garante que a equipe tenha legenda própria antes de gravar. Uma célula
   * aponta para uma linha real de `tipos_turno`; enquanto a equipe usa a
   * legenda embutida, os ids são só do código.
   */
  garantirLegenda: () => Promise<TurnoLegenda[]>;
  salvarCiclo: (posicaoId: string, inicioEm: string, celulas: CelulaNova[]) => Promise<void>;
  /** Grava o nome e o ocupante da posição. */
  salvarPosicao: (posicao: EscalaPosicao) => Promise<void>;
  /** Abre a confirmação de esvaziar a grade, na tela da equipe. */
  aoExcluir: (posicao: EscalaPosicao) => void;
}

/** `''` na grade quer dizer "este dia não faz parte do ciclo". */
type Grade = string[][];

function gradeDeCelulas(celulas: EscalaCelula[]): Grade {
  const semanas = celulas.reduce((maior, c) => Math.max(maior, c.semana), 0);
  const grade: Grade = Array.from({ length: Math.max(semanas, 1) }, () => Array(7).fill(''));
  for (const c of celulas) {
    if (c.semana >= 1 && c.semana <= grade.length && c.dia_semana >= 0 && c.dia_semana <= 6) {
      grade[c.semana - 1][c.dia_semana] = c.tipo_turno_id;
    }
  }
  return grade;
}

function celulasDaGrade(grade: Grade): CelulaNova[] {
  return grade.flatMap((semana, i) =>
    semana
      .map((tipoTurnoId, dia) =>
        tipoTurnoId ? { semana: i + 1, dia_semana: dia, tipo_turno_id: tipoTurnoId } : null,
      )
      .filter((c): c is CelulaNova => c !== null),
  );
}

export function EditorCiclo({
  posicao,
  celulas,
  legenda,
  candidatos,
  outrasPosicoes,
  aoFechar,
  garantirLegenda,
  salvarCiclo,
  salvarPosicao,
  aoExcluir,
}: Props) {
  const [nome, setNome] = useState('');
  const [ocupante, setOcupante] = useState(VAGA);
  const [inicioEm, setInicioEm] = useState('');
  const [grade, setGrade] = useState<Grade>([]);
  const [pincel, setPincel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [girarPara, setGirarPara] = useState('');

  // Cada posição aberta traz a própria grade; remontar o estado ao trocar de
  // posição é o que evita editar uma e gravar na outra.
  const chave = `${posicao?.id ?? ''}|${celulas.length}`;
  useEffect(() => {
    if (!posicao) return;
    setNome(posicao.nome);
    setOcupante(posicao.funcionario_id ?? VAGA);
    setInicioEm(posicao.inicio_em || domingoDestaSemana());
    setGrade(celulas.length > 0 ? gradeDeCelulas(celulas) : [Array(7).fill('')]);
    setPincel((atual) => atual || (legenda[0]?.id ?? ''));
    // `chave` já resume a identidade do que precisa remontar a grade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const turnoPorId = useMemo(() => new Map(legenda.map((t) => [t.id, t])), [legenda]);

  /** As duas semanas seguintes, como o calendário vai mostrá-las. */
  const previa = useMemo(() => {
    const celulasAtuais = celulasDaGrade(grade);
    if (!inicioEm || celulasAtuais.length === 0) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const data = somarDias(hoje(), i);
      const id = turnoDoDia({ inicio_em: inicioEm, celulas: celulasAtuais }, data);
      return { data, turno: id ? turnoPorId.get(id) : undefined };
    });
  }, [grade, inicioEm, turnoPorId]);

  if (!posicao) return null;

  const semanaAtual = inicioEm ? semanaDoCiclo(inicioEm, hoje(), grade.length) : 0;

  /**
   * Clicar aplica o turno escolhido; o botão direito tira o dia do ciclo.
   *
   * São ações separadas de propósito. Esvaziar a célula não é "folga": é dizer
   * que aquele dia da semana tem um ciclo mais curto, o que muda o resto do
   * calendário. Se clicar de novo esvaziasse, dar dois cliques por engano
   * mudaria o ciclo sem ninguém perceber.
   */
  const pintar = (semana: number, dia: number, turnoId: string) => {
    setGrade((atual) =>
      atual.map((linha, i) =>
        i === semana ? linha.map((valor, d) => (d === dia ? turnoId : valor)) : linha,
      ),
    );
  };

  /** Repete o padrão da última semana — atalho para ciclos longos e parecidos. */
  const acrescentarSemana = () => {
    if (grade.length >= MAXIMO_SEMANAS) {
      return toast.error(`O ciclo vai até ${MAXIMO_SEMANAS} semanas.`);
    }
    setGrade((atual) => [...atual, [...(atual[atual.length - 1] ?? Array(7).fill(''))]]);
  };

  const tirarSemana = () => {
    if (grade.length <= 1) return;
    setGrade((atual) => atual.slice(0, -1));
  };

  const gravar = async (): Promise<TurnoLegenda[] | null> => {
    const celulasAtuais = celulasDaGrade(grade);
    if (celulasAtuais.length === 0) {
      toast.error('Preencha ao menos um dia — a grade vazia não projeta nada.');
      return null;
    }

    // Materializa a legenda da equipe, se ainda for a embutida, e remapeia a
    // grade pelos rótulos: o desenho é o mesmo, os ids é que passam a existir.
    const propria = await garantirLegenda();
    const idPorRotulo = new Map(propria.map((t) => [t.rotulo, t.id]));
    const remapeadas = celulasAtuais.map((c) => ({
      ...c,
      tipo_turno_id: idPorRotulo.get(turnoPorId.get(c.tipo_turno_id)?.rotulo ?? '') ?? c.tipo_turno_id,
    }));

    await salvarPosicao({
      ...posicao,
      nome: nome.trim() || posicao.nome,
      funcionario_id: ocupante === VAGA ? null : ocupante,
    });
    await salvarCiclo(posicao.id, inicioEm, remapeadas);
    return propria;
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      if (await gravar()) toast.success(`Escala de ${nome.trim() || posicao.nome} gravada.`);
    } catch {
      // Erro já virou toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  /**
   * Copia esta grade para outra posição, girada em uma semana — o passo que
   * monta o rodízio. Quem recebe faz, na semana que vem, o que esta faz agora.
   */
  const girarParaColega = async () => {
    const destino = outrasPosicoes.find((p) => p.id === girarPara);
    if (!destino) return toast.error('Escolha para qual posição o rodízio continua.');

    setSalvando(true);
    try {
      const propria = await gravar();
      if (!propria) return;

      const idPorRotulo = new Map(propria.map((t) => [t.rotulo, t.id]));
      const girada = girarCiclo(
        celulasDaGrade(grade).map((c) => ({
          ...c,
          tipo_turno_id:
            idPorRotulo.get(turnoPorId.get(c.tipo_turno_id)?.rotulo ?? '') ?? c.tipo_turno_id,
        })),
        1,
      );
      await salvarCiclo(destino.id, inicioEm, girada);
      toast.success(`${destino.nome} entrou no rodízio, uma semana depois de ${posicao.nome}.`);
      setGirarPara('');
    } catch {
      // Erro já virou toast em useDados().
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && aoFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="truncate">{posicao.nome}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="nome-posicao">Nome da posição</Label>
            <Input
              id="nome-posicao"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: NOC Noturno 1"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quem ocupa</Label>
            <Select value={ocupante} onValueChange={setOcupante}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VAGA}>Vaga aberta</SelectItem>
                {candidatos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A escala é da posição, não da pessoa. Deixar a vaga aberta — ou desligar quem a ocupa
              — mantém o ciclo rodando e faz os dias virarem alerta de brecha no calendário.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inicio-ciclo">O rodízio começa em</Label>
            <Input
              id="inicio-ciclo"
              type="date"
              value={inicioEm}
              onChange={(e) => setInicioEm(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Só a semana desta data conta, não o dia. A <strong>Semana 1</strong> da grade é a
              semana seguinte a ela.
              {grade.length > 0 && semanaAtual > 0 && (
                <> Hoje, esta posição está na <strong>Semana {semanaAtual}</strong>.</>
              )}
            </p>
          </div>

          {/* ----------------------------------------------------- pincel */}
          <div className="space-y-1.5">
            <Label>Turno a aplicar</Label>
            <div className="flex flex-wrap gap-1.5">
              {legenda.map((turno) => (
                <button
                  key={turno.id}
                  type="button"
                  onClick={() => setPincel(turno.id)}
                  title={descricaoDoTurno(turno)}
                  className={`rounded border px-2 py-1 text-[11px] font-medium transition-all ${classeDoTurno(turno)} ${
                    pincel === turno.id
                      ? 'ring-2 ring-ring ring-offset-1 ring-offset-background'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {turno.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------ grade */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Ciclo de {grade.length} semana{grade.length > 1 ? 's' : ''}
              </Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  title="Tirar a última semana do ciclo"
                  onClick={tirarSemana}
                  disabled={grade.length <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  title="Acrescentar uma semana ao ciclo"
                  onClick={acrescentarSemana}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-1.5 text-left font-medium text-muted-foreground">Semana</th>
                    {DIAS_SEMANA.map((d) => (
                      <th key={d} className="p-1.5 text-center font-medium text-muted-foreground">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grade.map((semana, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="tabular p-1.5 text-muted-foreground">{i + 1}</td>
                      {semana.map((tipoTurnoId, dia) => {
                        const turno = tipoTurnoId ? turnoPorId.get(tipoTurnoId) : undefined;
                        return (
                          <td key={dia} className="p-0.5">
                            <button
                              type="button"
                              onClick={() => pintar(i, dia, pincel)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                pintar(i, dia, '');
                              }}
                              title={
                                turno
                                  ? `${turno.rotulo} — clique aplica o turno escolhido, botão direito tira do ciclo`
                                  : 'Fora do ciclo — clique para aplicar o turno escolhido'
                              }
                              className={`w-full rounded border px-1 py-1.5 text-[10px] font-semibold transition-all hover:brightness-110 ${
                                turno
                                  ? classeDoTurno(turno)
                                  : 'border-dashed bg-transparent text-muted-foreground/40'
                              }`}
                            >
                              {turno ? codigoCurto(turno) : '·'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              O ciclo repete daqui em diante: depois da Semana {grade.length}, volta para a Semana 1.
              Botão direito numa célula tira aquele dia do ciclo.
            </p>
          </div>

          {/* ------------------------------------------------------ prévia */}
          {previa.length > 0 && (
            <div className="space-y-1.5">
              <Label>Como fica a partir de hoje</Label>
              <div className="flex flex-wrap gap-1">
                {previa.map(({ data, turno }) => (
                  <div key={data} className="w-[46px] text-center">
                    <div className="text-[9px] text-muted-foreground">{formatarDataCurta(data)}</div>
                    <div
                      className={`mt-0.5 rounded border px-0.5 py-1 text-[9px] font-semibold ${
                        turno ? classeDoTurno(turno) : 'border-dashed text-muted-foreground/40'
                      }`}
                    >
                      {turno ? codigoCurto(turno) : '·'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ rodízio */}
          {outrasPosicoes.length > 0 && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <Label className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5" /> Continuar o rodízio em outra posição
              </Label>
              <p className="text-xs text-muted-foreground">
                Copia esta grade girada em uma semana: o que esta posição faz nesta semana, a
                outra faz na próxima. É assim que o par 12×36 e o plantão com backup se fecham
                sozinhos.
              </p>
              <div className="flex gap-2">
                <Select value={girarPara} onValueChange={setGirarPara}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Qual posição entra depois" />
                  </SelectTrigger>
                  <SelectContent>
                    {outrasPosicoes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={girarParaColega} disabled={salvando}>
                  <CopyPlus className="mr-2 h-3.5 w-3.5" /> Aplicar
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={aoFechar}>
              Fechar
            </Button>
            <Button className="flex-1" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar escala'}
            </Button>
          </div>

          {celulas.length > 0 && (
            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => {
                aoFechar();
                aoExcluir(posicao);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Esvaziar a grade
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Domingo da semana corrente — o padrão de "o rodízio começa em". */
function domingoDestaSemana(): string {
  const h = hoje();
  return somarDias(h, -new Date(`${h}T12:00:00`).getDay());
}
