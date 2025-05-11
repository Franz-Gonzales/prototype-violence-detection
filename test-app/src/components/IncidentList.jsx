import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExclamationTriangleIcon, ChevronRightIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Card from './common/Card';
import Button from './common/Button';
import { fetchIncidents, updateIncidentStatus } from '../utils/api';
import { useIncidentsStore } from '../store/useIncidentsStore';
import { useStreamStore } from '../store/useStreamStore';
import toast from 'react-hot-toast';

function IncidentList() {
    const { incidents, loading, error, setIncidents, setLoading, setError, updateIncidentStatus: updateLocalStatus } = useIncidentsStore();
    const { socket } = useStreamStore();
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [filters, setFilters] = useState({ status: '', date: '' });
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    // Cargar incidentes
    useEffect(() => {
        const loadIncidents = async () => {
            setLoading(true);
            try {
                const data = await fetchIncidents({ ...filters, page, limit: itemsPerPage });
                setIncidents(data);
            } catch (err) {
                setError(err.response?.data?.message || 'Error al cargar la lista de incidentes');
            } finally {
                setLoading(false);
            }
        };

        loadIncidents();
    }, [filters, page, setIncidents, setLoading, setError]);

    // Escuchar nuevos incidentes
    useEffect(() => {
        if (socket) {
            socket.on('incident', (data) => {
                setIncidents([data, ...incidents.slice(0, itemsPerPage - 1)]);
                toast.success('Nuevo incidente detectado');
            });
        }
        return () => socket?.off('incident');
    }, [socket, incidents, setIncidents]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
        setPage(1);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return format(date, "d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es });
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'false_alarm': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const translateStatus = (status) => {
        switch (status) {
            case 'new': return 'Nuevo';
            case 'resolved': return 'Resuelto';
            case 'false_alarm': return 'Falsa alarma';
            default: return status;
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Incidentes</h2>
                        <span className="badge bg-primary-100 text-primary-800">{incidents.length} total</span>
                    </div>

                    <div className="mb-4 space-y-2">
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="new">Nuevo</option>
                            <option value="resolved">Resuelto</option>
                            <option value="false_alarm">Falsa alarma</option>
                        </select>
                        <input
                            type="date"
                            name="date"
                            value={filters.date}
                            onChange={handleFilterChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    {loading ? (
                        <div className="py-8 flex justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-danger-50 text-danger-800 p-4 rounded-md">
                            <p className="font-medium">{error}</p>
                            <Button
                                variant="primary"
                                className="mt-2"
                                onClick={() => window.location.reload()}
                            >
                                Reintentar
                            </Button>
                        </div>
                    ) : incidents.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                            <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p>No hay incidentes registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-2" role="list">
                            {incidents.map((incident) => (
                                <div
                                    key={incident.id}
                                    className={`p-3 rounded-lg border ${selectedIncident?.id === incident.id
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                        } cursor-pointer transition-colors`}
                                    onClick={() => setSelectedIncident(incident)}
                                    role="listitem"
                                    aria-selected={selectedIncident?.id === incident.id}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center">
                                                <ExclamationTriangleIcon
                                                    className={`h-5 w-5 mr-2 ${incident.violence_score > 0.8 ? 'text-danger-600' : 'text-warning-500'}`}
                                                />
                                                <span className="font-medium text-gray-900">Incidente #{incident.id}</span>
                                            </div>
                                            <div className="text-sm text-gray-500 flex items-center mt-1">
                                                <ClockIcon className="h-4 w-4 mr-1" />
                                                {formatDate(incident.timestamp)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className={`badge ${getStatusClass(incident.status)}`}>
                                                {translateStatus(incident.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-between items-center">
                                        <div className="text-sm text-gray-600 flex items-center">
                                            <MapPinIcon className="h-4 w-4 mr-1" />
                                            {incident.location || 'Ubicación desconocida'}
                                        </div>
                                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex justify-between">
                        <Button
                            variant="secondary"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={incidents.length < itemsPerPage}
                        >
                            Siguiente
                        </Button>
                    </div>
                </Card>
            </div>

            <div className="md:col-span-2">
                <Card>
                    {selectedIncident ? (
                        <IncidentDetails incident={selectedIncident} updateLocalStatus={updateLocalStatus} />
                    ) : (
                        <div className="py-16 text-center text-gray-500">
                            <VideoCameraIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-medium text-gray-600 mb-1">No hay ningún incidente seleccionado</h3>
                            <p>Seleccione un incidente de la lista para ver sus detalles</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export default IncidentList;