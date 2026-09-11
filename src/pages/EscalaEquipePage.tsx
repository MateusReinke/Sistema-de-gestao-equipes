/**
 * Calendário mensal de uma equipe — pessoas nas linhas, dias do mês nas
 * colunas, cada célula pintada com o que a pessoa faz naquele dia.
 *
 * É a tela que a planilha de escala fazia às custas de uma aba por equipe e
 * uma fórmula por célula. A diferença é que aqui nada precisa ser gerado
 * antes: a grade é a projeção do rodízio já cadastrado, calculada na hora
 * (`@/lib/projecaoEscala`), então a escala do mês que vem pode ser conferida
 * antes de virar plantão no banco.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  UsersRound,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { useDados } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { DIAS_SEMANA, diaDaSemana, formatarMesAno, hoje, paraIso } from '@/lib/date';
import { baixarCsv } from '@/lib/export';
import { ESTADO_DIA, ESTADOS_DIA } from '@/lib/estadosDia';
import { coberturaPorDia, diasDoIntervalo, projetarEscalaEquipe } from '@/lib/projecaoEscala';
import { TIPO_ESCALA } from '@/lib/labels';

export default function EscalaEquipePage() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const {
    equipes,
    funcionarios,
    escalas,
    escalaDetalhes,
    escalaFuncionarios,
    ferias,
    ausencias,
    gerarPlantoesEquipe,
  } = useDados();
  const { podeGerenciar } = useAuth();

  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [gerando, setGerando] = useState(false);

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hojeIso = hoje();

  const primeiroDia = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  const ultimoDia = paraIso(new Date(ano, mes + 1, 0));
  const dias = useMemo(() => diasDoIntervalo(primeiroDia, ultimoDia), [primeiroDia, ultimoDia]);

  const equipe = equipes.find((e) => e.id === id);

  const linhas = useMemo(
    () =>
      equipe
        ? projetarEscalaEquipe(
            { funcionarios, escalas, escalaDetalhes, escalaFuncionarios, ferias, ausencias },
            equipe.id,
            primeiroDia,
            ultimoDia,
          )
        : [],
    [equipe, funcionarios, escalas, escalaDetalhes, escalaFuncionarios, ferias, ausencias, primeiroDia, ultimoDia],
  );

  const cobertura = useMemo(() => coberturaPorDia(linhas, dias), [linhas, dias]);
  const diasDescobertos = dias.filter((d) => (cobertura.get(d) ?? 0) < (equipe?.cobertura_minima ?? 0));
  const conflitos = linhas.reduce(
    (soma, l) => soma + [...l.dias.values()].filter((d) => d.indisponivel).length,
    0,
  );
  const semEscala = linhas.filter((l) => l.dias.size === 0);

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
            if (!dia) return ESTADO_DIA.folga.rotulo;
            return dia.indisponivel
              ? `${ESTADO_DIA[dia.estado].rotulo} (${dia.indisponivel})`
              : ESTADO_DIA[dia.estado].rotulo;
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
        titulo={`Escala · ${equipe.nome}`}
        descricao="Projeção do rodízio cadastrado. Nada aqui precisa ser gerado antes para ser conferido."
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
        <Indicador rotulo="Sem escala" valor={semEscala.length} icone={UsersRound} tom={semEscala.length > 0 ? 'warning' : 'success'} />
      </div>

      {semEscala.length > 0 && (
        <Aviso>
          Sem nenhuma escala vinculada: {semEscala.map((l) => l.funcionario.nome).join(', ')}. Vincule
          em Escalas para essas pessoas aparecerem no calendário.
        </Aviso>
      )}

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
        </CardHeader>

        <CardContent>
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
                        <div className="flex items-center gap-2">
                          <Avatar nome={linha.funcionario.nome} tamanho="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-medium leading-tight">
                              {linha.funcionario.nome}
                            </p>
                            <p className="truncate text-[10px] leading-tight text-muted-foreground">
                              {linha.funcionario.cargo}
                              {linha.escalas.length > 0 &&
                                ` · ${[...new Set(linha.escalas.map((e) => TIPO_ESCALA[e.tipo]))].join(', ')}`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {dias.map((data) => {
                        const dia = linha.dias.get(data);
                        const estado = dia?.estado ?? 'folga';
                        const def = ESTADO_DIA[estado];
                        const diaSemana = diaDaSemana(data);
                        const fimDeSemana = diaSemana === 0 || diaSemana === 6;

                        return (
                          <td
                            key={data}
                            className={`border-b p-0.5 text-center ${fimDeSemana ? 'bg-muted/30' : ''}`}
                          >
                            <div
                              title={
                                dia
                                  ? `${def.rotulo} · ${dia.horario}${
                                      dia.indisponivel
                                        ? dia.indisponivel === 'ferias'
                                          ? ' — de férias!'
                                          : ' — afastado!'
                                        : ''
                                    }`
                                  : def.rotulo
                              }
                              className={`rounded border px-0.5 py-1 text-[9px] font-semibold ${def.classe} ${
                                dia?.indisponivel ? 'opacity-45 line-through' : ''
                              }`}
                            >
                              {def.codigoCurto}
                            </div>
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
                              furo
                                ? 'bg-destructive/20 text-destructive'
                                : 'bg-muted text-muted-foreground'
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ESTADOS_DIA.map((estado) => {
              const def = ESTADO_DIA[estado];
              return (
                <span key={estado} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`rounded border px-1 py-0.5 text-[9px] font-semibold ${def.classe}`}>
                    {def.codigo}
                  </span>
                  {def.rotulo}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded border bg-muted px-1 py-0.5 text-[9px] font-semibold line-through opacity-45">
                T.1
              </span>
              Escalado, mas de férias ou afastado
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Escalas desta equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const daEquipe = escalas.filter((e) => e.equipe_id === equipe.id);
            if (daEquipe.length === 0) {
              return (
                <p className="text-sm text-muted-foreground">
                  Nenhuma escala cadastrada para esta equipe ainda.
                </p>
              );
            }
            return (
              <div className="flex flex-wrap gap-2">
                {daEquipe.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => navegar('/escalas')}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.nome}</p>
                      <p className="tabular truncate text-[11px] text-muted-foreground">
                        {e.turno_inicio}–{e.turno_fim} · ciclo de {e.ciclo_semanas} semana(s)
                      </p>
                    </div>
                    <BadgeStatus
                      texto={TIPO_ESCALA[e.tipo]}
                      classe="bg-primary/10 text-primary border-primary/25"
                      className="text-[10px]"
                    />
                  </button>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
