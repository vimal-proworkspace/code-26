import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

interface TimerHeaderProps {
  roundName: string;
  roundType: string;
  status: 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
  endTime?: string | null;
  remainingSeconds?: number | null;
  violationCount?: number;
  maximumViolations?: number;
  isSubmitted?: boolean;
}

export const CompetitionTimerHeader: React.FC<TimerHeaderProps> = ({
  roundName,
  roundType,
  status,
  endTime,
  remainingSeconds: initialSeconds,
  violationCount = 0,
  maximumViolations = 3,
  isSubmitted = false,
}) => {
  const { roundState } = useSocket();
  const activeEndTime = roundState?.endTime || endTime;
  const activeStatus = roundState?.status || status;

  const calculateRemaining = (): number => {
    if (activeStatus === 'PAUSED' || activeStatus === 'ENDED') {
      return roundState?.remainingSeconds ?? initialSeconds ?? 0;
    }
    if (!activeEndTime) {
      return roundState?.remainingSeconds ?? initialSeconds ?? 0;
    }
    const endMs = new Date(activeEndTime).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((endMs - nowMs) / 1000));
  };

  const [timeLeftSec, setTimeLeftSec] = useState<number>(calculateRemaining());

  useEffect(() => {
    setTimeLeftSec(calculateRemaining());
    if (activeStatus !== 'LIVE') return;

    const interval = setInterval(() => {
      setTimeLeftSec(calculateRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEndTime, activeStatus, roundState]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  let timerColor = '#38bdf8'; // Cyan default
  let timerBg = 'rgba(56, 189, 248, 0.1)';
  let timerBorder = '#0284c7';
  let isCritical = false;

  if (activeStatus === 'PAUSED') {
    timerColor = '#f59e0b';
    timerBg = 'rgba(245, 158, 11, 0.15)';
    timerBorder = '#f59e0b';
  } else if (timeLeftSec <= 0 || activeStatus === 'ENDED') {
    timerColor = '#94a3b8';
    timerBg = 'rgba(148, 163, 184, 0.15)';
    timerBorder = '#64748b';
  } else if (timeLeftSec < 300) {
    // Under 5 mins
    timerColor = '#ef4444';
    timerBg = 'rgba(239, 68, 68, 0.15)';
    timerBorder = '#ef4444';
    isCritical = true;
  } else if (timeLeftSec < 600) {
    // Under 10 mins
    timerColor = '#f59e0b';
    timerBg = 'rgba(245, 158, 11, 0.15)';
    timerBorder = '#f59e0b';
  }

  return (
    <div
      style={{
        backgroundColor: '#1e293b',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        padding: '1rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Left: Round Title & Meta */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
            {roundName}
          </h2>
          <span style={{ fontSize: '0.75rem', backgroundColor: '#334155', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600 }}>
            {roundType}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>Status: <strong style={{ color: activeStatus === 'LIVE' ? '#22c55e' : activeStatus === 'PAUSED' ? '#f59e0b' : '#94a3b8' }}>{activeStatus}</strong></span>
          {isSubmitted && <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ SUBMITTED</span>}
        </div>
      </div>

      {/* Right: Server Timer & Violation Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {violationCount > 0 && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
            ⚠️ Violations: {violationCount} / {maximumViolations}
          </div>
        )}

        <div
          className={isCritical ? 'pulse-critical' : ''}
          style={{
            backgroundColor: timerBg,
            border: `1.5px solid ${timerBorder}`,
            padding: '0.5rem 1.25rem',
            borderRadius: '0.75rem',
            textAlign: 'center',
            minWidth: '140px',
          }}
        >
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: timerColor, fontWeight: 700, display: 'block' }}>
            {activeStatus === 'PAUSED' ? 'ROUND PAUSED' : timeLeftSec <= 0 ? 'TIME EXPIRED' : 'TIME REMAINING'}
          </span>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: timerColor, fontFamily: 'monospace' }}>
            {timeLeftSec <= 0 && activeStatus !== 'PAUSED' ? '00:00' : formatTime(timeLeftSec)}
          </span>
        </div>
      </div>
    </div>
  );
};
