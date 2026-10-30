-- ============================================================
-- BruClinic Migration 001: Core Clinic Schema (PostgreSQL)
-- ============================================================

-- Keep `updated_at` current on every UPDATE (replaces MySQL's
-- ON UPDATE CURRENT_TIMESTAMP behaviour).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(64) PRIMARY KEY,
  username        VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(180) NOT NULL,
  role            VARCHAR(30) NOT NULL,
  role_title      VARCHAR(180) NOT NULL,
  department      VARCHAR(180) NOT NULL,
  email           VARCHAR(180) NOT NULL UNIQUE,
  avatar_initials VARCHAR(10) NOT NULL,
  badge_color     VARCHAR(20) NOT NULL DEFAULT '#2563eb',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id                      VARCHAR(64) PRIMARY KEY,
  student_id              VARCHAR(80),
  staff_id                VARCHAR(80),
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  gender                  VARCHAR(20) NOT NULL,
  date_of_birth           DATE NOT NULL,
  phone                   VARCHAR(40) NOT NULL,
  email                   VARCHAR(180) NOT NULL DEFAULT '',
  address                 TEXT NOT NULL DEFAULT '',
  patient_type            VARCHAR(30) NOT NULL,
  department              VARCHAR(180),
  blood_group             VARCHAR(5),
  allergies               JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions      JSONB NOT NULL DEFAULT '[]'::jsonb,
  emergency_contact_name  VARCHAR(150) NOT NULL DEFAULT '',
  emergency_contact_phone VARCHAR(40) NOT NULL DEFAULT '',
  registered_at           DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id             VARCHAR(64) PRIMARY KEY,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  specialization VARCHAR(120) NOT NULL,
  email          VARCHAR(180) NOT NULL DEFAULT '',
  phone          VARCHAR(40) NOT NULL DEFAULT '',
  gender         VARCHAR(20) NOT NULL,
  available      BOOLEAN NOT NULL DEFAULT TRUE,
  schedule       JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar         VARCHAR(255),
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id               VARCHAR(64) PRIMARY KEY,
  patient_id       VARCHAR(64) NOT NULL,
  patient_name     VARCHAR(180) NOT NULL,
  doctor_id        VARCHAR(64) NOT NULL,
  doctor_name      VARCHAR(180) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  type             VARCHAR(50) NOT NULL DEFAULT 'General',
  status           VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
  reason           TEXT NOT NULL,
  notes            TEXT,
  priority         VARCHAR(20) NOT NULL DEFAULT 'Medium',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_appointments_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS medical_records (
  id             VARCHAR(64) PRIMARY KEY,
  patient_id     VARCHAR(64) NOT NULL,
  patient_name   VARCHAR(180) NOT NULL,
  doctor_id      VARCHAR(64),
  doctor_name    VARCHAR(180) NOT NULL,
  visit_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  diagnosis      TEXT NOT NULL,
  symptoms       JSONB NOT NULL DEFAULT '[]'::jsonb,
  vitals         JSONB,
  prescription   JSONB NOT NULL DEFAULT '[]'::jsonb,
  lab_tests      JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes          TEXT NOT NULL DEFAULT '',
  follow_up_date DATE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_records_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medicines (
  id             VARCHAR(64) PRIMARY KEY,
  name           VARCHAR(180) NOT NULL,
  category       VARCHAR(100) NOT NULL DEFAULT '',
  stock          INT NOT NULL DEFAULT 0,
  unit           VARCHAR(40) NOT NULL DEFAULT '',
  expiry_date    DATE NOT NULL,
  supplier       VARCHAR(180) NOT NULL DEFAULT '',
  min_stock      INT NOT NULL DEFAULT 0,
  cost_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_items (
  id                     VARCHAR(64) PRIMARY KEY,
  token_number           VARCHAR(30) NOT NULL,
  patient_id             VARCHAR(64) NOT NULL,
  patient_name           VARCHAR(180) NOT NULL,
  patient_type           VARCHAR(30) NOT NULL,
  department             VARCHAR(180),
  registered_time        VARCHAR(20) NOT NULL,
  stage                  VARCHAR(50) NOT NULL,
  priority               VARCHAR(20) NOT NULL DEFAULT 'Normal',
  assigned_doctor_id     VARCHAR(64),
  assigned_doctor_name   VARCHAR(180),
  assigned_opd_room      VARCHAR(120),
  vitals                 JSONB,
  chief_complaint        TEXT NOT NULL,
  card_status            VARCHAR(40),
  has_existing_card      BOOLEAN,
  request_source         VARCHAR(80),
  request_destination    VARCHAR(80),
  request_notes          TEXT,
  allergies              JSONB NOT NULL DEFAULT '[]'::jsonb,
  chronic_conditions     JSONB NOT NULL DEFAULT '[]'::jsonb,
  blood_group            VARCHAR(5),
  lab_order_id           VARCHAR(64),
  lab_test_name          VARCHAR(180),
  lab_category           VARCHAR(80),
  lab_status             VARCHAR(40),
  lab_result             TEXT,
  lab_unit               VARCHAR(40),
  lab_reference_range    VARCHAR(100),
  lab_is_abnormal        BOOLEAN,
  lab_completed_at       VARCHAR(30),
  lab_notes              TEXT,
  pharmacy_order_id      VARCHAR(64),
  prescribed_medicines   JSONB NOT NULL DEFAULT '[]'::jsonb,
  pharmacy_status        VARCHAR(30),
  doctor_diagnosis       TEXT,
  consultation_notes     TEXT,
  completed_at           VARCHAR(30),
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_queue_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_queue_doctor  FOREIGN KEY (assigned_doctor_id) REFERENCES doctors (id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS emergency_cases (
  id               VARCHAR(64) PRIMARY KEY,
  patient_id       VARCHAR(64) NOT NULL,
  patient_name     VARCHAR(180) NOT NULL,
  age              INT NOT NULL,
  gender           VARCHAR(20) NOT NULL,
  arrival_method   VARCHAR(40) NOT NULL,
  arrival_time     VARCHAR(30) NOT NULL,
  acuity           VARCHAR(20) NOT NULL,
  chief_complaint  TEXT NOT NULL,
  bed_number       VARCHAR(120) NOT NULL,
  vitals           JSONB NOT NULL DEFAULT '{}'::jsonb,
  attending_doctor VARCHAR(180) NOT NULL,
  status           VARCHAR(40) NOT NULL DEFAULT 'In Treatment',
  critical_notes   TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emergency_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id              VARCHAR(64) PRIMARY KEY,
  patient_id      VARCHAR(64) NOT NULL,
  patient_name    VARCHAR(180) NOT NULL,
  doctor_id       VARCHAR(64),
  doctor_name     VARCHAR(180) NOT NULL,
  ordered_at      VARCHAR(30) NOT NULL,
  priority        VARCHAR(20) NOT NULL DEFAULT 'Medium',
  test_name       VARCHAR(180) NOT NULL,
  category        VARCHAR(80) NOT NULL,
  specimen_type   VARCHAR(100) NOT NULL,
  status          VARCHAR(40) NOT NULL DEFAULT 'Requested',
  result          TEXT,
  unit            VARCHAR(40),
  reference_range VARCHAR(100),
  is_abnormal     BOOLEAN,
  notes           TEXT,
  completed_at    VARCHAR(30),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_lab_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_orders (
  id            VARCHAR(64) PRIMARY KEY,
  patient_id    VARCHAR(64) NOT NULL,
  patient_name  VARCHAR(180) NOT NULL,
  doctor_id     VARCHAR(64),
  doctor_name   VARCHAR(180) NOT NULL,
  prescribed_at VARCHAR(30) NOT NULL,
  medicines     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
  dispensed_at  VARCHAR(30),
  dispensed_by  VARCHAR(180),
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pharmacy_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_pharmacy_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_records_patient ON medical_records (patient_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_queue_stage ON queue_items (stage, priority);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_cases (status, acuity);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders (status, priority);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_status ON pharmacy_orders (status);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_doctors_updated_at ON doctors;
CREATE TRIGGER trg_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_records_updated_at ON medical_records;
CREATE TRIGGER trg_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medicines_updated_at ON medicines;
CREATE TRIGGER trg_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_queue_updated_at ON queue_items;
CREATE TRIGGER trg_queue_updated_at BEFORE UPDATE ON queue_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_emergency_updated_at ON emergency_cases;
CREATE TRIGGER trg_emergency_updated_at BEFORE UPDATE ON emergency_cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lab_orders_updated_at ON lab_orders;
CREATE TRIGGER trg_lab_orders_updated_at BEFORE UPDATE ON lab_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pharmacy_orders_updated_at ON pharmacy_orders;
CREATE TRIGGER trg_pharmacy_orders_updated_at BEFORE UPDATE ON pharmacy_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
