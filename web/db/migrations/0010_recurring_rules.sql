-- Rules for repeating monthly charges (F-MONEY-10) that Drizzle cannot express.
CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.recurring_charges FOR EACH ROW EXECUTE FUNCTION app.stamp_version();
--> statement-breakpoint
ALTER TABLE app.recurring_charges
  ADD CONSTRAINT recurring_category_ck CHECK (category IN ('MAINTENANCE','PARKING','UTILITY','TAX','OTHER')),
  ADD CONSTRAINT recurring_description_ck CHECK (char_length(description) BETWEEN 1 AND 120),
  ADD CONSTRAINT recurring_amount_ck CHECK (amount_minor > 0 AND amount_minor <= 1000000000000000),
  ADD CONSTRAINT recurring_dates_ck CHECK (end_on IS NULL OR end_on >= start_on);
--> statement-breakpoint
ALTER TABLE app.recurring_charges ENABLE ROW LEVEL SECURITY;
