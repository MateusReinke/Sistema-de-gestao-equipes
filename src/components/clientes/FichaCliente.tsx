import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Headphones,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, Aviso, BadgeStatus, Campo, CampoForm, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import {
  classificarNps,
  formatarMinutos,
  lacunasDoCliente,
  saudeCliente,
  situacaoContrato,
  trilhaEscalonamento,
} from '@/lib/clientes';
import { formatarData, hoje, humanizarPrazo } from '@/lib/date';
import {
  CATEGORIA_SERVICO,
  CLASSE_NPS,
  CLASSE_STATUS_CONTRATO,
  CLASSE_TIPO_CONTATO,
  REGIME_ATENDIMENTO,
  ROTULO_NPS,
  STATUS_CONTRATO,
  TIPO_CONTATO,
  formatarMoeda,
} from '@/lib/labels';
import type {
  AtendimentoEquipe,
  AvaliacaoCliente,
  Cliente,
  ContatoCliente,
  NivelEscalonamento,
  RegimeAtendimento,
  ServicoContratado,
  TipoContato,
} from '@/types/sgo';

/**
 * Ficha completa da conta: contrato, contatos, trilha de escalonamento,
 * equipes e serviços, e histórico de satisfação.
 *
 * Cada aba edita seus próprios registros por diálogo — a ficha já está dentro
 * de um painel lateral, e abrir outro painel por cima confundiria a navegação.
 */
export function FichaCliente({ cliente, onEditar }: { cliente: Cliente; onEditar: () => void }) {
  const dados = useDados();
  const { podeGerenciar } = useAuth();

  const {
    funcionarios,
    equipes,
    contatosCliente,
    niveisEscalonamento,
    servicos,
    servicosContratados,
    atendimentoEquipes,
    avaliacoesCliente,
  } = dados;

  const nomeDe = (id?: string) => funcionarios.find((f) => f.id === id)?.nome ?? '—';

  const contatos = contatosCliente.filter((c) => c.cliente_id === cliente.id);
  const trilha = trilhaEscalonamento(niveisEscalonamento, cliente.id);
  const contratados = servicosContratados.filter((s) => s.cliente_id === cliente.id);
  const vinculos = atendimentoEquipes.filter((a) => a.cliente_id === cliente.id);
  const avaliacoes = avaliacoesCliente
    .filter((a) => a.cliente_id === cliente.id)
    .sort((a, b) => b.data.localeCompare(a.data));

  const situacao = situacaoContrato(cliente);
  const saude = saudeCliente(avaliacoesCliente, cliente.id);
  const lacunas = lacunasDoCliente({
    cliente,
    contatos: contatosCliente,
    niveis: niveisEscalonamento,
    equipesVinculadas: vinculos.length,
    servicosContratados: contratados.length,
  });

  return (
    <>
      <SheetHeader>
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate text-left">{cliente.nome}</SheetTitle>
            <p className="truncate text-sm text-muted-foreground">
              {cliente.segmento} · {cliente.contrato_numero}
            </p>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BadgeStatus
          texto={STATUS_CONTRATO[cliente.status_contrato]}
          classe={CLASSE_STATUS_CONTRATO[cliente.status_contrato]}
        />
        <BadgeStatus
          texto={REGIME_ATENDIMENTO[cliente.regime]}
          classe="bg-muted text-muted-foreground border-border"
        />
        {saude.classe && (
          <BadgeStatus
            texto={`NPS ${saude.ultimaNota} · ${ROTULO_NPS[saude.classe]}`}
            classe={CLASSE_NPS[saude.classe]}
          />
        )}
        {podeGerenciar && (
          <Button variant="outline" size="sm" className="ml-auto h-7" onClick={onEditar}>
            <Pencil className="mr-1.5 h-3 w-3" /> Editar
          </Button>
        )}
      </div>

      {lacunas.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {lacunas.map((l) => (
            <Aviso key={l}>{l}</Aviso>
          ))}
        </div>
      )}

      <Tabs defaultValue="contrato" className="mt-5">
        <TabsList className="w-full">
          <TabsTrigger value="contrato" className="flex-1 text-xs">Contrato</TabsTrigger>
          <TabsTrigger value="contatos" className="flex-1 text-xs">Contatos</TabsTrigger>
          <TabsTrigger value="escalonamento" className="flex-1 text-xs">Escalonamento</TabsTrigger>
          <TabsTrigger value="operacao" className="flex-1 text-xs">Operação</TabsTrigger>
          <TabsTrigger value="satisfacao" className="flex-1 text-xs">Satisfação</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- contrato */}
        <TabsContent value="contrato" className="mt-4 space-y-4">
          {situacao.vencido ? (
            <Aviso tom="destructive">
              Vigência encerrada em {formatarData(cliente.contrato_fim)} — há{' '}
              {Math.abs(situacao.diasParaVencer)} dias. Formalize a renovação ou o encerramento.
            </Aviso>
          ) : situacao.aRenovar ? (
            <Aviso>
              Renova {humanizarPrazo(cliente.contrato_fim)}.{' '}
              {situacao.avisoVencido
                ? cliente.renovacao_automatica
                  ? 'O prazo de aviso prévio passou: o contrato renova automaticamente.'
                  : 'O prazo de aviso prévio passou sem comunicação formal.'
                : `Aviso prévio de não-renovação até ${formatarData(situacao.limiteAviso)}.`}
            </Aviso>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Razão social">{cliente.razao_social}</Campo>
            <Campo rotulo="CNPJ">{cliente.cnpj}</Campo>
            <Campo rotulo="Contrato">{cliente.contrato_numero}</Campo>
            <Campo rotulo="Segmento">{cliente.segmento}</Campo>
            <Campo rotulo="Início da vigência">{formatarData(cliente.contrato_inicio)}</Campo>
            <Campo rotulo="Renovação">{formatarData(cliente.contrato_fim)}</Campo>
            <Campo rotulo="Renovação automática">
              {cliente.renovacao_automatica ? 'Sim' : 'Não'}
            </Campo>
            <Campo rotulo="Aviso prévio">{cliente.aviso_previa_dias} dias</Campo>
            <Campo rotulo="Valor mensal">{formatarMoeda(cliente.valor_mensal)}</Campo>
            <Campo rotulo="Valor anual">{formatarMoeda(cliente.valor_mensal * 12)}</Campo>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Responsáveis Lumini
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar nome={nomeDe(cliente.gerente_conta_id)} tamanho="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm">{nomeDe(cliente.gerente_conta_id)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Gerente de conta — responsável pela satisfação
                  </p>
                </div>
              </div>
              {cliente.responsavel_tecnico_id && (
                <div className="flex items-center gap-2">
                  <Avatar nome={nomeDe(cliente.responsavel_tecnico_id)} tamanho="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{nomeDe(cliente.responsavel_tecnico_id)}</p>
                    <p className="text-[11px] text-muted-foreground">Responsável técnico</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { rotulo: 'Regime', valor: REGIME_ATENDIMENTO[cliente.regime] },
              { rotulo: 'SLA resposta', valor: `${cliente.sla_resposta_min}min` },
              { rotulo: 'SLA resolução', valor: `${cliente.sla_resolucao_horas}h` },
            ].map((c) => (
              <div key={c.rotulo} className="rounded-lg border py-2">
                <p className="text-sm font-bold leading-none">{c.valor}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{c.rotulo}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- contatos */}
        <TabsContent value="contatos" className="mt-4">
          <AbaContatos cliente={cliente} contatos={contatos} />
        </TabsContent>

        {/* -------------------------------------------------- escalonamento */}
        <TabsContent value="escalonamento" className="mt-4">
          <AbaEscalonamento cliente={cliente} trilha={trilha} contatos={contatos} />
        </TabsContent>

        {/* ------------------------------------------------------- operação */}
        <TabsContent value="operacao" className="mt-4 space-y-5">
          <AbaOperacao cliente={cliente} vinculos={vinculos} contratados={contratados} />
        </TabsContent>

        {/* ----------------------------------------------------- satisfação */}
        <TabsContent value="satisfacao" className="mt-4">
          <AbaSatisfacao cliente={cliente} avaliacoes={avaliacoes} />
        </TabsContent>
      </Tabs>
    </>
  );

  /* ================================================================ abas */

  function AbaContatos({ cliente, contatos }: { cliente: Cliente; contatos: ContatoCliente[] }) {
    const { salvarContatoCliente, removerContatoCliente } = dados;
    const [emEdicao, setEmEdicao] = useState<ContatoCliente | null>(null);

    const abrirNovo = () =>
      setEmEdicao({
        id: novoId('ct'),
        cliente_id: cliente.id,
        nome: '',
        cargo: '',
        email: '',
        telefone: '',
        tipo: 'principal',
        // O primeiro contato da conta vira o principal por padrão.
        principal: contatos.length === 0,
      });

    const salvar = () => {
      if (!emEdicao) return;
      if (!emEdicao.nome.trim()) return toast.error('Informe o nome do contato.');
      if (!emEdicao.email.trim()) return toast.error('Informe o e-mail do contato.');

      // Só um contato principal por conta: marcar um desmarca o anterior.
      if (emEdicao.principal) {
        contatos
          .filter((c) => c.principal && c.id !== emEdicao.id)
          .forEach((c) => salvarContatoCliente({ ...c, principal: false }));
      }

      salvarContatoCliente({ ...emEdicao, nome: emEdicao.nome.trim() });
      toast.success('Contato salvo.');
      setEmEdicao(null);
    };

    return (
      <div className="space-y-3">
        {podeGerenciar && (
          <Button variant="outline" className="w-full" onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo contato
          </Button>
        )}

        {contatos.length === 0 ? (
          <EstadoVazio
            icone={Headphones}
            titulo="Nenhum contato cadastrado"
            descricao="Sem contato principal, ninguém sabe a quem recorrer num incidente."
          />
        ) : (
          contatos.map((c) => (
            <div key={c.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar nome={c.nome} tamanho="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.cargo}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.principal && (
                    <BadgeStatus
                      texto="Principal"
                      classe="bg-primary/15 text-primary border-primary/30"
                      className="text-[9px]"
                    />
                  )}
                  <BadgeStatus
                    texto={TIPO_CONTATO[c.tipo]}
                    classe={CLASSE_TIPO_CONTATO[c.tipo]}
                    className="text-[9px]"
                  />
                </div>
              </div>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                <p className="truncate">{c.email}</p>
                <p className="tabular">{c.telefone}</p>
                {c.observacao && <p className="italic">{c.observacao}</p>}
              </div>

              {podeGerenciar && (
                <div className="flex gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEmEdicao({ ...c })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => {
                      removerContatoCliente(c.id);
                      toast.success('Contato removido.');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}

        <Dialog open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contato do cliente</DialogTitle>
            </DialogHeader>
            {emEdicao && (
              <div className="space-y-3">
                <CampoForm rotulo="Nome">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.nome}
                      onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Cargo">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.cargo}
                      onChange={(e) => setEmEdicao({ ...emEdicao, cargo: e.target.value })}
                    />
                  )}
                </CampoForm>
                <div className="grid grid-cols-2 gap-3">
                  <CampoForm rotulo="E-mail">
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        value={emEdicao.email}
                        onChange={(e) => setEmEdicao({ ...emEdicao, email: e.target.value })}
                      />
                    )}
                  </CampoForm>
                  <CampoForm rotulo="Telefone">
                    {(id) => (
                      <Input
                        id={id}
                        value={emEdicao.telefone}
                        onChange={(e) => setEmEdicao({ ...emEdicao, telefone: e.target.value })}
                      />
                    )}
                  </CampoForm>
                </div>
                <CampoForm rotulo="Tipo">
                  {(id) => (
                    <Select
                      value={emEdicao.tipo}
                      onValueChange={(v) => setEmEdicao({ ...emEdicao, tipo: v as TipoContato })}
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(TIPO_CONTATO) as TipoContato[]).map((t) => (
                          <SelectItem key={t} value={t}>{TIPO_CONTATO[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <CampoForm rotulo="Observação">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={emEdicao.observacao ?? ''}
                      placeholder="Ex.: aprova aditivos, acionar em incidentes de segurança..."
                      onChange={(e) =>
                        setEmEdicao({ ...emEdicao, observacao: e.target.value || undefined })
                      }
                    />
                  )}
                </CampoForm>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">Contato principal</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Padrão para abertura e retorno de chamados.
                    </p>
                  </div>
                  <Switch
                    checked={emEdicao.principal}
                    onCheckedChange={(v) => setEmEdicao({ ...emEdicao, principal: v })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEmEdicao(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function AbaEscalonamento({
    cliente,
    trilha,
    contatos,
  }: {
    cliente: Cliente;
    trilha: ReturnType<typeof trilhaEscalonamento>;
    contatos: ContatoCliente[];
  }) {
    const { salvarNivelEscalonamento, removerNivelEscalonamento } = dados;
    const [emEdicao, setEmEdicao] = useState<NivelEscalonamento | null>(null);

    const abrirNovo = () =>
      setEmEdicao({
        id: novoId('ne'),
        cliente_id: cliente.id,
        nivel: trilha.length + 1,
        titulo: '',
        prazo_minutos: 60,
        canal: '',
        instrucoes: '',
      });

    const salvar = () => {
      if (!emEdicao) return;
      if (!emEdicao.titulo.trim()) return toast.error('Informe o título do nível.');
      if (emEdicao.prazo_minutos <= 0) return toast.error('O prazo deve ser maior que zero.');

      const duplicado = trilha.some(
        (d) => d.nivel.nivel === emEdicao.nivel && d.nivel.id !== emEdicao.id,
      );
      if (duplicado) return toast.error(`Já existe um nível ${emEdicao.nivel} nesta conta.`);

      salvarNivelEscalonamento({ ...emEdicao, titulo: emEdicao.titulo.trim() });
      toast.success('Nível salvo.');
      setEmEdicao(null);
    };

    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Caminho acordado com este cliente. O prazo de cada degrau é o tempo sem solução até o
          próximo ser acionado.
        </p>

        {podeGerenciar && (
          <Button variant="outline" className="w-full" onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo nível
          </Button>
        )}

        {trilha.length === 0 ? (
          <EstadoVazio
            icone={ArrowUp}
            titulo="Escalonamento não definido"
            descricao="Sem trilha, um incidente fora do horário fica sem dono."
          />
        ) : (
          <div className="space-y-2">
            {trilha.map(({ nivel, acionadoAposMinutos }) => (
              <div key={nivel.id} className="relative rounded-lg border p-3 pl-11">
                <span className="absolute left-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {nivel.nivel}
                </span>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nivel.titulo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {acionadoAposMinutos === 0
                        ? 'Acionado na abertura'
                        : `Acionado após ${formatarMinutos(acionadoAposMinutos)}`}{' '}
                      · prazo de {formatarMinutos(nivel.prazo_minutos)}
                    </p>
                  </div>
                  {podeGerenciar && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEmEdicao({ ...nivel })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          removerNivelEscalonamento(nivel.id);
                          toast.success('Nível removido.');
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {nivel.canal && <p>Canal: {nivel.canal}</p>}
                  <p>
                    Lumini: {nomeDe(nivel.responsavel_interno_id)} · Cliente:{' '}
                    {contatos.find((c) => c.id === nivel.contato_cliente_id)?.nome ?? '—'}
                  </p>
                  {nivel.instrucoes && <p className="italic">{nivel.instrucoes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nível de escalonamento</DialogTitle>
            </DialogHeader>
            {emEdicao && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <CampoForm rotulo="Nível">
                    {(id) => (
                      <Input
                        id={id}
                        type="number"
                        min={1}
                        value={emEdicao.nivel}
                        onChange={(e) =>
                          setEmEdicao({ ...emEdicao, nivel: Number(e.target.value) || 1 })
                        }
                      />
                    )}
                  </CampoForm>
                  <CampoForm rotulo="Prazo (minutos)">
                    {(id) => (
                      <Input
                        id={id}
                        type="number"
                        min={1}
                        value={emEdicao.prazo_minutos}
                        onChange={(e) =>
                          setEmEdicao({ ...emEdicao, prazo_minutos: Number(e.target.value) || 0 })
                        }
                      />
                    )}
                  </CampoForm>
                </div>
                <CampoForm rotulo="Título">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.titulo}
                      placeholder="Ex.: Coordenação de Operações"
                      onChange={(e) => setEmEdicao({ ...emEdicao, titulo: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Responsável Lumini">
                  {(id) => (
                    <Select
                      value={emEdicao.responsavel_interno_id ?? 'nenhum'}
                      onValueChange={(v) =>
                        setEmEdicao({
                          ...emEdicao,
                          responsavel_interno_id: v === 'nenhum' ? undefined : v,
                        })
                      }
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Não definido</SelectItem>
                        {funcionarios
                          .filter((f) => f.status !== 'desligado')
                          .map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <CampoForm rotulo="Contato do cliente">
                  {(id) => (
                    <Select
                      value={emEdicao.contato_cliente_id ?? 'nenhum'}
                      onValueChange={(v) =>
                        setEmEdicao({
                          ...emEdicao,
                          contato_cliente_id: v === 'nenhum' ? undefined : v,
                        })
                      }
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Não definido</SelectItem>
                        {contatos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} — {c.cargo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <CampoForm rotulo="Canal">
                  {(id) => (
                    <Input
                      id={id}
                      value={emEdicao.canal}
                      placeholder="Ex.: Ligação + WhatsApp"
                      onChange={(e) => setEmEdicao({ ...emEdicao, canal: e.target.value })}
                    />
                  )}
                </CampoForm>
                <CampoForm rotulo="Instruções">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={3}
                      value={emEdicao.instrucoes}
                      placeholder="O que este nível deve fazer ao ser acionado."
                      onChange={(e) => setEmEdicao({ ...emEdicao, instrucoes: e.target.value })}
                    />
                  )}
                </CampoForm>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEmEdicao(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function AbaOperacao({
    cliente,
    vinculos,
    contratados,
  }: {
    cliente: Cliente;
    vinculos: AtendimentoEquipe[];
    contratados: ServicoContratado[];
  }) {
    const {
      salvarAtendimentoEquipe,
      removerAtendimentoEquipe,
      salvarServicoContratado,
      removerServicoContratado,
    } = dados;
    const [equipeEmEdicao, setEquipeEmEdicao] = useState<AtendimentoEquipe | null>(null);
    const [servicoEmEdicao, setServicoEmEdicao] = useState<ServicoContratado | null>(null);

    const vinculadas = new Set(vinculos.map((v) => v.equipe_id));
    const disponiveis = equipes.filter((e) => e.ativo && !vinculadas.has(e.id));

    const contratadosIds = new Set(contratados.map((c) => c.servico_id));
    const servicosDisponiveis = servicos.filter((s) => s.ativo && !contratadosIds.has(s.id));

    const salvarEquipe = () => {
      if (!equipeEmEdicao) return;
      if (!equipeEmEdicao.equipe_id) return toast.error('Selecione a equipe.');
      salvarAtendimentoEquipe(equipeEmEdicao);
      toast.success('Equipe vinculada à conta.');
      setEquipeEmEdicao(null);
    };

    const salvarServico = () => {
      if (!servicoEmEdicao) return;
      if (!servicoEmEdicao.servico_id) return toast.error('Selecione o serviço.');
      if (servicoEmEdicao.quantidade <= 0) return toast.error('Informe a quantidade contratada.');
      salvarServicoContratado(servicoEmEdicao);
      toast.success('Serviço registrado no contrato.');
      setServicoEmEdicao(null);
    };

    return (
      <>
        {/* Equipes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Equipes que atuam na conta
            </p>
            {podeGerenciar && disponiveis.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setEquipeEmEdicao({
                    id: novoId('ae'),
                    cliente_id: cliente.id,
                    equipe_id: disponiveis[0].id,
                    escopo: '',
                    principal: vinculos.length === 0,
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Vincular
              </Button>
            )}
          </div>

          {vinculos.length === 0 ? (
            <EstadoVazio icone={UsersRound} titulo="Nenhuma equipe designada" />
          ) : (
            vinculos.map((v) => {
              const equipe = equipes.find((e) => e.id === v.equipe_id);
              return (
                <div key={v.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{equipe?.nome ?? '—'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Gestor: {nomeDe(equipe?.gestor_id)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {v.principal && (
                        <BadgeStatus
                          texto="Frente"
                          classe="bg-primary/15 text-primary border-primary/30"
                          className="text-[9px]"
                        />
                      )}
                      {podeGerenciar && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEquipeEmEdicao({ ...v })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              removerAtendimentoEquipe(v.id);
                              toast.success('Equipe desvinculada.');
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {v.escopo && (
                    <p className="mt-1 text-xs text-muted-foreground">{v.escopo}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Serviços */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Serviços contratados
            </p>
            {podeGerenciar && servicosDisponiveis.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setServicoEmEdicao({
                    id: novoId('sc'),
                    cliente_id: cliente.id,
                    servico_id: servicosDisponiveis[0].id,
                    regime: cliente.regime,
                    quantidade: 1,
                    unidade: 'postos',
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar
              </Button>
            )}
          </div>

          {contratados.length === 0 ? (
            <EstadoVazio icone={Building2} titulo="Nenhum serviço registrado" />
          ) : (
            contratados.map((sc) => {
              const servico = servicos.find((s) => s.id === sc.servico_id);
              return (
                <div key={sc.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{servico?.nome ?? '—'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {servico ? CATEGORIA_SERVICO[servico.categoria] : '—'} ·{' '}
                        {REGIME_ATENDIMENTO[sc.regime]} ·{' '}
                        <span className="tabular">
                          {sc.quantidade} {sc.unidade}
                        </span>
                      </p>
                    </div>
                    {podeGerenciar && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setServicoEmEdicao({ ...sc })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            removerServicoContratado(sc.id);
                            toast.success('Serviço retirado do contrato.');
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {sc.observacao && (
                    <p className="mt-1 text-xs text-muted-foreground">{sc.observacao}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Diálogo: equipe */}
        <Dialog open={equipeEmEdicao !== null} onOpenChange={(v) => !v && setEquipeEmEdicao(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Equipe na conta</DialogTitle>
            </DialogHeader>
            {equipeEmEdicao && (
              <div className="space-y-3">
                <CampoForm rotulo="Equipe">
                  {(id) => (
                    <Select
                      value={equipeEmEdicao.equipe_id}
                      onValueChange={(v) => setEquipeEmEdicao({ ...equipeEmEdicao, equipe_id: v })}
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {equipes
                          .filter(
                            (e) =>
                              e.ativo &&
                              (!vinculadas.has(e.id) || e.id === equipeEmEdicao.equipe_id),
                          )
                          .map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <CampoForm rotulo="Escopo nesta conta">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={equipeEmEdicao.escopo}
                      placeholder="Ex.: Service desk N1 em regime 24×7."
                      onChange={(e) =>
                        setEquipeEmEdicao({ ...equipeEmEdicao, escopo: e.target.value })
                      }
                    />
                  )}
                </CampoForm>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm">Equipe de frente</Label>
                    <p className="text-[11px] text-muted-foreground">Acionada primeiro.</p>
                  </div>
                  <Switch
                    checked={equipeEmEdicao.principal}
                    onCheckedChange={(v) =>
                      setEquipeEmEdicao({ ...equipeEmEdicao, principal: v })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEquipeEmEdicao(null)}>Cancelar</Button>
              <Button onClick={salvarEquipe}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo: serviço */}
        <Dialog open={servicoEmEdicao !== null} onOpenChange={(v) => !v && setServicoEmEdicao(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Serviço contratado</DialogTitle>
            </DialogHeader>
            {servicoEmEdicao && (
              <div className="space-y-3">
                <CampoForm rotulo="Serviço">
                  {(id) => (
                    <Select
                      value={servicoEmEdicao.servico_id}
                      onValueChange={(v) =>
                        setServicoEmEdicao({ ...servicoEmEdicao, servico_id: v })
                      }
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {servicos
                          .filter(
                            (s) =>
                              s.ativo &&
                              (!contratadosIds.has(s.id) || s.id === servicoEmEdicao.servico_id),
                          )
                          .map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <CampoForm rotulo="Regime">
                  {(id) => (
                    <Select
                      value={servicoEmEdicao.regime}
                      onValueChange={(v) =>
                        setServicoEmEdicao({ ...servicoEmEdicao, regime: v as RegimeAtendimento })
                      }
                    >
                      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REGIME_ATENDIMENTO) as RegimeAtendimento[]).map((r) => (
                          <SelectItem key={r} value={r}>{REGIME_ATENDIMENTO[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CampoForm>
                <div className="grid grid-cols-2 gap-3">
                  <CampoForm rotulo="Quantidade">
                    {(id) => (
                      <Input
                        id={id}
                        type="number"
                        min={1}
                        value={servicoEmEdicao.quantidade}
                        onChange={(e) =>
                          setServicoEmEdicao({
                            ...servicoEmEdicao,
                            quantidade: Number(e.target.value) || 0,
                          })
                        }
                      />
                    )}
                  </CampoForm>
                  <CampoForm rotulo="Unidade">
                    {(id) => (
                      <Input
                        id={id}
                        value={servicoEmEdicao.unidade}
                        placeholder="postos, hosts, horas/mês"
                        onChange={(e) =>
                          setServicoEmEdicao({ ...servicoEmEdicao, unidade: e.target.value })
                        }
                      />
                    )}
                  </CampoForm>
                </div>
                <CampoForm rotulo="Observação">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={2}
                      value={servicoEmEdicao.observacao ?? ''}
                      onChange={(e) =>
                        setServicoEmEdicao({
                          ...servicoEmEdicao,
                          observacao: e.target.value || undefined,
                        })
                      }
                    />
                  )}
                </CampoForm>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setServicoEmEdicao(null)}>Cancelar</Button>
              <Button onClick={salvarServico}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function AbaSatisfacao({
    cliente,
    avaliacoes,
  }: {
    cliente: Cliente;
    avaliacoes: AvaliacaoCliente[];
  }) {
    const { salvarAvaliacaoCliente } = dados;
    const { sessao } = useAuth();
    const [nova, setNova] = useState<AvaliacaoCliente | null>(null);

    const saude = useMemo(
      () => saudeCliente(avaliacoes, cliente.id),
      [avaliacoes, cliente.id],
    );

    const salvar = () => {
      if (!nova) return;
      if (nova.nota < 0 || nova.nota > 10) return toast.error('A nota vai de 0 a 10.');
      if (!nova.data) return toast.error('Informe a data da medição.');

      salvarAvaliacaoCliente({ ...nova, comentario: nova.comentario.trim() });
      toast.success('Avaliação registrada.');
      setNova(null);
    };

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border py-2">
            <p className="tabular text-xl font-bold leading-none">{saude.ultimaNota ?? '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Última nota</p>
          </div>
          <div className="rounded-lg border py-2">
            <p className="tabular text-xl font-bold leading-none">{saude.media ?? '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Média</p>
          </div>
          <div className="rounded-lg border py-2">
            <p className="tabular text-xl font-bold leading-none">{saude.totalAvaliacoes}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Medições</p>
          </div>
        </div>

        {saude.classe === 'detrator' && (
          <Aviso tom="destructive">
            Conta detratora na última medição. Alinhe um plano de recuperação com o gerente de
            conta antes da renovação.
          </Aviso>
        )}
        {saude.semLeituraRecente && saude.totalAvaliacoes > 0 && (
          <Aviso>Sem medição de satisfação há mais de 180 dias.</Aviso>
        )}

        {podeGerenciar && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              setNova({
                id: novoId('av'),
                cliente_id: cliente.id,
                data: hoje(),
                nota: 8,
                registrado_por: sessao?.funcionario.id ?? 'sistema',
                comentario: '',
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Registrar avaliação
          </Button>
        )}

        {avaliacoes.length === 0 ? (
          <EstadoVazio
            icone={Headphones}
            titulo="Conta nunca avaliada"
            descricao="Registre a percepção do cliente para acompanhar a evolução."
          />
        ) : (
          avaliacoes.map((a, i) => {
            const anterior = avaliacoes[i + 1];
            const variacao = anterior ? a.nota - anterior.nota : undefined;
            const classe = classificarNps(a.nota);
            return (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular text-lg font-bold">{a.nota}</span>
                    <BadgeStatus
                      texto={ROTULO_NPS[classe]}
                      classe={CLASSE_NPS[classe]}
                      className="text-[9px]"
                    />
                    {variacao !== undefined && variacao !== 0 && (
                      <span
                        className={`flex items-center text-[11px] font-medium ${
                          variacao > 0 ? 'text-success-strong' : 'text-destructive'
                        }`}
                      >
                        {variacao > 0 ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                        {Math.abs(variacao)}
                      </span>
                    )}
                  </div>
                  <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                    {formatarData(a.data)}
                  </span>
                </div>
                {a.comentario && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{a.comentario}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground/80">
                  por {nomeDe(a.registrado_por)}
                </p>
              </div>
            );
          })
        )}

        <Dialog open={nova !== null} onOpenChange={(v) => !v && setNova(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar avaliação</DialogTitle>
            </DialogHeader>
            {nova && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <CampoForm rotulo="Nota (0 a 10)">
                    {(id) => (
                      <Input
                        id={id}
                        type="number"
                        min={0}
                        max={10}
                        value={nova.nota}
                        onChange={(e) => setNova({ ...nova, nota: Number(e.target.value) })}
                      />
                    )}
                  </CampoForm>
                  <CampoForm rotulo="Data">
                    {(id) => (
                      <Input
                        id={id}
                        type="date"
                        value={nova.data}
                        onChange={(e) => setNova({ ...nova, data: e.target.value })}
                      />
                    )}
                  </CampoForm>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  0–6 detrator · 7–8 neutro · 9–10 promotor
                </p>
                <CampoForm rotulo="Comentário">
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={3}
                      value={nova.comentario}
                      placeholder="O que o cliente destacou, elogios e pontos de atrito."
                      onChange={(e) => setNova({ ...nova, comentario: e.target.value })}
                    />
                  )}
                </CampoForm>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNova(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}
