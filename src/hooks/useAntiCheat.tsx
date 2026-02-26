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
  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  // Track if warning is currently being shown - prevent dismissal race conditions
  const warningShown = useRef(false);

  const logViolation = useCallback(async (type: string, details: Record<string, any> = {}) => {
    if (hasAutoSubmitted.current) return;

    const isStrikeViolation = type === 'tab_switch' || type === 'focus_loss';

    if (isStrikeViolation) {
      // Debounce - prevent double counting from rapid visibility + blur events
      const now = Date.now();
      if (now - lastViolationTime.current < 3000) return;
      lastViolationTime.current = now;

      // Don't count new violations while a warning is being shown
      if (warningShown.current) return;

      violationCountRef.current += 1;
      const currentCount = violationCountRef.current;
      setViolations(currentCount);

      // Log to DB
      try {
        await (supabase as any).from('quiz_violation_logs').insert({
          quiz_id: quizId,
          student_id: studentId,
          violation_type: type,
          details: { ...details, session_id: sessionId.current, timestamp: new Date().toISOString(), strike: currentCount },
        });
      } catch {}

      warningShown.current = true;

      if (currentCount >= maxViolations) {
        setWarningMessage(`You have exceeded the maximum number of warnings (${maxViolations}/${maxViolations}). Your quiz is being submitted automatically.`);
        hasAutoSubmitted.current = true;
        // Delay to ensure modal is visible
        setTimeout(() => {
          onAutoSubmitRef.current();
        }, 1500);
      } else {
        const remaining = maxViolations - currentCount;
        setWarningMessage(
          `⚠️ Warning ${currentCount} of ${maxViolations} – You switched away from the quiz. You have ${remaining} warning${remaining > 1 ? 's' : ''} remaining before your quiz is auto-submitted.`
        );
      }
    } else {
      // Non-strike: just log
      try {
        await (supabase as any).from('quiz_violation_logs').insert({
          quiz_id: quizId,
          student_id: studentId,
          violation_type: type,
          details: { ...details, session_id: sessionId.current, timestamp: new Date().toISOString() },
        });
      } catch {}
    }
  }, [quizId, studentId, maxViolations]);

  useEffect(() => {
    // Use both visibilitychange and blur for maximum coverage
    const handleVisibility = () => {
      if (document.hidden) {
        logViolation('tab_switch', { trigger: 'visibilitychange' });
      }
    };

    const handleWindowBlur = () => {
      // Only fire if document isn't already hidden (avoid double-counting)
      if (!document.hidden) {
        logViolation('focus_loss', { trigger: 'window_blur' });
      }
    };

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

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have an active quiz. Leaving will count as a violation.';
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [logViolation]);

  const dismissWarning = useCallback(() => {
    setWarningMessage(null);
    warningShown.current = false;
  }, []);

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
