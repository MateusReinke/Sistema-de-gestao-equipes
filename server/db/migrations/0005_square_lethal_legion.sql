CREATE TYPE "public"."acionamento_turno" AS ENUM('nenhum', 'plantao', 'backup');--> statement-breakpoint
CREATE TABLE "tipos_turno" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"equipe_id" varchar(40) NOT NULL,
	"codigo" text NOT NULL,
	"rotulo" text NOT NULL,
	"cor" text DEFAULT 'laranja' NOT NULL,
	"trabalha" boolean DEFAULT true NOT NULL,
	"acionamento" "acionamento_turno" DEFAULT 'nenhum' NOT NULL,
	"hora_inicio" time DEFAULT '08:00' NOT NULL,
	"hora_fim" time DEFAULT '17:00' NOT NULL,
	"acionamento_inicio" time DEFAULT '00:00' NOT NULL,
	"acionamento_fim" time DEFAULT '23:59' NOT NULL,
	"tipo_plantao" "tipo_plantao" DEFAULT 'comercial' NOT NULL,
	"ordem" smallint DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escala_detalhes" ADD COLUMN "tipo_turno_id" varchar(40);--> statement-breakpoint
ALTER TABLE "plantoes" ADD COLUMN "tipo_turno_id" varchar(40);--> statement-breakpoint
ALTER TABLE "tipos_turno" ADD CONSTRAINT "tipos_turno_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_detalhes" ADD CONSTRAINT "escala_detalhes_tipo_turno_id_tipos_turno_id_fk" FOREIGN KEY ("tipo_turno_id") REFERENCES "public"."tipos_turno"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantoes" ADD CONSTRAINT "plantoes_tipo_turno_id_tipos_turno_id_fk" FOREIGN KEY ("tipo_turno_id") REFERENCES "public"."tipos_turno"("id") ON DELETE set null ON UPDATE no action;