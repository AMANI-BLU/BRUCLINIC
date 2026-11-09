-- ============================================================
-- BruClinic Migration 005: Medicine images & pharmacist attribution
-- ============================================================

-- Photograph of the medicine box/bottle uploaded by the pharmacist.
-- Stored as an inline (base64) data URL so the JSON API stays dependency-free.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Which staff member added this medicine to the catalogue.
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS added_by VARCHAR(180) NOT NULL DEFAULT '';
