import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SchoolSettings {
  id: string;
  logo_url?: string;
  school_name: string;
  portal_name?: string;
  theme_color?: string;
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
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      } else if (data) {
        setSettings(data);
      } else {
        setSettings({ 
          id: '', 
          school_name: 'OAUSTECH Portal',
          portal_name: 'OAUSTECH Portal',
          theme_color: '#ef4444'
        });
      }
    } catch (error) {
      console.error('Error fetching school settings:', error);
      setSettings({ 
        id: '', 
        school_name: 'OAUSTECH Portal',
        portal_name: 'OAUSTECH Portal',
        theme_color: '#ef4444'
      });
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refetch: fetchSettings };
}
