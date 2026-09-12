CREATE TABLE "escala_excecoes" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"funcionario_id" varchar(40) NOT NULL,
	"data" date NOT NULL,
	"tipo_turno_id" varchar(40),
	"observacao" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escala_excecoes" ADD CONSTRAINT "escala_excecoes_funcionario_id_funcionarios_id_fk" FOREIGN KEY ("funcionario_id") REFERENCES "public"."funcionarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escala_excecoes" ADD CONSTRAINT "escala_excecoes_tipo_turno_id_tipos_turno_id_fk" FOREIGN KEY ("tipo_turno_id") REFERENCES "public"."tipos_turno"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escala_excecoes_dia_idx" ON "escala_excecoes" USING btree ("funcionario_id","data");