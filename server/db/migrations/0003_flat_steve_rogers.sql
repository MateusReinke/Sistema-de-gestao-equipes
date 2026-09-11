CREATE TYPE "public"."papel_escala" AS ENUM('trabalho', 'plantao', 'backup');--> statement-breakpoint
ALTER TABLE "escala_detalhes" ADD COLUMN "semana_do_ciclo" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
-- 'comercial' preenche as linhas já existentes; cai fora logo em seguida —
-- o schema não declara default nenhum, é só para a coluna nascer válida.
ALTER TABLE "escala_detalhes" ADD COLUMN "tipo" "tipo_plantao" DEFAULT 'comercial' NOT NULL;--> statement-breakpoint
ALTER TABLE "escala_detalhes" ALTER COLUMN "tipo" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "escala_funcionarios" ADD COLUMN "ancora_em" date;--> statement-breakpoint
-- Vínculo já existente: a âncora vira a própria data de início, que era o
-- comportamento implícito antes desta coluna existir.
UPDATE "escala_funcionarios" SET "ancora_em" = "data_inicio" WHERE "ancora_em" IS NULL;--> statement-breakpoint
ALTER TABLE "escala_funcionarios" ALTER COLUMN "ancora_em" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "equipe_id" varchar(40);--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "ciclo_semanas" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "papel" "papel_escala" DEFAULT 'trabalho' NOT NULL;--> statement-breakpoint
ALTER TABLE "plantoes" ADD COLUMN "gerado_automaticamente" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escala_detalhes_turno_idx" ON "escala_detalhes" USING btree ("escala_id","semana_do_ciclo","dia_semana","hora_inicio");