CREATE TABLE "app"."expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"category" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"expense_date" date NOT NULL,
	"payee" text,
	"method" text,
	"reference" text,
	"note" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"void_reason" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."expenses" ADD CONSTRAINT "expenses_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "app"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_ws_date_ix" ON "app"."expenses" USING btree ("workspace_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_property_date_ix" ON "app"."expenses" USING btree ("property_id","expense_date");