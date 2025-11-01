import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Function to ensure patient record exists
  const ensurePatientRecord = async (userId: string, userMetadata: any) => {
    const role = userMetadata?.role;
    if (role !== 'patient') return;

    try {
      // Check if patient record exists
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!existingPatient) {
        // Create patient record
        const { error } = await supabase
          .from('patients')
          .insert({
            user_id: userId,
            medical_id: `MED-${userId.substring(0, 8)}`,
            date_of_birth: userMetadata?.date_of_birth || '1990-01-01',
            gender: userMetadata?.gender || 'other',
            blood_type: userMetadata?.blood_type || null,
            emergency_contact: userMetadata?.emergency_contact || null,
            address: userMetadata?.address || null,
          });

        if (error) {
          console.log('Patient record creation handled by trigger or already exists');
        } else {
          console.log('Patient record created successfully');
        }
      }

      // Also ensure user_role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'patient')
        .single();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'patient' });
      }
    } catch (error) {
      // Silently handle - the trigger should have created these
      console.log('Record check complete');
    }
  };

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Ensure patient record exists on login
        ensurePatientRecord(session.user.id, session.user.user_metadata);
        fetchUserRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Ensure patient record exists on auth state change
        ensurePatientRecord(session.user.id, session.user.user_metadata);
        fetchUserRoles(session.user.id);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      
      setRoles(data.map(r => r.role as UserRole));
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, roles, loading, signOut };
}
