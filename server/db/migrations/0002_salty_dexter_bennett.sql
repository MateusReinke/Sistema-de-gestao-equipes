CREATE TABLE "chaves_api" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"prefixo" varchar(24) NOT NULL,
	"chave_hash" varchar(64) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"criado_por" varchar(40),
	"expira_em" timestamp with time zone,
	"ultimo_uso_em" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chaves_api_hash_idx" ON "chaves_api" USING btree ("chave_hash");