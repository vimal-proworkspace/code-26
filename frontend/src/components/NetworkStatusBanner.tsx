import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export const NetworkStatusBanner: React.FC = () => {
  const { isConnected } = useSocket();
  const [wasDisconnected, setWasDisconnected] = useState<boolean>(false);
  const [showRestoredToast, setShowRestoredToast] = useState<boolean>(false);

  useEffect(() => {
    if (!isConnected) {
      setWasDisconnected(true);
      setShowRestoredToast(false);
      return undefined;
    }
    if (wasDisconnected && isConnected) {
      setShowRestoredToast(true);
      const timer = setTimeout(() => {
        setShowRestoredToast(false);
        setWasDisconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isConnected, wasDisconnected]);

  if (!isConnected) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(245, 158, 11, 0.9)',
          color: '#0f172a',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>⚠️ Connection lost — attempting background reconnection...</span>
      </div>
    );
  }

  if (showRestoredToast) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.9)',
          color: '#ffffff',
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 700,
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>🟢 Connection restored</span>
      </div>
    );
  }

  return null;
};
