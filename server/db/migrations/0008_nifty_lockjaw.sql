CREATE TABLE "escala_cadastros" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"inicio_em" date NOT NULL,
	"observacao" text DEFAULT '' NOT NULL,
	CONSTRAINT "escala_cadastros_funcionario_id_unique" UNIQUE("funcionario_id")
);
--> statement-breakpoint
CREATE TABLE "escala_celulas" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"cadastro_id" varchar(40) NOT NULL,
	"semana" smallint NOT NULL,
	"dia_semana" smallint NOT NULL,
	"tipo_turno_id" varchar(40) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plantoes" DROP CONSTRAINT IF EXISTS "plantoes_escala_id_escalas_id_fk";--> statement-breakpoint
ALTER TABLE "escala_detalhes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escala_funcionarios" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "escalas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "escala_detalhes" CASCADE;--> statement-breakpoint
DROP TABLE "escala_funcionarios" CASCADE;--> statement-breakpoint
DROP TABLE "escalas" CASCADE;--> statement-breakpoint
ALTER TABLE "escala_cadastros" ADD CONSTRAINT "escala_cadastros_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_celulas" ADD CONSTRAINT "escala_celulas_cadastro_id_escala_cadastros_id_fk" FOREIGN KEY ("cadastro_id") REFERENCES "public"."escala_cadastros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_celulas" ADD CONSTRAINT "escala_celulas_tipo_turno_id_tipos_turno_id_fk" FOREIGN KEY ("tipo_turno_id") REFERENCES "public"."tipos_turno"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escala_celulas_celula_idx" ON "escala_celulas" USING btree ("cadastro_id","semana","dia_semana");--> statement-breakpoint
ALTER TABLE "plantoes" DROP COLUMN "escala_id";--> statement-breakpoint
DROP TYPE "public"."papel_escala";--> statement-breakpoint
DROP TYPE "public"."tipo_escala";