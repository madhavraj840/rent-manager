CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"source" text DEFAULT 'WEB' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"changes" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"account" text NOT NULL,
	"category" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"entry_date" date NOT NULL,
	"due_date" date,
	"period_start" date,
	"period_end" date,
	"description" text,
	"method" text,
	"reference" text,
	"note" text,
	"receipt_number" text,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"generated_key" text,
	"settlement_id" uuid,
	"related_entry_id" uuid,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"possible_duplicate_of" uuid,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"role" text NOT NULL,
	"all_properties" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'INVITED' NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country_code" text NOT NULL,
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
CREATE TABLE "app"."rent_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"rent_minor" bigint NOT NULL,
	"reason" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"status" text DEFAULT 'FINAL' NOT NULL,
	"moved_out_on" date NOT NULL,
	"deposit_applied_minor" bigint DEFAULT 0 NOT NULL,
	"refund_due_minor" bigint DEFAULT 0 NOT NULL,
	"amount_owed_minor" bigint DEFAULT 0 NOT NULL,
	"finalized_at" timestamp with time zone,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."tenancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"currency" text NOT NULL,
	"start_date" date NOT NULL,
	"billing_start_date" date NOT NULL,
	"lease_end_date" date,
	"cycle_day" smallint DEFAULT 1 NOT NULL,
	"grace_days" smallint DEFAULT 4 NOT NULL,
	"notice_period_days" smallint,
	"deposit_agreed_minor" bigint DEFAULT 0 NOT NULL,
	"notice_given_on" date,
	"notice_given_by" text,
	"planned_move_out_date" date,
	"moved_out_on" date,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"notes" text,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."tenancy_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_on" date,
	"left_on" date,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"alt_phone" text,
	"email" text,
	"address" text,
	"emergency_name" text,
	"emergency_phone" text,
	"id_type" text,
	"id_last4" text,
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
CREATE TABLE "app"."units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"floor_label" text,
	"default_rent_minor" bigint,
	"default_deposit_minor" bigint,
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
CREATE TABLE "app"."workspace_counters" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"change_seq" bigint DEFAULT 0 NOT NULL,
	"receipt_seq" bigint DEFAULT 0 NOT NULL,
	"purge_floor" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"default_currency" text NOT NULL,
	"time_zone" text NOT NULL,
	"round_to_whole_units" boolean DEFAULT true NOT NULL,
	"receipt_prefix" text DEFAULT 'R-' NOT NULL,
	"payment_instructions" jsonb,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD CONSTRAINT "ledger_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD CONSTRAINT "ledger_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD CONSTRAINT "ledger_entries_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."ledger_entries" ADD CONSTRAINT "ledger_entries_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "app"."settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."memberships" ADD CONSTRAINT "memberships_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."properties" ADD CONSTRAINT "properties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rent_revisions" ADD CONSTRAINT "rent_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rent_revisions" ADD CONSTRAINT "rent_revisions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."rent_revisions" ADD CONSTRAINT "rent_revisions_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."settlements" ADD CONSTRAINT "settlements_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."settlements" ADD CONSTRAINT "settlements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."settlements" ADD CONSTRAINT "settlements_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancies" ADD CONSTRAINT "tenancies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancies" ADD CONSTRAINT "tenancies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancies" ADD CONSTRAINT "tenancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "app"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancy_parties" ADD CONSTRAINT "tenancy_parties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancy_parties" ADD CONSTRAINT "tenancy_parties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancy_parties" ADD CONSTRAINT "tenancy_parties_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "app"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenancy_parties" ADD CONSTRAINT "tenancy_parties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "app"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."tenants" ADD CONSTRAINT "tenants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."units" ADD CONSTRAINT "units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "app"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."workspace_counters" ADD CONSTRAINT "workspace_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "app"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_ws_at_ix" ON "app"."audit_events" USING btree ("workspace_id","at");--> statement-breakpoint
CREATE INDEX "ledger_balance_ix" ON "app"."ledger_entries" USING btree ("tenancy_id","account","status");--> statement-breakpoint
CREATE INDEX "ledger_reports_ix" ON "app"."ledger_entries" USING btree ("workspace_id","kind","entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_receipt_uq" ON "app"."ledger_entries" USING btree ("workspace_id","receipt_number") WHERE "app"."ledger_entries"."receipt_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_generated_uq" ON "app"."ledger_entries" USING btree ("generated_key") WHERE "app"."ledger_entries"."generated_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_name_uq" ON "app"."properties" USING btree ("workspace_id",lower("name")) WHERE "app"."properties"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "properties_ws_version_ix" ON "app"."properties" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "revisions_uq" ON "app"."rent_revisions" USING btree ("tenancy_id","effective_from") WHERE "app"."rent_revisions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tenancies_unit_ix" ON "app"."tenancies" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "tenancies_status_ix" ON "app"."tenancies" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "tenancies_ws_version_ix" ON "app"."tenancies" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "parties_uq" ON "app"."tenancy_parties" USING btree ("tenancy_id","tenant_id") WHERE "app"."tenancy_parties"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "parties_tenant_ix" ON "app"."tenancy_parties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenants_phone_ix" ON "app"."tenants" USING btree ("workspace_id","phone");--> statement-breakpoint
CREATE INDEX "tenants_ws_version_ix" ON "app"."tenants" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "units_label_uq" ON "app"."units" USING btree ("property_id",lower("label")) WHERE "app"."units"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "units_property_ix" ON "app"."units" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "units_ws_version_ix" ON "app"."units" USING btree ("workspace_id","version");