import { io } from 'socket.io-client';

// Configuración para Socket.IO
const SOCKET_URL = window.location.origin;
const SOCKET_PATH = '/ws/socket.io';

let socket = null;

// Crear conexión de socket
export const createSocket = () => {
    if (socket) return socket;

    socket = io(SOCKET_URL, {
        path: SOCKET_PATH,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    });

    // Eventos de conexión
    socket.on('connect', () => {
        console.log('Socket conectado');
    });

    socket.on('disconnect', () => {
        console.log('Socket desconectado');
    });

    socket.on('connect_error', (err) => {
        console.error('Error de conexión Socket:', err);
    });

    return socket;
};

// Obtener socket existente o crear uno nuevo
export const getSocket = () => {
    if (!socket) {
        return createSocket();
    }
    return socket;
};

// Cerrar socket
export const closeSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default { createSocket, getSocket, closeSocket };