import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePushNotifications() {
  const { profile } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('Notification' in window && 'serviceWorker' in navigator);
  }, []);

  const requestPermission = async () => {
    if (!supported || !profile) return false;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await subscribeToNotifications();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Push] Permission request failed:', err);
      return false;
    }
  };

  const subscribeToNotifications = async () => {
    if (!profile) return;
    
    try {
      // For now, we use basic Notification API (not full Push API which requires a push server)
      // Store that the user has granted permission
      console.log('[Push] Notifications enabled for user:', profile.id);
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
    }
  };

  const showNotification = (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') return;
    
    try {
      const notification = new Notification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options?.data?.url) {
          window.location.href = options.data.url;
        }
      };
    } catch (err) {
      console.error('[Push] Show notification failed:', err);
    }
  };

  // Listen for real-time notifications and show browser notifications
  useEffect(() => {
    if (!profile || permission !== 'granted') return;

    const channel = supabase
      .channel('push-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, (payload: any) => {
        const n = payload.new;
        showNotification(n.title, {
          body: n.message,
          tag: n.id,
          data: { url: getNotificationUrl(n.type) },
        });
      })
      .subscribe();

    // Also listen for new announcements
    const announcementChannel = supabase
      .channel('push-announcements')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements',
      }, (payload: any) => {
        const a = payload.new;
        showNotification(`New Announcement: ${a.title}`, {
          body: a.content?.substring(0, 100) || '',
          tag: `announcement-${a.id}`,
          data: { url: getNotificationUrl('announcement') },
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(announcementChannel);
    };
  }, [profile, permission]);

  return { permission, supported, requestPermission, showNotification };
}

function getNotificationUrl(type: string): string {
  const role = window.location.pathname.split('/')[1] || 'student';
  switch (type) {
    case 'quiz': return `/${role}/quizzes`;
    case 'assignment': return `/${role}/submit-assignment`;
    case 'attendance': return `/${role}/attendance`;
    case 'grade': return `/${role}/view-results`;
    case 'announcement': return `/${role}/notifications`;
    default: return `/${role}/notifications`;
  }
}
