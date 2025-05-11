import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import VideoStream from '../components/VideoStream';
import Card from '../components/common/Card';
import { useStreamStore } from '../store/useStreamStore';
import { useIncidentsStore } from '../store/useIncidentsStore';
import { fetchIncidents, fetchStats } from '../utils/api';
import { ExclamationTriangleIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';

function Home() {
    const { isConnected, isStreaming, socket } = useStreamStore();
    const { incidents, setIncidents, setLoading, setError, error, loading } = useIncidentsStore();
    const [stats, setStats] = React.useState({ today: 0, total: 0 });
    const navigate = useNavigate();

    useEffect(() => {
        const loadRecentIncidents = async () => {
            setLoading(true);
            try {
                const data = await fetchIncidents({ limit: 5 });
                setIncidents(data);
            } catch (err) {
                setError(err.response?.data?.message || 'Error al cargar incidentes recientes');
                toast.error('Error al cargar incidentes recientes');
            } finally {
                setLoading(false);
            }
        };

        const loadStats = async () => {
            try {
                const data = await fetchStats('today');
                setStats(data);
            } catch (err) {
                toast.error('Error al cargar estadísticas');
            }
        };

        loadRecentIncidents();
        loadStats();
    }, [setIncidents, setLoading, setError]);

    useEffect(() => {
        if (socket) {
            socket.on('incident', (data) => {
                setIncidents([data, ...incidents.slice(0, 4)]);
                toast.success('Nuevo incidente detectado');
            });
        }
        return () => socket?.off('incident');
    }, [socket, incidents, setIncidents]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return format(date, "d MMM, HH:mm", { locale: es });
    };

    return (
        <div className="container px-4 mx-auto">
            <Helmet>
                <title>Dashboard | Detector de Violencia</title>
                <meta name="description" content="Monitor en tiempo real para detección de violencia escolar" />
            </Helmet>
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

            <VideoStream />

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                                <span className="font-medium text-gray-900">{stats.today}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Total incidentes:</span>
                                <span className="font-medium text-gray-900">{stats.total}</span>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-medium text-gray-900">Incidentes Recientes</h2>
                            <a href="/incidents" className="text-sm text-primary-600 hover:text-primary-700">
                                Ver todos
                            </a>
                        </div>

                        {loading ? (
                            <div className="py-8 flex justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
                            </div>
                        ) : error ? (
                            <div className="bg-danger-50 text-danger-800 p-4 rounded-md">
                                <p className="font-medium">{error}</p>
                                <button
                                    className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                                    onClick={() => window.location.reload()}
                                >
                                    Reintentar
                                </button>
                            </div>
                        ) : incidents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                <p>No hay incidentes registrados</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200" role="list" aria-live="polite">
                                {incidents.slice(0, 5).map((incident) => (
                                    <div key={incident.id} className="py-3 flex items-start" role="listitem">
                                        <div className="flex-shrink-0 mr-3">
                                            <div
                                                className={`w-10 h-10 rounded-full flex items-center justify-center ${incident.violence_score > 0.8 ? 'bg-danger-100 text-danger-700' : 'bg-warning-100 text-warning-700'
                                                    }`}
                                            >
                                                <ExclamationTriangleIcon className="h-5 w-5" />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between">
                                                <h3 className="text-sm font-medium text-gray-900">Incidente #{incident.id}</h3>
                                                <p className="text-sm text-gray-500 flex items-center">
                                                    <ClockIcon className="h-4 w-4 mr-1" />
                                                    {formatDate(incident.timestamp)}
                                                </p>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1 flex items-center">
                                                <MapPinIcon className="h-4 w-4 mr-1" />
                                                {incident.location || 'Ubicación desconocida'}
                                            </p>
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => navigate(`/incidents/${incident.id}`)}
                                                    className="text-sm text-primary-600 hover:text-primary-700"
                                                >
                                                    Ver detalles
                                                </button>
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