import { useEffect, useRef } from 'react';
import { violationApi } from '../services/violationApi';

export const useAntiCheating = (isLive: boolean, onViolationUpdate?: (data: any) => void) => {
  const lastTriggeredRef = useRef<Record<string, number>>({});

  const triggerViolation = async (violationType: string, details?: string) => {
    if (!isLive) return;

    const now = Date.now();
    const lastTime = lastTriggeredRef.current[violationType] || 0;

    // Client-side 1.5s debouncing to prevent event storms
    if (now - lastTime < 1500) {
      return;
    }

    lastTriggeredRef.current[violationType] = now;

    try {
      const res = await violationApi.recordViolation(violationType, details);
      if (onViolationUpdate) {
        onViolationUpdate(res);
      }
    } catch (err) {
      console.error('Failed to report violation to server:', err);
    }
  };

  useEffect(() => {
    if (!isLive) {
      return;
    }

    // 1. Fullscreen Exit Listener
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isLive) {
        triggerViolation('FULLSCREEN_EXIT', 'Fullscreen exited by student');
      }
    };

    // 2. Tab Switch / Visibility Change Listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isLive) {
        triggerViolation('TAB_SWITCH', 'Switched tab or minimized browser window');
      }
    };

    // 3. Window Blur Listener
    const handleWindowBlur = () => {
      if (isLive) {
        triggerViolation('WINDOW_BLUR', 'Focus left competition window');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isLive]);
};
