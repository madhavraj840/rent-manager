CREATE TABLE "app"."meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"meter_id" uuid NOT NULL,
	"tenancy_id" uuid,
	"reading_date" date NOT NULL,
	"value" numeric(14, 3) NOT NULL,
	"reading_type" text DEFAULT 'REGULAR' NOT NULL,
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
CREATE TABLE "app"."meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"serial_number" text,
	"uom" text NOT NULL,
	"rate" numeric(12, 4) DEFAULT '0' NOT NULL,
	"fixed_charge_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD COLUMN "meter_reading_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD COLUMN "previous_reading_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD COLUMN "quantity" numeric(14, 3);--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD COLUMN "rate" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD COLUMN "fixed_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "app"."meter_readings" ADD CONSTRAINT "meter_readings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meter_readings" ADD CONSTRAINT "meter_readings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meter_readings" ADD CONSTRAINT "meter_readings_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "app"."meters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meter_readings" ADD CONSTRAINT "meter_readings_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meters" ADD CONSTRAINT "meters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meters" ADD CONSTRAINT "meters_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."meters" ADD CONSTRAINT "meters_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "app"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "readings_uq" ON "app"."meter_readings" USING btree ("meter_id","reading_date","reading_type") WHERE "app"."meter_readings"."status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "readings_meter_date_ix" ON "app"."meter_readings" USING btree ("meter_id","reading_date");--> statement-breakpoint
CREATE UNIQUE INDEX "meters_label_uq" ON "app"."meters" USING btree ("property_id",coalesce("unit_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("label")) WHERE "app"."meters"."deleted_at" is null;