import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    // Determine backend socket URL
    const backendUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

    socketInstance = io(backendUrl, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[SocketClient] Connected successfully:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SocketClient] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[SocketClient] Connection error:', err.message);
    });
  }

  return socketInstance;
};

export const connectSocket = () => {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socketInstance && socketInstance.connected) {
    socketInstance.disconnect();
  }
};
