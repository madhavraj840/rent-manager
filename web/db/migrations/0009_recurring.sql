CREATE TABLE "app"."recurring_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."recurring_charges" ADD CONSTRAINT "recurring_charges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recurring_charges" ADD CONSTRAINT "recurring_charges_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."recurring_charges" ADD CONSTRAINT "recurring_charges_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_tenancy_ix" ON "app"."recurring_charges" USING btree ("tenancy_id");