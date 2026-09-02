CREATE TYPE "public"."tipo_integracao" AS ENUM('zabbix', 'glpi', 'webhook');--> statement-breakpoint
CREATE TABLE "consultas_alerta" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"integracao_id" varchar(40) NOT NULL,
	"nome" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"filtro" json DEFAULT '{}'::json NOT NULL,
	"cliente_id" varchar(40),
	"visivel_para_cliente" boolean DEFAULT false NOT NULL,
	"ordem" smallint DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integracoes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"tipo" "tipo_integracao" NOT NULL,
	"nome" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"parametros" json DEFAULT '{}'::json NOT NULL,
	"segredos" text,
	"ultimo_teste_em" timestamp with time zone,
	"ultimo_teste_ok" boolean,
	"ultimo_teste_detalhe" text,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone,
	"atualizado_por" varchar(40)
);
--> statement-breakpoint
ALTER TABLE "consultas_alerta" ADD CONSTRAINT "consultas_alerta_integracao_id_integracoes_id_fk" FOREIGN KEY ("integracao_id") REFERENCES "public"."integracoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_alerta" ADD CONSTRAINT "consultas_alerta_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consultas_alerta_integracao_idx" ON "consultas_alerta" USING btree ("integracao_id");--> statement-breakpoint
CREATE INDEX "consultas_alerta_cliente_idx" ON "consultas_alerta" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "integracoes_tipo_idx" ON "integracoes" USING btree ("tipo");