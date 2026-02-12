import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_DURATION = 60 * 1000; // 60 seconds countdown

export function useAutoLogout() {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (!user) return;
    if (showWarning) return; // Don't reset during warning

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);
    }, INACTIVITY_TIMEOUT);
  }, [user, showWarning]);

  const extendSession = useCallback(() => {
    setShowWarning(false);
    setCountdown(60);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    resetTimer();
  }, [resetTimer]);

  // Countdown during warning
  useEffect(() => {
    if (!showWarning) return;

    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          signOut();
          setShowWarning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [showWarning, signOut]);

  // Listen for activity events
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [user, resetTimer]);

  return { showWarning, countdown, extendSession };
}
