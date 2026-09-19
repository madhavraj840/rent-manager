-- docs/05 §2.16–2.17 rules Drizzle cannot express.
CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.meters FOR EACH ROW EXECUTE FUNCTION app.stamp_version();
--> statement-breakpoint
CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.meter_readings FOR EACH ROW EXECUTE FUNCTION app.stamp_version();
--> statement-breakpoint
ALTER TABLE app.meters
  ADD CONSTRAINT meters_type_ck CHECK (type IN ('ELECTRICITY','WATER','GAS','OTHER')),
  ADD CONSTRAINT meters_label_ck CHECK (char_length(label) BETWEEN 1 AND 40),
  ADD CONSTRAINT meters_uom_ck CHECK (uom IN ('KWH','M3','LITRE','UNIT')),
  ADD CONSTRAINT meters_rate_ck CHECK (rate >= 0 AND rate <= 1000000),
  ADD CONSTRAINT meters_fixed_ck CHECK (fixed_charge_minor >= 0);
--> statement-breakpoint
ALTER TABLE app.meter_readings
  ADD CONSTRAINT readings_value_ck CHECK (value >= 0),
  ADD CONSTRAINT readings_type_ck CHECK (reading_type IN ('MOVE_IN','REGULAR','MOVE_OUT','METER_END','METER_START')),
  ADD CONSTRAINT readings_status_ck CHECK (status IN ('ACTIVE','VOID')),
  ADD CONSTRAINT readings_void_reason_ck CHECK (status = 'ACTIVE' OR void_reason IS NOT NULL);
--> statement-breakpoint
-- The utility snapshot on a charge is part of the money record: append-only like the rest.
CREATE OR REPLACE FUNCTION app.ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.purge', true) = 'on' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'ledger entries cannot be deleted' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.kind, NEW.account, NEW.category, NEW.amount_minor, NEW.currency, NEW.entry_date, NEW.due_date,
      NEW.tenancy_id, NEW.method, NEW.receipt_number, NEW.generated_key, NEW.settlement_id,
      NEW.meter_reading_id, NEW.previous_reading_id, NEW.quantity, NEW.rate, NEW.fixed_amount_minor)
     IS DISTINCT FROM
     (OLD.kind, OLD.account, OLD.category, OLD.amount_minor, OLD.currency, OLD.entry_date, OLD.due_date,
      OLD.tenancy_id, OLD.method, OLD.receipt_number, OLD.generated_key, OLD.settlement_id,
      OLD.meter_reading_id, OLD.previous_reading_id, OLD.quantity, OLD.rate, OLD.fixed_amount_minor)
     OR (OLD.status = 'VOID' AND NEW.status <> 'VOID') THEN
    RAISE EXCEPTION 'ledger entries are append-only; void and re-enter instead' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
