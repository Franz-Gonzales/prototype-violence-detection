import { create } from 'zustand';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const useStreamStore = create((set, get) => ({
    // Estado
    socket: null,
    isConnected: false,
    isStreaming: false,
    streamUrl: null,
    frame: null,
    persons: [],
    violenceDetected: false,
    violenceScore: 0,
    violenceClass: "no_violencia",
    fps: 0,
    error: null,

    // Acciones
    connectSocket: async () => {
        try {
            // Cerrar socket existente si lo hay
            if (get().socket) {
                get().socket.disconnect();
            }

            // Crear nuevo socket
            const socket = io('/ws', {
                path: '/ws/socket.io',
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            // Manejar eventos del socket
            socket.on('connect', () => {
                console.log('Conectado al servidor WebSocket');
                set({ isConnected: true, error: null });
                toast.success('Conectado al servidor');
            });

            socket.on('disconnect', () => {
                console.log('Desconectado del servidor WebSocket');
                set({ isConnected: false, isStreaming: false });
                toast.error('Desconectado del servidor');
            });

            socket.on('connect_error', (err) => {
                console.error('Error de conexión WebSocket:', err);
                set({ isConnected: false, error: 'Error de conexión' });
                toast.error('Error de conexión al servidor');
            });

            // Manejar mensaje de frame
            socket.on('frame', (data) => {
                set({
                    frame: data.frame,
                    persons: data.persons || [],
                    violenceDetected: data.violence_detected || false,
                    violenceScore: data.violence_score || 0,
                    violenceClass: data.violence_class || "no_violencia",
                    fps: data.fps || 0,
                });
            });

            // Manejar mensaje de incidente
            socket.on('incident', (data) => {
                console.log('Nuevo incidente detectado:', data);

                // Mostrar toast de notificación
                toast((t) => (
                    <div onClick={() => toast.dismiss(t.id)}>
                        <div className="font-bold text-danger-700">¡Alerta de violencia!</div>
                        <div className="text-sm">
                            {data.violence_class} - Score: {(data.violence_score * 100).toFixed(1)}%
                        </div>
                    </div>
                ), {
                    duration: 6000,
                    icon: '⚠️',
                    style: {
                        border: '1px solid #ef4444',
                        padding: '12px',
                        color: '#991b1b',
                    }
                });
            });

            // Guardar referencia al socket
            set({ socket });

        } catch (err) {
            console.error('Error al conectar socket:', err);
            set({ error: err.message });
            toast.error('Error al conectar con el servidor');
        }
    },

    disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, isConnected: false });
        }
    },

    startStream: async () => {
        try {
            const { socket, isConnected } = get();

            if (!isConnected || !socket) {
                throw new Error('No hay conexión con el servidor');
            }

            // Enviar comando para iniciar stream
            socket.emit('command', { command: 'start_stream' });

            // También llamar al endpoint REST
            const response = await fetch('/api/stream/start', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Error al iniciar el stream');
            }

            set({ isStreaming: true });
            toast.success('Stream iniciado');

        } catch (err) {
            console.error('Error al iniciar stream:', err);
            set({ error: err.message });
            toast.error(`Error al iniciar stream: ${err.message}`);
        }
    },

    stopStream: async () => {
        try {
            const { socket, isConnected } = get();

            if (!isConnected || !socket) {
                throw new Error('No hay conexión con el servidor');
            }

            // Enviar comando para detener stream
            socket.emit('command', { command: 'stop_stream' });

            // También llamar al endpoint REST
            const response = await fetch('/api/stream/stop', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Error al detener el stream');
            }

            set({
                isStreaming: false,
                frame: null,
                persons: [],
                violenceDetected: false,
                violenceScore: 0
            });

            toast.success('Stream detenido');

        } catch (err) {
            console.error('Error al detener stream:', err);
            set({ error: err.message });
            toast.error(`Error al detener stream: ${err.message}`);
        }
    },

    updateConfig: async (config) => {
        try {
            const { socket } = get();

            if (socket) {
                socket.emit('command', { command: 'update_config', config });
            }

            // También actualizar mediante API REST
            for (const [key, value] of Object.entries(config)) {
                const response = await fetch(`/api/settings/${key}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: String(value) }),
                });

                if (!response.ok) {
                    throw new Error(`Error al actualizar configuración ${key}`);
                }
            }

            toast.success('Configuración actualizada');

        } catch (err) {
            console.error('Error al actualizar configuración:', err);
            toast.error(`Error al actualizar configuración: ${err.message}`);
        }
    },

    resetError: () => set({ error: null }),
}));

export { useStreamStore };