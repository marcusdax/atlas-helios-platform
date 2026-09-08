import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    /**
     * Same origin by default, not localhost:5000.
     *
     * A built bundle served from anywhere other than localhost:5000 could never
     * reach that address, so the socket failed to connect and every real-time
     * feature - storm alerts, assessment completion, lead notifications -
     * silently did nothing. Defaulting to the page's own origin works behind
     * the reverse proxy that already fronts /api, and REACT_APP_WS_URL still
     * overrides it for a split deployment.
     */
    const wsUrl = process.env.REACT_APP_WS_URL
      || (typeof window !== 'undefined' ? window.location.origin : undefined);

    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      toast.success('Connected to real-time updates', {
        duration: 2000,
        position: 'bottom-left'
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, manual reconnection needed
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      
      toast.error('Connection failed. Retrying...', {
        duration: 3000,
        position: 'bottom-left'
      });
    });

    // Storm-related events
    newSocket.on('storm_alert', (data) => {
      console.log('Storm alert received:', data);
      toast.custom((t) => (
        <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 mr-3" />
            <div>
              <div className="font-semibold">Severe Weather Alert</div>
              <div className="text-sm opacity-90">{data.message}</div>
            </div>
          </div>
        </div>
      ), { duration: 8000 });
    });

    newSocket.on('storm_update', (data) => {
      console.log('Storm update received:', data);
      // Update storm data in context
    });

    // Property assessment events
    newSocket.on('property_assessment_complete', (data) => {
      toast.success(`Assessment completed for ${data.propertyAddress}`, {
        duration: 4000
      });
    });

    // Lead generation events
    newSocket.on('new_leads_generated', (data) => {
      toast.success(`${data.leadCount} new leads generated`, {
        duration: 4000
      });
    });

    // System events
    newSocket.on('system_notification', (data) => {
      toast(data.message, {
        icon: data.type === 'error' ? '⚠️' : data.type === 'success' ? '✅' : 'ℹ️',
        duration: 4000
      });
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Helper methods
  const emitEvent = (event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Cannot emit event: WebSocket not connected');
    }
  };

  const subscribeToEvent = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    emitEvent,
    subscribeToEvent
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};