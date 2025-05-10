import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, AlertTriangle, Check } from 'react-feather';
import Card from './common/Card';
import Button from './common/Button';
import { useStreamStore } from '../store/useStreamStore';
import { useNotificationStore } from '../store/useNotificationStore';

function VideoStream() {
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
    } = useStreamStore();

    const addNotification = useNotificationStore((state) => state.addNotification);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 1280, height: 720 });
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Conectar socket al montar el componente
    useEffect(() => {
        connectSocket();

        return () => {
            disconnectSocket();
        };
    }, [connectSocket, disconnectSocket]);

    // Dibujar en el canvas cuando llega un nuevo frame
    useEffect(() => {
        if (!frame || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Crear nueva imagen a partir del frame (base64)
        const img = new Image();
        img.onload = () => {
            // Limpiar canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dibujar imagen
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Si hay detección de violencia, añadir overlay rojo
            if (violenceDetected) {
                ctx.fillStyle = 'rgba(220, 38, 38, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Texto de alerta
                ctx.fillStyle = 'white';
                ctx.font = 'bold 28px Inter';
                ctx.fillText(`¡ALERTA! Violencia detectada (${(violenceScore * 100).toFixed(1)}%)`, 20, 40);

                // Agregar notificación
                if (violenceScore > 0.7) {
                    addNotification({
                        type: 'violence',
                        message: `Violencia detectada (${violenceClass})`,
                        details: `Confianza: ${(violenceScore * 100).toFixed(1)}%`,
                        timestamp: new Date(),
                    });
                }
            }

            // Dibujar bounding boxes de personas
            if (persons && persons.length > 0) {
                persons.forEach(person => {
                    const [x, y, w, h] = person.bbox;

                    // Color según violencia
                    ctx.strokeStyle = violenceDetected ? '#dc2626' : '#16a34a';
                    ctx.lineWidth = 2;

                    // Dibujar rectángulo
                    ctx.strokeRect(x, y, w, h);

                    // Dibujar ID
                    ctx.fillStyle = 'white';
                    ctx.font = '14px Inter';
                    ctx.fillRect(x, y - 20, 60, 20);
                    ctx.fillStyle = violenceDetected ? '#dc2626' : '#16a34a';
                    ctx.fillText(`ID: ${person.id}`, x + 5, y - 5);
                });
            }

            // Mostrar FPS
            ctx.fillStyle = 'white';
            ctx.font = '14px Inter';
            ctx.fillRect(canvas.width - 80, 10, 70, 25);
            ctx.fillStyle = 'black';
            ctx.fillText(`FPS: ${fps}`, canvas.width - 70, 27);
        };

        img.src = `data:image/jpeg;base64,${frame}`;
    }, [frame, persons, violenceDetected, violenceScore, violenceClass, fps, addNotification]);

    // Manejar cambio de tamaño
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            setDimensions({ width: window.innerWidth, height: window.innerHeight - 100 });
        } else {
            setDimensions({ width: 1280, height: 720 });
        }
        setIsFullscreen(!isFullscreen);
    };

    return (
        <div className={`streaming-container ${isFullscreen ? 'fixed top-0 left-0 w-full h-full z-50 bg-black p-4' : ''}`}>
            <Card className={`overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Monitor en Vivo
                        {isConnected && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
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
                                icon={<Square size={16} />}
                            >
                                Detener
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={startStream}
                                icon={<Play size={16} />}
                                disabled={!isConnected}
                            >
                                Iniciar
                            </Button>
                        )}
                        <Button
                            variant="secondary"
                            onClick={toggleFullscreen}
                        >
                            {isFullscreen ? 'Salir' : 'Pantalla completa'}
                        </Button>
                    </div>
                </div>

                <div className="relative rounded-lg overflow-hidden bg-gray-900 flex justify-center">
                    {isConnected && frame ? (
                        <canvas
                            ref={canvasRef}
                            width={dimensions.width}
                            height={dimensions.height}
                            className="max-w-full"
                        />
                    ) : (
                        <div
                            style={{ width: dimensions.width, height: dimensions.height, maxWidth: '100%' }}
                            className="flex flex-col items-center justify-center bg-gray-800 text-white"
                        >
                            <Camera size={48} className="mb-4 text-gray-400" />
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

                    {/* Indicador de violencia */}
                    {violenceDetected && (
                        <div className="absolute bottom-4 left-4 right-4 bg-danger-600 text-white p-3 rounded-lg shadow-lg animate-pulse-fast">
                            <div className="flex items-center">
                                <AlertTriangle size={24} className="mr-2" />
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

                {/* Información de estado */}
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
                        <div className="mt-1 font-medium">{fps || 0}</div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export default VideoStream;