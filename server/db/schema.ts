/**
 * Schema Postgres da Central de Gestão de Pessoas.
 *
 * Espelha `src/types/sgo.ts` um-para-um: os mesmos nomes de campo, para que a
 * linha do banco possa ser devolvida à interface sem tradução. Os tipos de
 * união do domínio viram enums do Postgres, então um status inválido é barrado
 * no banco e não só na aplicação.
 */
import {
  boolean,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * `timestamptz` que entra e sai como string ISO-8601.
 *
 * O domínio trata carimbo de tempo como string ISO; sem isto, cada leitura
 * devolveria um `Date` e as telas teriam de converter. O banco continua com o
 * tipo certo, com fuso e ordenação reais.
 */
const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType: () => 'timestamp with time zone',
  // O driver devolve Date para timestamptz; normalizamos para ISO na leitura e
  // enviamos ISO na escrita, que o Postgres aceita como literal.
  fromDriver: (valor) => new Date(valor).toISOString(),
  toDriver: (valor) => new Date(valor).toISOString(),
});

/** Dinheiro em `numeric` para não acumular erro de ponto flutuante. */
const dinheiro = customType<{ data: number; driverData: string }>({
  dataType: () => 'numeric(12, 2)',
  fromDriver: (valor) => Number(valor),
  toDriver: (valor) => String(valor),
});

/**
 * Hora do turno como `HH:MM`.
 *
 * O Postgres devolve `time` como `08:00:00`; o domínio compara e formata em
 * `HH:MM`, então o segundo sobrando apareceria na tela e quebraria comparação
 * de string. Cortamos aqui, uma vez, em vez de em cada tela.
 */
const horaMinuto = customType<{ data: string; driverData: string }>({
  dataType: () => 'time',
  fromDriver: (valor) => valor.slice(0, 5),
});

/* -------------------------------------------------------------------- enums */

export const papelUsuario = pgEnum('papel_usuario', ['admin', 'rh', 'gestor', 'colaborador']);
export const tipoContrato = pgEnum('tipo_contrato', ['clt', 'pj', 'estagio', 'temporario', 'aprendiz']);
export const modeloTrabalho = pgEnum('modelo_trabalho', ['presencial', 'hibrido', 'remoto']);
export const statusFuncionario = pgEnum('status_funcionario', ['ativo', 'ferias', 'afastado', 'desligado']);
export const tipoEscala = pgEnum('tipo_escala', ['12x36', '5x2', '6x1', 'personalizada']);
export const tipoPlantao = pgEnum('tipo_plantao', ['diurno', 'noturno', 'comercial', 'sobreaviso', 'especial']);
export const statusPlantao = pgEnum('status_plantao', ['previsto', 'confirmado', 'trocado', 'ausente']);
export const statusSolicitacao = pgEnum('status_solicitacao', [
  'pendente',
  'aprovada',
  'rejeitada',
  'cancelada',
  'concluida',
]);
export const tipoAusencia = pgEnum('tipo_ausencia', [
  'atestado',
  'falta',
  'licenca_medica',
  'licenca_maternidade',
  'licenca_paternidade',
  'luto',
  'folga_compensatoria',
  'treinamento',
]);
export const categoriaSistema = pgEnum('categoria_sistema', [
  'infraestrutura',
  'financeiro',
  'comunicacao',
  'desenvolvimento',
  'atendimento',
  'rh',
]);
export const nivelAcesso = pgEnum('nivel_acesso', ['leitura', 'escrita', 'admin']);
export const tipoAcesso = pgEnum('tipo_acesso', ['concessao', 'alteracao', 'revogacao']);
export const categoriaComunicado = pgEnum('categoria_comunicado', [
  'geral',
  'beneficios',
  'politica',
  'evento',
  'urgente',
]);
export const acaoAuditoria = pgEnum('acao_auditoria', [
  'criou',
  'atualizou',
  'removeu',
  'aprovou',
  'rejeitou',
  'cancelou',
]);
export const statusContrato = pgEnum('status_contrato', ['ativo', 'em_renovacao', 'suspenso', 'encerrado']);
export const regimeAtendimento = pgEnum('regime_atendimento', ['24x7', '12x5', '8x5', 'sob_demanda']);
export const tipoContato = pgEnum('tipo_contato', ['principal', 'tecnico', 'financeiro', 'executivo']);
export const categoriaServico = pgEnum('categoria_servico', [
  'suporte',
  'infraestrutura',
  'monitoramento',
  'desenvolvimento',
  'field_service',
  'consultoria',
]);

/* -------------------------------------------------------------- organização */

export const departamentos = pgTable('departamentos', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  sigla: varchar('sigla', { length: 12 }).notNull(),
  centro_custo: varchar('centro_custo', { length: 30 }).notNull(),
  // Sem FK: o responsável é um funcionário, e funcionários referenciam
  // departamento. Uma FK nos dois sentidos travaria a ordem de inserção.
  responsavel_id: varchar('responsavel_id', { length: 40 }),
});

export const equipes = pgTable('equipes', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  gestor_id: varchar('gestor_id', { length: 40 }),
  departamento_id: varchar('departamento_id', { length: 40 }).references(() => departamentos.id),
  cobertura_minima: smallint('cobertura_minima').notNull().default(0),
  ativo: boolean('ativo').notNull().default(true),
});

export const funcionarios = pgTable(
  'funcionarios',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    matricula: varchar('matricula', { length: 20 }).notNull(),
    nome: text('nome').notNull(),
    email: text('email').notNull(),
    telefone: varchar('telefone', { length: 30 }).notNull().default(''),
    cargo: text('cargo').notNull(),
    departamento_id: varchar('departamento_id', { length: 40 })
      .notNull()
      .references(() => departamentos.id),
    equipe_id: varchar('equipe_id', { length: 40 })
      .notNull()
      .references(() => equipes.id),
    gestor_id: varchar('gestor_id', { length: 40 }),
    tipo_contrato: tipoContrato('tipo_contrato').notNull(),
    modelo_trabalho: modeloTrabalho('modelo_trabalho').notNull(),
    data_admissao: date('data_admissao').notNull(),
    data_nascimento: date('data_nascimento').notNull(),
    data_desligamento: date('data_desligamento'),
    status: statusFuncionario('status').notNull().default('ativo'),
    local: text('local').notNull().default(''),
  },
  (t) => ({
    // A matrícula identifica a pessoa na folha — duplicá-la quebra a
    // conciliação, então o banco recusa em vez de confiar só na validação.
    matriculaUnica: uniqueIndex('funcionarios_matricula_idx').on(t.matricula),
    emailUnico: uniqueIndex('funcionarios_email_idx').on(t.email),
    porEquipe: index('funcionarios_equipe_idx').on(t.equipe_id),
  }),
);

export const usuarios = pgTable(
  'usuarios',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id),
    email: text('email').notNull(),
    role: papelUsuario('role').notNull(),
    ativo: boolean('ativo').notNull().default(true),

    /**
     * Hash scrypt da senha local. Nulo em quem só entra por SSO — o campo
     * existir vazio é o que permite os dois métodos convivendo.
     */
    senha_hash: text('senha_hash'),
    /** Senha temporária entregue pelo RH: obriga troca no primeiro acesso. */
    deve_trocar_senha: boolean('deve_trocar_senha').notNull().default(false),
    senha_atualizada_em: isoTimestamp('senha_atualizada_em'),

    /* Contenção de força bruta, guardada no banco para sobreviver a restart. */
    tentativas_falhas: smallint('tentativas_falhas').notNull().default(0),
    bloqueado_ate: isoTimestamp('bloqueado_ate'),
    ultimo_acesso_em: isoTimestamp('ultimo_acesso_em'),
  },
  (t) => ({
    // O e-mail é a chave que liga a identidade do SSO ao cadastro interno.
    emailUnico: uniqueIndex('usuarios_email_idx').on(t.email),
  }),
);

/**
 * Configuração de autenticação, editável pela própria aplicação.
 *
 * Fica no banco, e não em variável de ambiente, para que o administrador ligue
 * o SSO pela tela sem depender de redeploy. Linha única, fixada em `id = 1`.
 */
export const configuracaoAuth = pgTable('configuracao_auth', {
  id: smallint('id').primaryKey().default(1),

  /** Permite entrar com e-mail e senha cadastrados aqui. */
  senha_local_ativa: boolean('senha_local_ativa').notNull().default(true),

  sso_ativo: boolean('sso_ativo').notNull().default(false),
  oidc_issuer: text('oidc_issuer'),
  oidc_client_id: text('oidc_client_id'),
  /**
   * Client secret cifrado com AES-256-GCM (ver `auth/segredos.ts`). Um dump do
   * banco, sozinho, não expõe o segredo do provedor.
   */
  oidc_client_secret: text('oidc_client_secret'),
  oidc_escopo: text('oidc_escopo').notNull().default('openid profile email'),

  /**
   * Marca que a configuração passou por um teste de descoberta bem-sucedido.
   * É o que autoriza desligar a senha local sem trancar todo mundo do lado de
   * fora.
   */
  sso_validado_em: isoTimestamp('sso_validado_em'),

  atualizado_em: isoTimestamp('atualizado_em'),
  atualizado_por: varchar('atualizado_por', { length: 40 }),
});

/* ------------------------------------------------------------------ clientes */

export const clientes = pgTable('clientes', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  razao_social: text('razao_social').notNull().default(''),
  cnpj: varchar('cnpj', { length: 20 }).notNull().default(''),
  id_whatsapp: varchar('id_whatsapp', { length: 30 }).notNull().default(''),
  segmento: text('segmento').notNull().default(''),
  gerente_conta_id: varchar('gerente_conta_id', { length: 40 })
    .notNull()
    .references(() => funcionarios.id),
  responsavel_tecnico_id: varchar('responsavel_tecnico_id', { length: 40 }).references(() => funcionarios.id),
  contrato_numero: varchar('contrato_numero', { length: 40 }).notNull().default(''),
  contrato_inicio: date('contrato_inicio').notNull(),
  contrato_fim: date('contrato_fim').notNull(),
  renovacao_automatica: boolean('renovacao_automatica').notNull().default(false),
  aviso_previa_dias: smallint('aviso_previa_dias').notNull().default(30),
  valor_mensal: dinheiro('valor_mensal').notNull().default(0),
  status_contrato: statusContrato('status_contrato').notNull().default('ativo'),
  regime: regimeAtendimento('regime').notNull().default('8x5'),
  sla_resposta_min: integer('sla_resposta_min').notNull().default(60),
  sla_resolucao_horas: integer('sla_resolucao_horas').notNull().default(8),
  ativo: boolean('ativo').notNull().default(true),
});

export const contatosCliente = pgTable(
  'contatos_cliente',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    cliente_id: varchar('cliente_id', { length: 40 })
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    cargo: text('cargo').notNull().default(''),
    email: text('email').notNull().default(''),
    telefone: varchar('telefone', { length: 30 }).notNull().default(''),
    tipo: tipoContato('tipo').notNull().default('principal'),
    principal: boolean('principal').notNull().default(false),
    observacao: text('observacao'),
  },
  (t) => ({ porCliente: index('contatos_cliente_idx').on(t.cliente_id) }),
);

export const niveisEscalonamento = pgTable(
  'niveis_escalonamento',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    cliente_id: varchar('cliente_id', { length: 40 })
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    nivel: smallint('nivel').notNull(),
    titulo: text('titulo').notNull(),
    prazo_minutos: integer('prazo_minutos').notNull(),
    responsavel_interno_id: varchar('responsavel_interno_id', { length: 40 }).references(() => funcionarios.id),
    contato_cliente_id: varchar('contato_cliente_id', { length: 40 }).references(() => contatosCliente.id, {
      onDelete: 'set null',
    }),
    canal: text('canal').notNull().default(''),
    instrucoes: text('instrucoes').notNull().default(''),
  },
  (t) => ({
    // Dois degraus com o mesmo número deixariam a trilha ambígua.
    nivelUnico: uniqueIndex('escalonamento_cliente_nivel_idx').on(t.cliente_id, t.nivel),
  }),
);

export const servicos = pgTable('servicos', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  categoria: categoriaServico('categoria').notNull(),
  descricao: text('descricao').notNull().default(''),
  ativo: boolean('ativo').notNull().default(true),
});

export const servicosContratados = pgTable(
  'servicos_contratados',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    cliente_id: varchar('cliente_id', { length: 40 })
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    servico_id: varchar('servico_id', { length: 40 })
      .notNull()
      .references(() => servicos.id),
    regime: regimeAtendimento('regime').notNull(),
    quantidade: integer('quantidade').notNull().default(1),
    unidade: text('unidade').notNull().default(''),
    observacao: text('observacao'),
  },
  (t) => ({
    servicoUnico: uniqueIndex('servicos_contratados_idx').on(t.cliente_id, t.servico_id),
  }),
);

export const atendimentoEquipes = pgTable(
  'atendimento_equipes',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    cliente_id: varchar('cliente_id', { length: 40 })
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    equipe_id: varchar('equipe_id', { length: 40 })
      .notNull()
      .references(() => equipes.id, { onDelete: 'cascade' }),
    escopo: text('escopo').notNull().default(''),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => ({
    vinculoUnico: uniqueIndex('atendimento_equipes_idx').on(t.cliente_id, t.equipe_id),
  }),
);

export const avaliacoesCliente = pgTable(
  'avaliacoes_cliente',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    cliente_id: varchar('cliente_id', { length: 40 })
      .notNull()
      .references(() => clientes.id, { onDelete: 'cascade' }),
    data: date('data').notNull(),
    nota: smallint('nota').notNull(),
    registrado_por: varchar('registrado_por', { length: 40 })
      .notNull()
      .references(() => funcionarios.id),
    comentario: text('comentario').notNull().default(''),
  },
  (t) => ({ porCliente: index('avaliacoes_cliente_idx').on(t.cliente_id, t.data) }),
);

/* -------------------------------------------------------- escalas e plantões */

export const escalas = pgTable('escalas', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  tipo: tipoEscala('tipo').notNull(),
  descricao: text('descricao').notNull().default(''),
  ativo: boolean('ativo').notNull().default(true),
});

export const escalaDetalhes = pgTable('escala_detalhes', {
  id: varchar('id', { length: 40 }).primaryKey(),
  escala_id: varchar('escala_id', { length: 40 })
    .notNull()
    .references(() => escalas.id, { onDelete: 'cascade' }),
  dia_semana: smallint('dia_semana').notNull(),
  hora_inicio: horaMinuto('hora_inicio').notNull(),
  hora_fim: horaMinuto('hora_fim').notNull(),
});

export const escalaFuncionarios = pgTable('escala_funcionarios', {
  id: varchar('id', { length: 40 }).primaryKey(),
  funcionario_id: varchar('funcionario_id', { length: 40 })
    .notNull()
    .references(() => funcionarios.id, { onDelete: 'cascade' }),
  escala_id: varchar('escala_id', { length: 40 })
    .notNull()
    .references(() => escalas.id, { onDelete: 'cascade' }),
  data_inicio: date('data_inicio').notNull(),
  data_fim: date('data_fim').notNull(),
});

export const plantoes = pgTable(
  'plantoes',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id, { onDelete: 'cascade' }),
    escala_id: varchar('escala_id', { length: 40 }).references(() => escalas.id, { onDelete: 'set null' }),
    data: date('data').notNull(),
    hora_inicio: horaMinuto('hora_inicio').notNull(),
    hora_fim: horaMinuto('hora_fim').notNull(),
    tipo: tipoPlantao('tipo').notNull(),
    status: statusPlantao('status').notNull().default('previsto'),
  },
  (t) => ({
    // O calendário sempre consulta por intervalo de datas.
    porData: index('plantoes_data_idx').on(t.data),
    // Escalar a mesma pessoa duas vezes no mesmo turno é erro de digitação.
    turnoUnico: uniqueIndex('plantoes_turno_idx').on(t.funcionario_id, t.data, t.hora_inicio),
  }),
);

/* -------------------------------------------------------------- solicitações */

export const ferias = pgTable(
  'ferias',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    protocolo: varchar('protocolo', { length: 30 }).notNull(),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id, { onDelete: 'cascade' }),
    periodo_aquisitivo_inicio: date('periodo_aquisitivo_inicio').notNull(),
    periodo_aquisitivo_fim: date('periodo_aquisitivo_fim').notNull(),
    data_inicio: date('data_inicio').notNull(),
    data_fim: date('data_fim').notNull(),
    dias: smallint('dias').notNull(),
    dias_abono: smallint('dias_abono').notNull().default(0),
    decimo_terceiro_antecipado: boolean('decimo_terceiro_antecipado').notNull().default(false),
    status: statusSolicitacao('status').notNull().default('pendente'),
    solicitado_por: varchar('solicitado_por', { length: 40 }).notNull(),
    solicitado_em: isoTimestamp('solicitado_em').notNull(),
    decidido_por: varchar('decidido_por', { length: 40 }),
    decidido_em: isoTimestamp('decidido_em'),
    observacao_decisao: text('observacao_decisao'),
  },
  (t) => ({
    protocoloUnico: uniqueIndex('ferias_protocolo_idx').on(t.protocolo),
    porFuncionario: index('ferias_funcionario_idx').on(t.funcionario_id),
  }),
);

export const ausencias = pgTable(
  'ausencias',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    protocolo: varchar('protocolo', { length: 30 }).notNull(),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id, { onDelete: 'cascade' }),
    tipo: tipoAusencia('tipo').notNull(),
    data_inicio: date('data_inicio').notNull(),
    data_fim: date('data_fim').notNull(),
    dias: smallint('dias').notNull(),
    justificativa: text('justificativa').notNull().default(''),
    abonada: boolean('abonada').notNull().default(true),
    status: statusSolicitacao('status').notNull().default('pendente'),
    solicitado_por: varchar('solicitado_por', { length: 40 }).notNull(),
    solicitado_em: isoTimestamp('solicitado_em').notNull(),
    decidido_por: varchar('decidido_por', { length: 40 }),
    decidido_em: isoTimestamp('decidido_em'),
    observacao_decisao: text('observacao_decisao'),
  },
  (t) => ({
    protocoloUnico: uniqueIndex('ausencias_protocolo_idx').on(t.protocolo),
    porFuncionario: index('ausencias_funcionario_idx').on(t.funcionario_id),
  }),
);

export const sistemas = pgTable('sistemas', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nome: text('nome').notNull(),
  categoria: categoriaSistema('categoria').notNull(),
  descricao: text('descricao').notNull().default(''),
  responsavel_id: varchar('responsavel_id', { length: 40 })
    .notNull()
    .references(() => funcionarios.id),
  requer_aprovacao_gestor: boolean('requer_aprovacao_gestor').notNull().default(false),
  ativo: boolean('ativo').notNull().default(true),
});

export const solicitacoesAcesso = pgTable(
  'solicitacoes_acesso',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    protocolo: varchar('protocolo', { length: 30 }).notNull(),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id, { onDelete: 'cascade' }),
    sistema_id: varchar('sistema_id', { length: 40 })
      .notNull()
      .references(() => sistemas.id),
    tipo: tipoAcesso('tipo').notNull(),
    nivel: nivelAcesso('nivel').notNull(),
    justificativa: text('justificativa').notNull().default(''),
    expira_em: date('expira_em'),
    status: statusSolicitacao('status').notNull().default('pendente'),
    solicitado_por: varchar('solicitado_por', { length: 40 }).notNull(),
    solicitado_em: isoTimestamp('solicitado_em').notNull(),
    decidido_por: varchar('decidido_por', { length: 40 }),
    decidido_em: isoTimestamp('decidido_em'),
    observacao_decisao: text('observacao_decisao'),
  },
  (t) => ({
    protocoloUnico: uniqueIndex('acessos_protocolo_idx').on(t.protocolo),
    // O alerta de acesso temporário vencido varre por esta coluna.
    porExpiracao: index('acessos_expira_idx').on(t.expira_em),
  }),
);

export const trocasPlantao = pgTable(
  'trocas_plantao',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    protocolo: varchar('protocolo', { length: 30 }).notNull(),
    plantao_id: varchar('plantao_id', { length: 40 })
      .notNull()
      .references(() => plantoes.id, { onDelete: 'cascade' }),
    funcionario_id: varchar('funcionario_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id, { onDelete: 'cascade' }),
    substituto_id: varchar('substituto_id', { length: 40 })
      .notNull()
      .references(() => funcionarios.id),
    motivo: text('motivo').notNull().default(''),
    status: statusSolicitacao('status').notNull().default('pendente'),
    solicitado_por: varchar('solicitado_por', { length: 40 }).notNull(),
    solicitado_em: isoTimestamp('solicitado_em').notNull(),
    decidido_por: varchar('decidido_por', { length: 40 }),
    decidido_em: isoTimestamp('decidido_em'),
    observacao_decisao: text('observacao_decisao'),
  },
  (t) => ({ protocoloUnico: uniqueIndex('trocas_protocolo_idx').on(t.protocolo) }),
);

/* ------------------------------------------------- comunicação e auditoria */

export const comunicados = pgTable('comunicados', {
  id: varchar('id', { length: 40 }).primaryKey(),
  titulo: text('titulo').notNull(),
  corpo: text('corpo').notNull().default(''),
  categoria: categoriaComunicado('categoria').notNull().default('geral'),
  autor_id: varchar('autor_id', { length: 40 })
    .notNull()
    .references(() => funcionarios.id),
  publicado_em: isoTimestamp('publicado_em').notNull(),
  fixado: boolean('fixado').notNull().default(false),
});

export const auditoria = pgTable(
  'auditoria',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    em: isoTimestamp('em').notNull(),
    ator_id: varchar('ator_id', { length: 40 }),
    // Guardado por valor, não por FK: a trilha precisa sobreviver ao
    // desligamento e à remoção do cadastro de quem agiu.
    ator_nome: text('ator_nome').notNull(),
    acao: acaoAuditoria('acao').notNull(),
    entidade: varchar('entidade', { length: 60 }).notNull(),
    entidade_id: varchar('entidade_id', { length: 40 }).notNull(),
    descricao: text('descricao').notNull().default(''),
  },
  (t) => ({ porData: index('auditoria_em_idx').on(t.em) }),
);

/* -------------------------------------------------------------------- sessão */

/**
 * Sessões do SSO. Ficam no banco, e não só no cookie, para que revogar o
 * acesso de alguém tenha efeito imediato — apagar a linha derruba a sessão.
 */
export const sessoes = pgTable(
  'sessoes',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    usuario_id: varchar('usuario_id', { length: 40 })
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    criada_em: isoTimestamp('criada_em').notNull(),
    expira_em: isoTimestamp('expira_em').notNull(),
    /** Guardado para permitir logout federado no provedor de identidade. */
    id_token: text('id_token'),
  },
  (t) => ({ porUsuario: index('sessoes_usuario_idx').on(t.usuario_id) }),
);

/**
 * Estado temporário do fluxo OIDC (code verifier do PKCE, nonce e destino).
 * Vive entre o redirect para o provedor e a volta no callback.
 */
export const oidcEstados = pgTable('oidc_estados', {
  state: varchar('state', { length: 64 }).primaryKey(),
  code_verifier: text('code_verifier').notNull(),
  nonce: text('nonce').notNull(),
  destino: text('destino').notNull().default('/'),
  criado_em: isoTimestamp('criado_em').notNull(),
});

/** Todas as tabelas de negócio, na ordem segura de inserção do seed. */
export const tabelasNaOrdem = [
  departamentos,
  equipes,
  funcionarios,
  usuarios,
  clientes,
  contatosCliente,
  niveisEscalonamento,
  servicos,
  servicosContratados,
  atendimentoEquipes,
  avaliacoesCliente,
  escalas,
  escalaDetalhes,
  escalaFuncionarios,
  plantoes,
  ferias,
  ausencias,
  sistemas,
  solicitacoesAcesso,
  trocasPlantao,
  comunicados,
] as const;
