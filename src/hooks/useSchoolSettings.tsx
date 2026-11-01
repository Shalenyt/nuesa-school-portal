import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SchoolSettings {
  id: string;
  logo_url?: string;
  school_name: string;
  portal_name?: string;
  theme_color?: string;
  institution_name?: string;
  faculty_name?: string;
  organization_name?: string;
}


const DEFAULT_SETTINGS: SchoolSettings = {
  id: '',
  school_name: 'NUESA Portal',
  portal_name: 'NUESA Portal',
  theme_color: '#16a34a'
};

// One shared request for the whole app. Several parts of each page used to
// fetch the same settings row separately (three times on the home page).
let sharedRequest: Promise<SchoolSettings> | null = null;

function loadSettings(force = false): Promise<SchoolSettings> {
  if (!sharedRequest || force) {
    sharedRequest = (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('school_settings')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return (data as SchoolSettings) || DEFAULT_SETTINGS;
      } catch (error) {
        console.error('Error fetching school settings:', error);
        sharedRequest = null; // try again next time
        return DEFAULT_SETTINGS;
      }
    })();
  }
  return sharedRequest;
}

export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  // Pass true to skip the shared copy (e.g. after the logo is changed)
  const fetchSettings = async (force = false) => {
    const data = await loadSettings(force === true);
    setSettings(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!loading) setReady(true);
  }, [loading]);

  return { settings, loading, ready, refetch: () => fetchSettings(true) };
}
