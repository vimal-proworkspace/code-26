import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '../services/socket';
import { useAuth } from '../hooks/useAuth';

export interface SocketRoundState {
  roundId: string;
  roundName: string;
  roundType: string;
  status: 'DRAFT' | 'READY' | 'LIVE' | 'PAUSED' | 'ENDED';
  startTime?: string | null;
  endTime?: string | null;
  serverTime: string;
  duration: number;
  remainingSeconds: number;
}

export interface SocketAdminMetrics {
  totalStudents: number;
  onlineCount: number;
  offlineCount: number;
  activeRoundId?: string | null;
  activeRoundStatus?: string | null;
  serverTime: string;
}

interface SocketContextValue {
  isConnected: boolean;
  roundState: SocketRoundState | null;
  adminMetrics: SocketAdminMetrics | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  isConnected: false,
  roundState: null,
  adminMetrics: null,
  reconnect: () => {},
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roundState, setRoundState] = useState<SocketRoundState | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<SocketAdminMetrics | null>(null);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }

    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onStateSync = (data: SocketRoundState) => {
      setRoundState(data);
    };

    const onRoundStarted = (data: SocketRoundState) => {
      setRoundState(data);
    };

    const onRoundPaused = (data: { roundId: string; status: 'PAUSED' }) => {
      setRoundState((prev) => (prev ? { ...prev, status: 'PAUSED' } : null));
    };

    const onRoundResumed = (data: { roundId: string; status: 'LIVE'; endTime?: string; remainingSeconds?: number }) => {
      setRoundState((prev) =>
        prev
          ? {
              ...prev,
              status: 'LIVE',
              endTime: data.endTime || prev.endTime,
              remainingSeconds: data.remainingSeconds ?? prev.remainingSeconds,
            }
          : null
      );
    };

    const onRoundEnded = (data: { roundId: string; status: 'ENDED' }) => {
      setRoundState((prev) => (prev ? { ...prev, status: 'ENDED' } : null));
    };

    const onRoundRestarted = (data: { roundId: string; status: 'READY' }) => {
      setRoundState(null);
    };

    const onAdminMetrics = (data: SocketAdminMetrics) => {
      setAdminMetrics(data);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ROUND_STATE_SYNC', onStateSync);
    socket.on('ROUND_STARTED', onRoundStarted);
    socket.on('ROUND_PAUSED', onRoundPaused);
    socket.on('ROUND_RESUMED', onRoundResumed);
    socket.on('ROUND_ENDED', onRoundEnded);
    socket.on('ROUND_RESTARTED', onRoundRestarted);
    socket.on('ADMIN_EVENT_UPDATE', onAdminMetrics);

    connectSocket();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ROUND_STATE_SYNC', onStateSync);
      socket.off('ROUND_STARTED', onRoundStarted);
      socket.off('ROUND_PAUSED', onRoundPaused);
      socket.off('ROUND_RESUMED', onRoundResumed);
      socket.off('ROUND_ENDED', onRoundEnded);
      socket.off('ROUND_RESTARTED', onRoundRestarted);
      socket.off('ADMIN_EVENT_UPDATE', onAdminMetrics);
    };
  }, [user]);

  const reconnect = () => {
    connectSocket();
  };

  return (
    <SocketContext.Provider value={{ isConnected, roundState, adminMetrics, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
