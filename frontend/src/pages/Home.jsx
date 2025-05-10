import React, { useEffect } from 'react';
import VideoStream from '../components/VideoStream';
import Card from '../components/common/Card';
import { useStreamStore } from '../store/useStreamStore';
import { useIncidentsStore } from '../store/useIncidentsStore';
import { fetchIncidents } from '../utils/api';
import { AlertTriangle, Clock, MapPin } from 'react-feather';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function Home() {
    const { isConnected, isStreaming } = useStreamStore();
    const { incidents, setIncidents, setLoading, setError } = useIncidentsStore();

    // Cargar incidentes recientes
    useEffect(() => {
        const loadRecentIncidents = async () => {
            setLoading(true);
            try {
                const data = await fetchIncidents({ limit: 5 });
                setIncidents(data);
            } catch (err) {
                console.error('Error al cargar incidentes recientes:', err);
                setError('Error al cargar incidentes recientes');
            } finally {
                setLoading(false);
            }
        };

        loadRecentIncidents();
    }, [setIncidents, setLoading, setError]);

    // Formatear fecha
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return format(date, "d MMM, HH:mm", { locale: es });
    };

    return (
        <div className="container px-4 mx-auto">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

            {/* Video stream */}
            <VideoStream />

            {/* Estadísticas e incidentes */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Estadísticas */}
                <div>
                    <Card>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Estado del Sistema</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Conexión al servidor:</span>
                                <span className={`inline-flex items-center font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                                    <span className={`mr-1.5 h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    {isConnected ? 'Conectado' : 'Desconectado'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Procesamiento de video:</span>
                                <span className={`inline-flex items-center font-medium ${isStreaming ? 'text-green-600' : 'text-gray-600'}`}>
                                    <span className={`mr-1.5 h-2.5 w-2.5 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                    {isStreaming ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Incidentes hoy:</span>
                                <span className="font-medium text-gray-900">{incidents.filter(incident =>
                                    new Date(incident.timestamp).toDateString() === new Date().toDateString()
                                ).length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Total incidentes:</span>
                                <span className="font-medium text-gray-900">{incidents.length}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Incidentes recientes */}
                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium text-gray-900">Incidentes Recientes</h2>
                            <a href="/incidents" className="text-sm text-primary-600 hover:text-primary-700">
                                Ver todos
                            </a>
                        </div>

                        {incidents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <AlertTriangle size={32} className="mx-auto mb-2 text-gray-400" />
                                <p>No hay incidentes registrados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {incidents.slice(0, 5).map((incident) => (
                                    <div key={incident.id} className="py-3 flex items-start">
                                        <div className="flex-shrink-0 mr-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${incident.violence_score > 0.8
                                                    ? 'bg-danger-100 text-danger-700'
                                                    : 'bg-warning-100 text-warning-700'
                                                }`}>
                                                <AlertTriangle size={18} />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between">
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    Incidente #{incident.id}
                                                </h3>
                                                <p className="text-sm text-gray-500 flex items-center">
                                                    <Clock size={14} className="mr-1" />
                                                    {formatDate(incident.timestamp)}
                                                </p>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1 flex items-center">
                                                <MapPin size={14} className="mr-1" />
                                                {incident.location || 'Ubicación desconocida'}
                                            </p>
                                            <div className="mt-2 flex">
                                                <a
                                                    href={`/incidents?id=${incident.id}`}
                                                    className="text-sm text-primary-600 hover:text-primary-700"
                                                >
                                                    Ver detalles
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default Home;