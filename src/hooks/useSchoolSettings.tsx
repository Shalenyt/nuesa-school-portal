import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SchoolSettings {
  id: string;
  logo_url?: string;
  school_name: string;
}

export function useSchoolSettings() {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('school_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSettings(data || { id: '', school_name: 'OAUSTECH Portal' });
    } catch (error) {
      console.error('Error fetching school settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refetch: fetchSettings };
}