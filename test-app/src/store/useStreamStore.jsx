import { create } from 'zustand';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { updateConfig } from '../utils/api';

// const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const backendUrl = 'http://localhost:8000';

export const useStreamStore = create((set, get) => ({
    isConnected: false,
    isStreaming: false,
    streamUrl: null,
    frame: null,
    persons: [],
    violenceDetected: false,
    violenceScore: 0,
    violenceClass: '',
    fps: 0,
    error: null,
    socket: null,

    connectSocket: () => {
        const token = localStorage.getItem('violence_detector_token');
        const socket = io(backendUrl, {
            path: '/ws/socket.io',
            auth: token ? { token } : {},
            reconnectionAttempts: 10,
        });

        socket.on('connect', () => {
            set({ isConnected: true, socket, error: null });
            toast.success('Conectado al servidor');
        });

        socket.on('connect_error', (err) => {
            set({ isConnected: false, error: err.message || 'Error de conexión' });
            toast.error('Error de conexión: ' + (err.message || 'Desconocido'));
        });

        socket.on('frame', (data) => {
            set({
                frame: data.frame,
                persons: data.persons || [],
                violenceDetected: data.violence_detected || false,
                violenceScore: data.violence_score || 0,
                violenceClass: data.violence_class || '',
                fps: typeof data.fps === 'number' && data.fps >= 0 ? data.fps : 0,
            });
        });

        socket.on('stream_status', (data) => {
            set({ isStreaming: data.status === 'active', streamUrl: data.url || null });
        });

        socket.on('error', (data) => {
            set({ error: data.message || 'Error desconocido' });
            toast.error(data.message || 'Error desconocido');
        });

        socket.on('disconnect', () => {
            set({ isConnected: false, isStreaming: false, streamUrl: null });
            toast.error('Desconectado del servidor');
        });
    },

    disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false, isStreaming: false, streamUrl: null });
        }
    },

    startStream: () => {
        const { socket } = get();
        if (socket && socket.connected) {
            socket.emit('start_stream');
        } else {
            toast.error('No conectado al servidor');
        }
    },

    stopStream: () => {
        const { socket } = get();
        if (socket && socket.connected) {
            socket.emit('stop_stream');
        }
    },

    updateConfig: async (config) => {
        try {
            await updateConfig(config);
            toast.success('Configuración actualizada');
        } catch (err) {
            toast.error('Error al actualizar configuración: ' + (err.response?.data?.message || 'Desconocido'));
        }
    },
}));