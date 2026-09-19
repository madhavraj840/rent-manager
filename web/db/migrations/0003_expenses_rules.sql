-- docs/05 §2.18 rules Drizzle cannot express.
CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.expenses FOR EACH ROW EXECUTE FUNCTION app.stamp_version();
--> statement-breakpoint
ALTER TABLE app.expenses
  ADD CONSTRAINT expenses_category_ck CHECK (category IN ('REPAIR','MAINTENANCE','UTILITY','PROPERTY_TAX','INSURANCE','SALARY','COMMISSION','LEGAL','LOAN_INTEREST','OTHER')),
  ADD CONSTRAINT expenses_amount_ck CHECK (amount_minor > 0 AND amount_minor <= 1000000000000000),
  ADD CONSTRAINT expenses_currency_ck CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT expenses_method_ck CHECK (method IS NULL OR method IN ('CASH','BANK_TRANSFER','UPI','CHEQUE','CARD','MOBILE_WALLET','OTHER')),
  ADD CONSTRAINT expenses_status_ck CHECK (status IN ('ACTIVE','VOID')),
  ADD CONSTRAINT expenses_void_reason_ck CHECK (status = 'ACTIVE' OR void_reason IS NOT NULL),
  ADD CONSTRAINT expenses_unit_needs_property_ck CHECK (unit_id IS NULL OR property_id IS NOT NULL);
