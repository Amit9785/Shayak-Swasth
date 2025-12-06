import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Patient {
  id: string;
  medical_id: string;
  date_of_birth: string;
  gender: string;
  user_id: string;
  blood_type?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    phone?: string;
  };
}

interface PatientSearchProps {
  onSelectPatient: (patient: Patient) => void;
}

export function PatientSearch({ onSelectPatient }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load all patients on mount
  useEffect(() => {
    fetchAllPatients();
  }, []);

  const fetchAllPatients = async () => {
    setSearching(true);
    setError(null);
    try {
      console.log('Fetching patients...');
      
      // Get all patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .limit(50);

      console.log('Patients response:', { patientsData, patientsError });

      if (patientsError) {
        console.error('Error fetching patients:', patientsError);
        setError(`Unable to load patients: ${patientsError.message}. Please check your permissions.`);
        throw patientsError;
      }

      if (!patientsData || patientsData.length === 0) {
        console.log('No patients found in database');
        setResults([]);
        setError('No patients found. This could mean: 1) No patients exist yet, or 2) You don\'t have permission to view patients.');
        return;
      }

      // Get profiles for these patients (may fail due to RLS, so handle gracefully)
      const userIds = patientsData.map(p => p.user_id);
      let profilesData: any[] = [];
      
      try {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone')
          .in('id', userIds);

        console.log('Profiles query result:', { data, profilesError });

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }
        
        if (data) {
          profilesData = data;
          console.log('Profiles data with phone:', profilesData.map(p => ({ id: p.id, phone: p.phone })));
        }
      } catch (profileErr) {
        // Profiles may be restricted by RLS - continue without them
        console.error('Could not fetch profiles (RLS restriction):', profileErr);
      }

      // Merge patients with their profiles (if available)
      const patientsWithProfiles = patientsData.map(patient => ({
        ...patient,
        profiles: profilesData?.find(p => p.id === patient.user_id) || null
      }));

      // Sort alphabetically by name or medical_id
      const sortedData = patientsWithProfiles.sort((a, b) => {
        const aName = a.profiles 
          ? `${a.profiles.last_name || ''} ${a.profiles.first_name || ''}`.toLowerCase()
          : a.medical_id.toLowerCase();
        const bName = b.profiles 
          ? `${b.profiles.last_name || ''} ${b.profiles.first_name || ''}`.toLowerCase()
          : b.medical_id.toLowerCase();
        return aName.localeCompare(bName);
      });

      setResults(sortedData);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      fetchAllPatients();
      return;
    }

    setSearching(true);
    setError(null);
    try {
      // Search patients by medical_id
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .ilike('medical_id', `%${query}%`)
        .limit(10);

      if (patientsError) throw patientsError;

      if (!patientsData || patientsData.length === 0) {
        setResults([]);
        toast({
          title: 'No results',
          description: 'No patients found matching your search',
        });
        return;
      }

      // Get profiles for these patients (handle RLS gracefully)
      const userIds = patientsData.map(p => p.user_id);
      let profilesData: any[] = [];
      
      try {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone')
          .in('id', userIds);

        if (!profilesError && data) {
          profilesData = data;
        }
      } catch (profileErr) {
        console.log('Could not fetch profiles (RLS restriction):', profileErr);
      }

      // Merge patients with their profiles
      const patientsWithProfiles = patientsData.map(patient => ({
        ...patient,
        profiles: profilesData?.find(p => p.id === patient.user_id) || null
      }));

      // Sort alphabetically by name or medical_id
      const sortedData = patientsWithProfiles.sort((a, b) => {
        const aName = a.profiles 
          ? `${a.profiles.last_name || ''} ${a.profiles.first_name || ''}`.toLowerCase()
          : a.medical_id.toLowerCase();
        const bName = b.profiles 
          ? `${b.profiles.last_name || ''} ${b.profiles.first_name || ''}`.toLowerCase()
          : b.medical_id.toLowerCase();
        return aName.localeCompare(bName);
      });

      setResults(sortedData);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to search patients',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by Medical ID or name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading state */}
      {searching && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading patients...
        </div>
      )}

      {/* Results count */}
      {!searching && results.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {results.length} patient{results.length !== 1 ? 's' : ''} found
        </div>
      )}

      {!searching && results.length > 0 && (
        <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
          {results.map((patient) => (
            <button
              key={patient.id}
              onClick={() => {
                onSelectPatient(patient);
                setResults([]);
                setQuery('');
              }}
              className="w-full p-4 text-left hover:bg-accent transition-colors flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">
                  {patient.profiles?.first_name?.charAt(0) || patient.medical_id.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {patient.profiles?.first_name && patient.profiles?.last_name
                    ? `${patient.profiles.first_name} ${patient.profiles.last_name}`
                    : `Patient ${patient.medical_id}`}
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{patient.medical_id}</span>
                  <span className="capitalize">{patient.gender}</span>
                  <span>Born: {new Date(patient.date_of_birth).toLocaleDateString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!searching && !error && results.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No patients found</p>
          <p className="text-sm">Try searching by Medical ID</p>
        </div>
      )}
    </div>
  );
}