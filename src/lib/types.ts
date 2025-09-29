export type UserRole = 'patient' | 'doctor' | 'hospital_manager' | 'admin';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  user_id: string;
  medical_id: string;
  date_of_birth: string;
  gender: string;
  blood_type: string | null;
  emergency_contact: string | null;
  address: string | null;
}

export interface Doctor {
  id: string;
  user_id: string;
  license_number: string;
  specialization: string;
  qualification: string;
  experience_years: number | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface HospitalManager {
  id: string;
  user_id: string;
  hospital_name: string;
  department: string | null;
  created_by: string;
}

export interface Record {
  id: string;
  patient_id: string;
  title: string;
  file_type: string;
  file_url: string;
  uploaded_by: string;
  upload_date: string;
  status: string;
}

// Ashmit contribution
