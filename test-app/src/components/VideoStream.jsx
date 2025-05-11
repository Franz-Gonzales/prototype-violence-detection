import React, { useEffect, useRef, useState, memo } from 'react';
import { PlayIcon, StopIcon, ExclamationTriangleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import Card from './common/Card';
import Button from './common/Button';
import { useStreamStore } from '../store/useStreamStore';
import { useNotificationStore } from '../store/useNotificationStore';
import toast from 'react-hot-toast';

const VideoStream = memo(() => {
    const {
        isConnected,
        isStreaming,
        streamUrl,
        frame,
        persons,
        violenceDetected,
        violenceScore,
        violenceClass,
        fps,
        connectSocket,
        disconnectSocket,
        startStream,
        stopStream,
        error,
    } = useStreamStore();

    const addNotification = useNotificationStore((state) => state.addNotification);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [useVideo, setUseVideo] = useState(!!streamUrl); // Usar <video> si hay streamUrl
    const reconnectionTimeoutRef = useRef(null);
    const VIOLENCE_THRESHOLD = 0.7; // Sincronizar con backend

    // Mantener aspect ratio 16:9
    const maintainAspectRatio = (width, height) => {
        const targetRatio = 16 / 9;
        const currentRatio = width / height;
        if (Math.abs(currentRatio - targetRatio) > 0.01) {
            return {
                width: Math.round(height * targetRatio),
                height,
            };
        }
        return { width, height };
    };

    // Conectar socket y manejar reconexión
    useEffect(() => {
        connectSocket();

        if (!isConnected && !reconnectionTimeoutRef.current) {
            reconnectionTimeoutRef.current = setInterval(() => {
                if (!isConnected) {
                    toast('Intentando reconectar...', { id: 'reconnect' });
                    connectSocket();
                }
            }, 5000);
        }

        return () => {
            disconnectSocket();
            if (reconnectionTimeoutRef.current) {
                clearInterval(reconnectionTimeoutRef.current);
                reconnectionTimeoutRef.current = null;
            }
        };
    }, [connectSocket, disconnectSocket, isConnected]);

    // Dibujar en el canvas
    useEffect(() => {
        if (!frame || !canvasRef.current || useVideo) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            const { width, height } = maintainAspectRatio(img.width, img.height);
            canvas.width = width;
            canvas.height = height;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            if (violenceDetected) {
                ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = 'white';
                ctx.font = 'bold 28px Inter';
                ctx.fillText(`¡ALERTA! Violencia detectada (${(violenceScore * 100).toFixed(1)}%)`, 20, 40);

                if (violenceScore > VIOLENCE_THRESHOLD) {
                    addNotification({
                        type: 'violence',
                        message: `Violencia detectada (${violenceClass})`,
                        details: `Confianza: ${(violenceScore * 100).toFixed(1)}%`,
                        timestamp: new Date(),
                    });
                }
            }

            if (persons && persons.length > 0) {
                persons.forEach((person) => {
                    const [x, y, w, h] = person.bbox;
                    ctx.strokeStyle = violenceDetected ? '#dc2626' : '#16a34a';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, w, h);

                    ctx.fillStyle = 'white';
                    ctx.font = '14px Inter';
                    ctx.fillRect(x, y - 20, 60, 20);
                    ctx.fillStyle = violenceDetected ? '#dc2626' : '#16a34a';
                    ctx.fillText(`ID: ${person.id}`, x + 5, y - 5);
                });
            }

            ctx.fillStyle = 'white';
            ctx.font = '14px Inter';
            ctx.fillRect(canvas.width - 80, 10, 70, 25);
            ctx.fillStyle = 'black';
            ctx.fillText(`FPS: ${fps || 0}`, canvas.width - 70, 27);
        };

        img.onerror = () => {
            toast.error('Error al cargar el frame');
        };

        img.src = `data:image/jpeg;base64,${frame}`;
    }, [frame, persons, violenceDetected, violenceScore, violenceClass, fps, addNotification, useVideo]);

    // Configurar video si streamUrl está disponible
    useEffect(() => {
        if (useVideo && videoRef.current && streamUrl) {
            videoRef.current.src = streamUrl;
        }
    }, [streamUrl, useVideo]);

    // Manejar pantalla completa
    const toggleFullscreen = () => {
        const { width, height } = isFullscreen
            ? { width: 1280, height: 720 }
            : maintainAspectRatio(window.innerWidth, window.innerHeight - 100);
        setDimensions({ width, height });
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div className={`streaming-container ${isFullscreen ? 'fixed top-0 left-0 w-full h-full z-50 bg-black p-4' : ''}`}>
            <Card className={`overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Monitor en Vivo
                        {isConnected && (
                            <span className="ml-2 badge bg-green-100 text-green-800">
                                <span className="w-2 h-2 mr-1 bg-green-400 rounded-full animate-pulse"></span>
                                Conectado
                            </span>
                        )}
                    </h2>
                    <div className="flex space-x-2">
                        {isStreaming ? (
                            <Button
                                variant="danger"
                                onClick={stopStream}
                                icon={<StopIcon className="h-4 w-4" />}
                                disabled={!isConnected}
                            >
                                Detener
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={startStream}
                                icon={<PlayIcon className="h-4 w-4" />}
                                disabled={!isConnected}
                            >
                                Iniciar
                            </Button>
                        )}
                        <Button variant="secondary" onClick={toggleFullscreen}>
                            {isFullscreen ? 'Salir' : 'Pantalla completa'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setUseVideo(!useVideo)}
                            disabled={!streamUrl}
                        >
                            {useVideo ? 'Usar Canvas' : 'Usar Video'}
                        </Button>
                    </div>
                </div>

                <div className="relative rounded-lg overflow-hidden bg-gray-900 flex justify-center" aria-live="polite">
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-white">
                            <p className="text-lg font-medium">Error: {error}</p>
                        </div>
                    )}
                    {isConnected && (frame || useVideo) ? (
                        useVideo ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="max-w-full"
                                style={{ aspectRatio: '16/9' }}
                            />
                        ) : (
                            <canvas
                                ref={canvasRef}
                                width={dimensions.width}
                                height={dimensions.height}
                                className="max-w-full"
                                style={{ aspectRatio: '16/9' }}
                            />
                        )
                    ) : (
                        <div
                            style={{ width: dimensions.width, height: dimensions.height, maxWidth: '100%' }}
                            className="flex flex-col items-center justify-center bg-gray-800 text-white"
                        >
                            <VideoCameraIcon className="h-12 w-12 mb-4 text-gray-400" />
                            <p className="text-lg font-medium text-gray-300">
                                {isConnected ? 'Esperando inicio de transmisión...' : 'Conectando a la cámara...'}
                            </p>
                            <p className="text-sm text-gray-400 mt-2">
                                {isConnected
                                    ? 'Haga clic en el botón "Iniciar" para comenzar'
                                    : 'Verificando conexión con el servidor...'}
                            </p>
                        </div>
                    )}

                    {violenceDetected && (
                        <div className="absolute bottom-4 left-4 right-4 bg-danger-600 text-white p-3 rounded-lg shadow-lg animate-pulse-fast">
                            <div className="flex items-center">
                                <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
                                <div>
                                    <p className="font-bold">¡Alerta de violencia detectada!</p>
                                    <p className="text-sm">
                                        Tipo: {violenceClass} - Confianza: {(violenceScore * 100).toFixed(1)}% - Personas: {persons?.length || 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-500">Estado</div>
                        <div className="mt-1 flex items-center">
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="font-medium">{isConnected ? 'Conectado' : 'Desconectado'}</span>
                        </div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-500">Transmisión</div>
                        <div className="mt-1 flex items-center">
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isStreaming ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                            <span className="font-medium">{isStreaming ? 'Activa' : 'Inactiva'}</span>
                        </div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-500">Personas detectadas</div>
                        <div className="mt-1 font-medium">{persons?.length || 0}</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-500">FPS</div>
                        <div className="mt-1 font-medium">{fps || 0} {fps < 10 && fps > 0 && <span className="text-red-500">(Bajo)</span>}</div>
                    </div>
                </div>
            </Card>
        </div>
    );
});

export default VideoStream;