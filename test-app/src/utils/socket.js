import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

// const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const backendUrl = 'http://localhost:8000';

export const createSocket = () => {
    const token = localStorage.getItem('violence_detector_token');
    const socket = io(backendUrl, {
        path: '/ws/socket.io',
        auth: token ? { token } : {},
        reconnectionAttempts: 10,
        timeout: 5000,
        pingInterval: 30000,
    });

    socket.on('connect_error', (err) => {
        toast.error('Error de conexión WebSocket: ' + (err.message || 'Desconocido'));
    });

    socket.on('error', (data) => {
        toast.error(data.message || 'Error desconocido en WebSocket');
    });

    return socket;
};