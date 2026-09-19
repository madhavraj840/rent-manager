-- docs/05 §2.19 rules Drizzle cannot express.
CREATE TRIGGER stamp_version BEFORE INSERT OR UPDATE ON app.documents FOR EACH ROW EXECUTE FUNCTION app.stamp_version();
--> statement-breakpoint
ALTER TABLE app.documents
  ADD CONSTRAINT documents_entity_ck CHECK (entity_type IN ('WORKSPACE','PROPERTY','UNIT','TENANT','TENANCY','LEDGER_ENTRY','EXPENSE','METER_READING','INSPECTION','INSPECTION_ITEM')),
  ADD CONSTRAINT documents_category_ck CHECK (category IN ('AGREEMENT','ID_PROOF','ADDRESS_PROOF','POLICE_VERIFICATION','PAYMENT_PROOF','BILL','PHOTO','PAYMENT_QR','OTHER')),
  ADD CONSTRAINT documents_mime_ck CHECK (mime_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  ADD CONSTRAINT documents_size_ck CHECK (size_bytes BETWEEN 1 AND 10485760),
  ADD CONSTRAINT documents_sensitive_ck CHECK (sensitive OR category NOT IN ('ID_PROOF','ADDRESS_PROOF','POLICE_VERIFICATION')),
  ADD CONSTRAINT documents_status_ck CHECK (upload_status IN ('PENDING','UPLOADED'));
--> statement-breakpoint
CREATE INDEX documents_deleted_ix ON app.documents (workspace_id) WHERE deleted_at IS NOT NULL;
