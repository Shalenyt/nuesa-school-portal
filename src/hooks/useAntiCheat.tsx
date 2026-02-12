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

  const logViolation = useCallback(async (type: string, details: Record<string, any> = {}) => {
    if (hasAutoSubmitted.current) return;

    violationCountRef.current += 1;
    setViolations(violationCountRef.current);

    await (supabase as any).from('quiz_violation_logs').insert({
      quiz_id: quizId,
      student_id: studentId,
      violation_type: type,
      details: { ...details, session_id: sessionId.current, timestamp: new Date().toISOString() },
    });

    if (type === 'tab_switch' || type === 'focus_loss') {
      if (violationCountRef.current >= maxViolations) {
        setWarningMessage(`Quiz auto-submitted due to ${maxViolations} violations.`);
        hasAutoSubmitted.current = true;
        onAutoSubmit();
      } else {
        setWarningMessage(
          `Warning: Tab switching detected! (${violationCountRef.current}/${maxViolations}). Your quiz will be auto-submitted after ${maxViolations} violations.`
        );
      }
    }
  }, [quizId, studentId, maxViolations, onAutoSubmit]);

  useEffect(() => {
    // Tab visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        logViolation('tab_switch');
      }
    };

    // Window blur
    const handleBlur = () => {
      logViolation('focus_loss');
    };

    // Copy prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logViolation('copy_attempt');
    };

    // Context menu prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation('copy_attempt', { method: 'context_menu' });
    };

    // Text selection prevention
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Keyboard shortcuts prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P, PrintScreen
      if (
        (e.ctrlKey && ['c', 'u', 's', 'p'].includes(e.key.toLowerCase())) ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')
      ) {
        e.preventDefault();
        logViolation('copy_attempt', { key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey });
      }
    };

    // Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Log device info at start
    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height,
      sessionId: sessionId.current,
    };
    logViolation('quiz_start', deviceInfo);
    // Reset violations since quiz_start shouldn't count
    violationCountRef.current = 0;
    setViolations(0);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
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
