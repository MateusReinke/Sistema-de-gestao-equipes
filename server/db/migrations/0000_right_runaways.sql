CREATE TYPE "public"."acao_auditoria" AS ENUM('criou', 'atualizou', 'removeu', 'aprovou', 'rejeitou', 'cancelou');--> statement-breakpoint
CREATE TYPE "public"."categoria_comunicado" AS ENUM('geral', 'beneficios', 'politica', 'evento', 'urgente');--> statement-breakpoint
CREATE TYPE "public"."categoria_servico" AS ENUM('suporte', 'infraestrutura', 'monitoramento', 'desenvolvimento', 'field_service', 'consultoria');--> statement-breakpoint
CREATE TYPE "public"."categoria_sistema" AS ENUM('infraestrutura', 'financeiro', 'comunicacao', 'desenvolvimento', 'atendimento', 'rh');--> statement-breakpoint
CREATE TYPE "public"."modelo_trabalho" AS ENUM('presencial', 'hibrido', 'remoto');--> statement-breakpoint
CREATE TYPE "public"."nivel_acesso" AS ENUM('leitura', 'escrita', 'admin');--> statement-breakpoint
CREATE TYPE "public"."papel_usuario" AS ENUM('admin', 'rh', 'gestor', 'colaborador');--> statement-breakpoint
CREATE TYPE "public"."regime_atendimento" AS ENUM('24x7', '12x5', '8x5', 'sob_demanda');--> statement-breakpoint
CREATE TYPE "public"."status_contrato" AS ENUM('ativo', 'em_renovacao', 'suspenso', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."status_funcionario" AS ENUM('ativo', 'ferias', 'afastado', 'desligado');--> statement-breakpoint
CREATE TYPE "public"."status_plantao" AS ENUM('previsto', 'confirmado', 'trocado', 'ausente');--> statement-breakpoint
CREATE TYPE "public"."status_solicitacao" AS ENUM('pendente', 'aprovada', 'rejeitada', 'cancelada', 'concluida');--> statement-breakpoint
CREATE TYPE "public"."tipo_acesso" AS ENUM('concessao', 'alteracao', 'revogacao');--> statement-breakpoint
CREATE TYPE "public"."tipo_ausencia" AS ENUM('atestado', 'falta', 'licenca_medica', 'licenca_maternidade', 'licenca_paternidade', 'luto', 'folga_compensatoria', 'treinamento');--> statement-breakpoint
CREATE TYPE "public"."tipo_contato" AS ENUM('principal', 'tecnico', 'financeiro', 'executivo');--> statement-breakpoint
CREATE TYPE "public"."tipo_contrato" AS ENUM('clt', 'pj', 'estagio', 'temporario', 'aprendiz');--> statement-breakpoint
CREATE TYPE "public"."tipo_escala" AS ENUM('12x36', '5x2', '6x1', 'personalizada');--> statement-breakpoint
CREATE TYPE "public"."tipo_plantao" AS ENUM('diurno', 'noturno', 'comercial', 'sobreaviso', 'especial');--> statement-breakpoint
CREATE TABLE "atendimento_equipes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cliente_id" varchar(40) NOT NULL,
	"equipe_id" varchar(40) NOT NULL,
	"escopo" text DEFAULT '' NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"em" timestamp with time zone NOT NULL,
	"ator_id" varchar(40),
	"ator_nome" text NOT NULL,
	"acao" "acao_auditoria" NOT NULL,
	"entidade" varchar(60) NOT NULL,
	"entidade_id" varchar(40) NOT NULL,
	"descricao" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ausencias" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"protocolo" varchar(30) NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"tipo" "tipo_ausencia" NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"dias" smallint NOT NULL,
	"justificativa" text DEFAULT '' NOT NULL,
	"abonada" boolean DEFAULT true NOT NULL,
	"status" "status_solicitacao" DEFAULT 'pendente' NOT NULL,
	"solicitado_por" varchar(40) NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL,
	"decidido_por" varchar(40),
	"decidido_em" timestamp with time zone,
	"observacao_decisao" text
);
--> statement-breakpoint
CREATE TABLE "avaliacoes_cliente" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cliente_id" varchar(40) NOT NULL,
	"data" date NOT NULL,
	"nota" smallint NOT NULL,
	"registrado_por" varchar(40) NOT NULL,
	"comentario" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"razao_social" text DEFAULT '' NOT NULL,
	"cnpj" varchar(20) DEFAULT '' NOT NULL,
	"id_whatsapp" varchar(30) DEFAULT '' NOT NULL,
	"segmento" text DEFAULT '' NOT NULL,
	"gerente_conta_id" varchar(40) NOT NULL,
	"responsavel_tecnico_id" varchar(40),
	"contrato_numero" varchar(40) DEFAULT '' NOT NULL,
	"contrato_inicio" date NOT NULL,
	"contrato_fim" date NOT NULL,
	"renovacao_automatica" boolean DEFAULT false NOT NULL,
	"aviso_previa_dias" smallint DEFAULT 30 NOT NULL,
	"valor_mensal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"status_contrato" "status_contrato" DEFAULT 'ativo' NOT NULL,
	"regime" "regime_atendimento" DEFAULT '8x5' NOT NULL,
	"sla_resposta_min" integer DEFAULT 60 NOT NULL,
	"sla_resolucao_horas" integer DEFAULT 8 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comunicados" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"corpo" text DEFAULT '' NOT NULL,
	"categoria" "categoria_comunicado" DEFAULT 'geral' NOT NULL,
	"autor_id" varchar(40) NOT NULL,
	"publicado_em" timestamp with time zone NOT NULL,
	"fixado" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos_cliente" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cliente_id" varchar(40) NOT NULL,
	"nome" text NOT NULL,
	"cargo" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"telefone" varchar(30) DEFAULT '' NOT NULL,
	"tipo" "tipo_contato" DEFAULT 'principal' NOT NULL,
	"principal" boolean DEFAULT false NOT NULL,
	"observacao" text
);
--> statement-breakpoint
CREATE TABLE "departamentos" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"sigla" varchar(12) NOT NULL,
	"centro_custo" varchar(30) NOT NULL,
	"responsavel_id" varchar(40)
);
--> statement-breakpoint
CREATE TABLE "equipes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"gestor_id" varchar(40),
	"departamento_id" varchar(40),
	"cobertura_minima" smallint DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escala_detalhes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"escala_id" varchar(40) NOT NULL,
	"dia_semana" smallint NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escala_funcionarios" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"escala_id" varchar(40) NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalas" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_escala" NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ferias" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"protocolo" varchar(30) NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"periodo_aquisitivo_inicio" date NOT NULL,
	"periodo_aquisitivo_fim" date NOT NULL,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"dias" smallint NOT NULL,
	"dias_abono" smallint DEFAULT 0 NOT NULL,
	"decimo_terceiro_antecipado" boolean DEFAULT false NOT NULL,
	"status" "status_solicitacao" DEFAULT 'pendente' NOT NULL,
	"solicitado_por" varchar(40) NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL,
	"decidido_por" varchar(40),
	"decidido_em" timestamp with time zone,
	"observacao_decisao" text
);
--> statement-breakpoint
CREATE TABLE "funcionarios" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"matricula" varchar(20) NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"telefone" varchar(30) DEFAULT '' NOT NULL,
	"cargo" text NOT NULL,
	"departamento_id" varchar(40) NOT NULL,
	"equipe_id" varchar(40) NOT NULL,
	"gestor_id" varchar(40),
	"tipo_contrato" "tipo_contrato" NOT NULL,
	"modelo_trabalho" "modelo_trabalho" NOT NULL,
	"data_admissao" date NOT NULL,
	"data_nascimento" date NOT NULL,
	"data_desligamento" date,
	"status" "status_funcionario" DEFAULT 'ativo' NOT NULL,
	"local" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niveis_escalonamento" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cliente_id" varchar(40) NOT NULL,
	"nivel" smallint NOT NULL,
	"titulo" text NOT NULL,
	"prazo_minutos" integer NOT NULL,
	"responsavel_interno_id" varchar(40),
	"contato_cliente_id" varchar(40),
	"canal" text DEFAULT '' NOT NULL,
	"instrucoes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_estados" (
	"state" varchar(64) PRIMARY KEY NOT NULL,
	"code_verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"destino" text DEFAULT '/' NOT NULL,
	"criado_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantoes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"escala_id" varchar(40),
	"data" date NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fim" time NOT NULL,
	"tipo" "tipo_plantao" NOT NULL,
	"status" "status_plantao" DEFAULT 'previsto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicos" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_servico" NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicos_contratados" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cliente_id" varchar(40) NOT NULL,
	"servico_id" varchar(40) NOT NULL,
	"regime" "regime_atendimento" NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"unidade" text DEFAULT '' NOT NULL,
	"observacao" text
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"usuario_id" varchar(40) NOT NULL,
	"criada_em" timestamp with time zone NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"id_token" text
);
--> statement-breakpoint
CREATE TABLE "sistemas" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"categoria" "categoria_sistema" NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"responsavel_id" varchar(40) NOT NULL,
	"requer_aprovacao_gestor" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitacoes_acesso" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"protocolo" varchar(30) NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"sistema_id" varchar(40) NOT NULL,
	"tipo" "tipo_acesso" NOT NULL,
	"nivel" "nivel_acesso" NOT NULL,
	"justificativa" text DEFAULT '' NOT NULL,
	"expira_em" date,
	"status" "status_solicitacao" DEFAULT 'pendente' NOT NULL,
	"solicitado_por" varchar(40) NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL,
	"decidido_por" varchar(40),
	"decidido_em" timestamp with time zone,
	"observacao_decisao" text
);
--> statement-breakpoint
CREATE TABLE "trocas_plantao" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"protocolo" varchar(30) NOT NULL,
	"plantao_id" varchar(40) NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"substituto_id" varchar(40) NOT NULL,
	"motivo" text DEFAULT '' NOT NULL,
	"status" "status_solicitacao" DEFAULT 'pendente' NOT NULL,
	"solicitado_por" varchar(40) NOT NULL,
	"solicitado_em" timestamp with time zone NOT NULL,
	"decidido_por" varchar(40),
	"decidido_em" timestamp with time zone,
	"observacao_decisao" text
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"email" text NOT NULL,
	"role" "papel_usuario" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atendimento_equipes" ADD CONSTRAINT "atendimento_equipes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atendimento_equipes" ADD CONSTRAINT "atendimento_equipes_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_cliente" ADD CONSTRAINT "avaliacoes_cliente_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avaliacoes_cliente" ADD CONSTRAINT "avaliacoes_cliente_registrado_por_funcionarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_gerente_conta_id_funcionarios_id_fk" FOREIGN KEY ("gerente_conta_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavel_tecnico_id_funcionarios_id_fk" FOREIGN KEY ("responsavel_tecnico_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_autor_id_funcionarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_cliente" ADD CONSTRAINT "contatos_cliente_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_departamento_id_departamentos_id_fk" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_detalhes" ADD CONSTRAINT "escala_detalhes_escala_id_escalas_id_fk" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_funcionarios" ADD CONSTRAINT "escala_funcionarios_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_funcionarios" ADD CONSTRAINT "escala_funcionarios_escala_id_escalas_id_fk" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ferias" ADD CONSTRAINT "ferias_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_departamento_id_departamentos_id_fk" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funcionarios" ADD CONSTRAINT "funcionarios_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niveis_escalonamento" ADD CONSTRAINT "niveis_escalonamento_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niveis_escalonamento" ADD CONSTRAINT "niveis_escalonamento_responsavel_interno_id_funcionarios_id_fk" FOREIGN KEY ("responsavel_interno_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niveis_escalonamento" ADD CONSTRAINT "niveis_escalonamento_contato_cliente_id_contatos_cliente_id_fk" FOREIGN KEY ("contato_cliente_id") REFERENCES "public"."contatos_cliente"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_escala_id_escalas_id_fk" FOREIGN KEY ("escala_id") REFERENCES "public"."escalas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_contratados" ADD CONSTRAINT "servicos_contratados_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_contratados" ADD CONSTRAINT "servicos_contratados_servico_id_servicos_id_fk" FOREIGN KEY ("servico_id") REFERENCES "public"."servicos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sistemas" ADD CONSTRAINT "sistemas_responsavel_id_funcionarios_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_acesso" ADD CONSTRAINT "solicitacoes_acesso_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitacoes_acesso" ADD CONSTRAINT "solicitacoes_acesso_sistema_id_sistemas_id_fk" FOREIGN KEY ("sistema_id") REFERENCES "public"."sistemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_plantao" ADD CONSTRAINT "trocas_plantao_plantao_id_plantoes_id_fk" FOREIGN KEY ("plantao_id") REFERENCES "public"."plantoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_plantao" ADD CONSTRAINT "trocas_plantao_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trocas_plantao" ADD CONSTRAINT "trocas_plantao_substituto_id_funcionarios_id_fk" FOREIGN KEY ("substituto_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atendimento_equipes_idx" ON "atendimento_equipes" USING btree ("cliente_id","equipe_id");--> statement-breakpoint
CREATE INDEX "auditoria_em_idx" ON "auditoria" USING btree ("em");--> statement-breakpoint
CREATE UNIQUE INDEX "ausencias_protocolo_idx" ON "ausencias" USING btree ("protocolo");--> statement-breakpoint
CREATE INDEX "ausencias_funcionario_idx" ON "ausencias" USING btree ("funcionario_id");--> statement-breakpoint
CREATE INDEX "avaliacoes_cliente_idx" ON "avaliacoes_cliente" USING btree ("cliente_id","data");--> statement-breakpoint
CREATE INDEX "contatos_cliente_idx" ON "contatos_cliente" USING btree ("cliente_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ferias_protocolo_idx" ON "ferias" USING btree ("protocolo");--> statement-breakpoint
CREATE INDEX "ferias_funcionario_idx" ON "ferias" USING btree ("funcionario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "funcionarios_matricula_idx" ON "funcionarios" USING btree ("matricula");--> statement-breakpoint
CREATE UNIQUE INDEX "funcionarios_email_idx" ON "funcionarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "funcionarios_equipe_idx" ON "funcionarios" USING btree ("equipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "escalonamento_cliente_nivel_idx" ON "niveis_escalonamento" USING btree ("cliente_id","nivel");--> statement-breakpoint
CREATE INDEX "plantoes_data_idx" ON "plantoes" USING btree ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "plantoes_turno_idx" ON "plantoes" USING btree ("funcionario_id","data","hora_inicio");--> statement-breakpoint
CREATE UNIQUE INDEX "servicos_contratados_idx" ON "servicos_contratados" USING btree ("cliente_id","servico_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acessos_protocolo_idx" ON "solicitacoes_acesso" USING btree ("protocolo");--> statement-breakpoint
CREATE INDEX "acessos_expira_idx" ON "solicitacoes_acesso" USING btree ("expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "trocas_protocolo_idx" ON "trocas_plantao" USING btree ("protocolo");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_idx" ON "usuarios" USING btree ("email");