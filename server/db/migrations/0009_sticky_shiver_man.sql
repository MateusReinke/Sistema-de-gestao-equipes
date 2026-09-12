-- A escala passa a pertencer à equipe: sai o cadastro por pessoa, entra a
-- posição ("NOC Diurno 1"), com a pessoa como ocupante opcional da vaga.
--
-- Os dados já cadastrados são preservados: cada cadastro vira uma posição, com
-- o mesmo id — o que deixa o remapeamento das células e dos ajustes ser uma
-- cópia direta de coluna. A posição herda o nome de quem ocupava, que é o
-- rótulo mais reconhecível para quem montou a escala.

CREATE TABLE "escala_posicoes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"equipe_id" varchar(40) NOT NULL,
	"nome" text NOT NULL,
	"funcionario_id" varchar(40),
	"inicio_em" date NOT NULL,
	"ordem" smallint DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escala_posicoes" ADD CONSTRAINT "escala_posicoes_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_posicoes" ADD CONSTRAINT "escala_posicoes_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "escala_posicoes_equipe_idx" ON "escala_posicoes" USING btree ("equipe_id");--> statement-breakpoint

-- Cada cadastro vira uma posição da equipe de quem o ocupava.
INSERT INTO "escala_posicoes" ("id", "equipe_id", "nome", "funcionario_id", "inicio_em", "ordem", "ativo")
SELECT c."id", f."equipe_id", f."nome", c."funcionario_id", c."inicio_em", 0, true
FROM "escala_cadastros" c
JOIN "funcionarios" f ON f."id" = c."funcionario_id";--> statement-breakpoint

-- Células: a coluna nova entra anulável, é preenchida, e só então fica NOT NULL.
ALTER TABLE "escala_celulas" ADD COLUMN "posicao_id" varchar(40);--> statement-breakpoint
UPDATE "escala_celulas" SET "posicao_id" = "cadastro_id"
WHERE EXISTS (SELECT 1 FROM "escala_posicoes" p WHERE p."id" = "escala_celulas"."cadastro_id");--> statement-breakpoint
DELETE FROM "escala_celulas" WHERE "posicao_id" IS NULL;--> statement-breakpoint
ALTER TABLE "escala_celulas" ALTER COLUMN "posicao_id" SET NOT NULL;--> statement-breakpoint

-- Ajustes de dia: o que era da pessoa passa a ser da posição que ela ocupava.
-- Ajuste de quem não tinha cadastro não tem para onde ir e é descartado.
ALTER TABLE "escala_excecoes" ADD COLUMN "posicao_id" varchar(40);--> statement-breakpoint
UPDATE "escala_excecoes" e SET "posicao_id" = p."id"
FROM "escala_posicoes" p WHERE p."funcionario_id" = e."funcionario_id";--> statement-breakpoint
DELETE FROM "escala_excecoes" WHERE "posicao_id" IS NULL;--> statement-breakpoint
ALTER TABLE "escala_excecoes" ALTER COLUMN "posicao_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "escala_celulas" DROP CONSTRAINT IF EXISTS "escala_celulas_cadastro_id_escala_cadastros_id_fk";--> statement-breakpoint
ALTER TABLE "escala_excecoes" DROP CONSTRAINT IF EXISTS "escala_excecoes_funcionario_id_funcionarios_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "escala_celulas_celula_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "escala_excecoes_dia_idx";--> statement-breakpoint
ALTER TABLE "escala_celulas" ADD CONSTRAINT "escala_celulas_posicao_id_escala_posicoes_id_fk" FOREIGN KEY ("posicao_id") REFERENCES "public"."escala_posicoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_excecoes" ADD CONSTRAINT "escala_excecoes_posicao_id_escala_posicoes_id_fk" FOREIGN KEY ("posicao_id") REFERENCES "public"."escala_posicoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escala_celulas_celula_idx" ON "escala_celulas" USING btree ("posicao_id","semana","dia_semana");--> statement-breakpoint
CREATE UNIQUE INDEX "escala_excecoes_dia_idx" ON "escala_excecoes" USING btree ("posicao_id","data");--> statement-breakpoint
ALTER TABLE "escala_celulas" DROP COLUMN "cadastro_id";--> statement-breakpoint
ALTER TABLE "escala_excecoes" DROP COLUMN "funcionario_id";--> statement-breakpoint
DROP TABLE "escala_cadastros" CASCADE;
