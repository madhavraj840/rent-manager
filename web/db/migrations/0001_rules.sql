-- Rules from docs/05_DATABASE_DESIGN.md §1.2 and §2 that Drizzle cannot express.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
CREATE FUNCTION app.stamp_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := current_setting('app.change_seq')::bigint;  -- raises if unset: every write goes through a command
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workspaces','memberships','properties','units','tenants','tenancies','tenancy_parties','rent_revisions','settlements','ledger_entries'] LOOP
    EXECUTE format('CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.stamp_version()', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Money rows are append-only: only note/reference/duplicate flag and ACTIVE -> VOID may change.
CREATE FUNCTION app.ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.purge', true) = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'ledger entries cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.kind, NEW.account, NEW.category, NEW.amount_minor, NEW.currency, NEW.entry_date, NEW.due_date,
      NEW.tenancy_id, NEW.method, NEW.receipt_number, NEW.generated_key, NEW.settlement_id)
     IS DISTINCT FROM
     (OLD.kind, OLD.account, OLD.category, OLD.amount_minor, OLD.currency, OLD.entry_date, OLD.due_date,
      OLD.tenancy_id, OLD.method, OLD.receipt_number, OLD.generated_key, OLD.settlement_id)
     OR (OLD.status = 'VOID' AND NEW.status <> 'VOID') THEN
    RAISE EXCEPTION 'ledger entries are append-only; void and re-enter instead' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER ledger_guard BEFORE UPDATE OR DELETE ON app.ledger_entries FOR EACH ROW EXECUTE FUNCTION app.ledger_guard();
--> statement-breakpoint
CREATE FUNCTION app.append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.purge', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'P0001';
END $$;
--> statement-breakpoint
CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON app.audit_events FOR EACH ROW EXECUTE FUNCTION app.append_only();
--> statement-breakpoint
ALTER TABLE app.workspaces
  ADD CONSTRAINT workspaces_name_ck CHECK (char_length(name) BETWEEN 2 AND 80),
  ADD CONSTRAINT workspaces_country_ck CHECK (country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT workspaces_currency_ck CHECK (default_currency ~ '^[A-Z]{3}$');
--> statement-breakpoint
ALTER TABLE app.memberships
  ADD CONSTRAINT memberships_role_ck CHECK (role IN ('OWNER','ADMIN','MANAGER','VIEWER','STAFF')),
  ADD CONSTRAINT memberships_status_ck CHECK (status IN ('INVITED','ACTIVE','REVOKED'));
--> statement-breakpoint
ALTER TABLE app.properties
  ADD CONSTRAINT properties_name_ck CHECK (char_length(name) BETWEEN 1 AND 100),
  ADD CONSTRAINT properties_type_ck CHECK (type IN ('RESIDENTIAL_BUILDING','INDEPENDENT_HOUSE','APARTMENT','PG_HOSTEL','COMMERCIAL','MIXED_USE','LAND','OTHER')),
  ADD CONSTRAINT properties_currency_ck CHECK (currency ~ '^[A-Z]{3}$');
--> statement-breakpoint
ALTER TABLE app.units
  ADD CONSTRAINT units_label_ck CHECK (char_length(label) BETWEEN 1 AND 40),
  ADD CONSTRAINT units_type_ck CHECK (type IN ('FLAT','HOUSE','ROOM','BED','SHOP','OFFICE','WAREHOUSE','PARKING','OTHER')),
  ADD CONSTRAINT units_rent_ck CHECK (default_rent_minor IS NULL OR default_rent_minor >= 0),
  ADD CONSTRAINT units_deposit_ck CHECK (default_deposit_minor IS NULL OR default_deposit_minor >= 0);
--> statement-breakpoint
ALTER TABLE app.tenants
  ADD CONSTRAINT tenants_name_ck CHECK (char_length(full_name) BETWEEN 1 AND 120),
  ADD CONSTRAINT tenants_kind_ck CHECK (kind IN ('INDIVIDUAL','COMPANY')),
  ADD CONSTRAINT tenants_id_last4_ck CHECK (id_last4 IS NULL OR char_length(id_last4) <= 4);
--> statement-breakpoint
ALTER TABLE app.tenancies
  ADD CONSTRAINT tenancies_status_ck CHECK (status IN ('ACTIVE','ENDED','CLOSED','CANCELLED')),
  ADD CONSTRAINT tenancies_cycle_ck CHECK (cycle_day BETWEEN 1 AND 28),
  ADD CONSTRAINT tenancies_grace_ck CHECK (grace_days BETWEEN 0 AND 60),
  ADD CONSTRAINT tenancies_billing_ck CHECK (billing_start_date >= start_date),
  ADD CONSTRAINT tenancies_lease_ck CHECK (lease_end_date IS NULL OR lease_end_date > start_date),
  ADD CONSTRAINT tenancies_moveout_ck CHECK (moved_out_on IS NULL OR moved_out_on >= start_date),
  ADD CONSTRAINT tenancies_deposit_ck CHECK (deposit_agreed_minor >= 0),
  ADD COLUMN occupancy daterange GENERATED ALWAYS AS (daterange(start_date, COALESCE(moved_out_on, planned_move_out_date), '[]')) STORED;
--> statement-breakpoint
-- BR-005: one tenancy per unit at a time.
ALTER TABLE app.tenancies ADD CONSTRAINT tenancies_no_overlap
  EXCLUDE USING gist (unit_id WITH =, occupancy WITH &&) WHERE (status <> 'CANCELLED' AND deleted_at IS NULL);
--> statement-breakpoint
ALTER TABLE app.tenancy_parties
  ADD CONSTRAINT parties_role_ck CHECK (role IN ('PRIMARY','CO_TENANT','OCCUPANT'));
--> statement-breakpoint
CREATE UNIQUE INDEX parties_one_primary_uq ON app.tenancy_parties (tenancy_id)
  WHERE role = 'PRIMARY' AND left_on IS NULL AND deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE app.rent_revisions ADD CONSTRAINT revisions_rent_ck CHECK (rent_minor > 0);
--> statement-breakpoint
-- Allowed combinations: docs/10_FINANCIAL_RULES.md §2.1
ALTER TABLE app.ledger_entries
  ADD CONSTRAINT ledger_amount_ck CHECK (amount_minor > 0 AND amount_minor <= 1000000000000000),
  ADD CONSTRAINT ledger_status_ck CHECK (status IN ('ACTIVE','VOID')),
  ADD CONSTRAINT ledger_void_reason_ck CHECK (status = 'ACTIVE' OR void_reason IS NOT NULL),
  ADD CONSTRAINT ledger_due_ck CHECK (kind <> 'CHARGE' OR due_date IS NOT NULL),
  ADD CONSTRAINT ledger_method_ck CHECK (kind NOT IN ('PAYMENT','REFUND') OR method IS NOT NULL),
  ADD CONSTRAINT ledger_source_ck CHECK (source IN ('MANUAL','AUTO','MOVE_IN','SETTLEMENT','OPENING','REVISION')),
  ADD CONSTRAINT ledger_combo_ck CHECK (
    (kind = 'CHARGE' AND account = 'RENT' AND category IN ('RENT','UTILITY','LATE_FEE','MAINTENANCE','PARKING','DAMAGE','CLEANING','TAX','OPENING_BALANCE','OTHER'))
    OR (kind = 'CHARGE' AND account = 'DEPOSIT' AND category = 'DEPOSIT')
    OR (kind = 'PAYMENT' AND account = 'RENT' AND method IN ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','MOBILE_WALLET','OTHER','INTERNAL_TRANSFER'))
    OR (kind = 'PAYMENT' AND account = 'DEPOSIT' AND method IN ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','MOBILE_WALLET','OTHER','OPENING_BALANCE','INTERNAL_TRANSFER'))
    OR (kind = 'CREDIT' AND account = 'RENT' AND category IN ('DISCOUNT','WAIVER','PRORATION','ADJUSTMENT','WRITE_OFF','OPENING_ADVANCE'))
    OR (kind = 'CREDIT' AND account = 'DEPOSIT' AND category = 'ADJUSTMENT')
    OR (kind = 'REFUND' AND method IN ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','MOBILE_WALLET','OTHER','INTERNAL_TRANSFER'))
    OR (kind = 'DEPOSIT_APPLIED' AND account = 'RENT')
  );
