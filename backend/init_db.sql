-- Initialize PostgreSQL with pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum types
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('patient', 'doctor', 'hospital_manager', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE record_status AS ENUM ('pending', 'processing', 'processed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE file_type AS ENUM ('pdf', 'image', 'report', 'dicom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_patients_medical_id ON patients(medical_id);
CREATE INDEX IF NOT EXISTS idx_records_patient_id ON records(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON access_logs(timestamp DESC);

-- Enable Row Level Security (optional - implement as needed)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE records ENABLE ROW LEVEL SECURITY;
