import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  latestVitalsUpdate: any;
  emergencyAlert: any;
  nebulizerState: any;
}

const SocketContext = createContext<SocketContextType>({} as SocketContextType);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestVitalsUpdate, setLatestVitalsUpdate] = useState<any>(null);
  const [emergencyAlert, setEmergencyAlert] = useState<any>(null);
  const [nebulizerState, setNebulizerState] = useState<any>(null);

  useEffect(() => {
    const newSocket = io('http://172.16.23.35:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('⚡ Mobile Socket connected:', newSocket.id);
      setIsConnected(true);
      if (user?.patientId) {
        newSocket.emit('join_patient_room', user.patientId);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Mobile Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('vitals_update', (data) => {
      setLatestVitalsUpdate(data);
    });

    newSocket.on('emergency_broadcast', (data) => {
      setEmergencyAlert(data);
    });

    newSocket.on('nebulizer_state_update', (data) => {
      setNebulizerState(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?.patientId]);

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, latestVitalsUpdate, emergencyAlert, nebulizerState }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
