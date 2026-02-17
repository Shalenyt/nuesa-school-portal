import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AntiCheatOptions {
  quizId: string;
  studentId: string;
  maxViolations?: number;
  onAutoSubmit: () => void;
}

export function useAntiCheat({ quizId, studentId, maxViolations = 3, onAutoSubmit }: AntiCheatOptions) {
  const [violations, setViolations] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const violationCountRef = useRef(0);
  const hasAutoSubmitted = useRef(false);
  const sessionId = useRef(crypto.randomUUID());
  const lastViolationTime = useRef(0);

  const logViolation = useCallback(async (type: string, details: Record<string, any> = {}) => {
    if (hasAutoSubmitted.current) return;

    const isStrikeViolation = type === 'tab_switch' || type === 'focus_loss';

    // Debounce strike violations - prevent double counting from blur+visibility firing together
    if (isStrikeViolation) {
      const now = Date.now();
      if (now - lastViolationTime.current < 1000) return; // ignore if within 1s of last strike
      lastViolationTime.current = now;

      violationCountRef.current += 1;
      setViolations(violationCountRef.current);
    }

    await (supabase as any).from('quiz_violation_logs').insert({
      quiz_id: quizId,
      student_id: studentId,
      violation_type: type,
      details: { ...details, session_id: sessionId.current, timestamp: new Date().toISOString() },
    });

    if (isStrikeViolation) {
      if (violationCountRef.current >= maxViolations) {
        setWarningMessage(`You have exceeded the maximum number of warnings. Your quiz has been submitted.`);
        hasAutoSubmitted.current = true;
        onAutoSubmit();
      } else {
        const remaining = maxViolations - violationCountRef.current;
        setWarningMessage(
          `Warning ${violationCountRef.current}/${maxViolations} – You have ${remaining} warning${remaining > 1 ? 's' : ''} remaining.`
        );
      }
    }
  }, [quizId, studentId, maxViolations, onAutoSubmit]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        logViolation('tab_switch');
      }
    };

    // Only use visibilitychange - blur fires too aggressively and causes double counts
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_attempt');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('copy_attempt', { method: 'context_menu' });
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ['c', 'u', 's', 'p'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')
      ) {
        e.preventDefault();
        logViolation('copy_attempt', { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Log device info at start (non-strike)
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      sessionId: sessionId.current,
    };
    logViolation('quiz_start', deviceInfo);
    // Reset since quiz_start is not a strike
    violationCountRef.current = 0;
    setViolations(0);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [logViolation]);

  const dismissWarning = () => setWarningMessage(null);

  const requestFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const getDeviceFingerprint = useCallback(() => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sessionId: sessionId.current,
  }), []);

  return {
    violations,
    warningMessage,
    dismissWarning,
    requestFullscreen,
    getDeviceFingerprint,
    logViolation,
  };
}
