-- Persist issued OPD sick-leave certificates and special-meal orders.
CREATE TABLE IF NOT EXISTS clinic_documents (
  id                 VARCHAR(64) PRIMARY KEY,
  document_type      VARCHAR(32) NOT NULL CHECK (document_type IN ('sick-leave', 'special-meal')),
  patient_id         VARCHAR(64) NOT NULL REFERENCES patients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  patient_name       VARCHAR(180) NOT NULL,
  patient_code       VARCHAR(120),
  patient_age        INTEGER CHECK (patient_age IS NULL OR patient_age BETWEEN 0 AND 130),
  patient_gender     VARCHAR(20) CHECK (patient_gender IS NULL OR patient_gender IN ('Male', 'Female')),
  queue_item_id      VARCHAR(64) REFERENCES queue_items(id) ON UPDATE CASCADE ON DELETE SET NULL,
  document_date      DATE NOT NULL,
  treatment_date     DATE NOT NULL,
  diagnosis          TEXT NOT NULL,
  treatment          TEXT NOT NULL,
  date_from          DATE NOT NULL,
  date_to            DATE NOT NULL,
  meal_type          VARCHAR(300),
  physician_name     VARCHAR(180) NOT NULL,
  profession         VARCHAR(120),
  created_by         VARCHAR(64) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_by_name    VARCHAR(180) NOT NULL,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clinic_documents_valid_period CHECK (date_from <= date_to),
  CONSTRAINT clinic_documents_meal_type_required CHECK (
    document_type <> 'special-meal' OR NULLIF(BTRIM(meal_type), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_clinic_documents_patient_issued
  ON clinic_documents (patient_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinic_documents_queue_item
  ON clinic_documents (queue_item_id)
  WHERE queue_item_id IS NOT NULL;
