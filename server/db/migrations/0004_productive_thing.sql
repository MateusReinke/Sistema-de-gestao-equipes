ALTER TYPE "public"."tipo_plantao" ADD VALUE 'backup' BEFORE 'especial';--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "turno_tipo" "tipo_plantao" DEFAULT 'comercial' NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "turno_inicio" time DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "turno_fim" time DEFAULT '17:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "sobreaviso_inicio" time DEFAULT '00:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "escalas" ADD COLUMN "sobreaviso_fim" time DEFAULT '23:59' NOT NULL;