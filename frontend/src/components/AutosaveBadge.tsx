import React from 'react';

interface AutosaveBadgeProps {
  status: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
  lastSavedAt?: string | null;
}

export const AutosaveBadge: React.FC<AutosaveBadgeProps> = ({ status, lastSavedAt }) => {
  if (status === 'IDLE' && !lastSavedAt) return null;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 500 }}>
      {status === 'SAVING' && (
        <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span> Saving...
        </span>
      )}

      {status === 'SAVED' && (
        <span style={{ color: '#22c55e' }}>
          ✓ Saved {lastSavedAt ? `at ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}
        </span>
      )}

      {status === 'ERROR' && (
        <span style={{ color: '#ef4444', fontWeight: 600 }}>
          ⚠️ Save failed — check network
        </span>
      )}

      {status === 'IDLE' && lastSavedAt && (
        <span style={{ color: '#94a3b8' }}>
          Saved at {new Date(lastSavedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};
