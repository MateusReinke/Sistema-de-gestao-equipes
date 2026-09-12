CREATE TYPE "public"."escopo_chave_api" AS ENUM('leitura', 'escrita');--> statement-breakpoint
ALTER TABLE "chaves_api" ADD COLUMN "usuario_id" varchar(40);--> statement-breakpoint
ALTER TABLE "chaves_api" ADD COLUMN "escopo" "escopo_chave_api" DEFAULT 'leitura' NOT NULL;--> statement-breakpoint
ALTER TABLE "chaves_api" ADD CONSTRAINT "chaves_api_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chaves_api_usuario_idx" ON "chaves_api" USING btree ("usuario_id");