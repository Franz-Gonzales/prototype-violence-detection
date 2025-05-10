import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ChevronRight, Clock, MapPin, User, Video } from 'react-feather';
import Card from './common/Card';
import Button from './common/Button';
import { fetchIncidents } from '../utils/api';
import { useIncidentsStore } from '../store/useIncidentsStore';

function IncidentList() {
    const { incidents, loading, error, setIncidents, setLoading, setError } = useIncidentsStore();
    const [selectedIncident, setSelectedIncident] = useState(null);

    // Cargar incidentes al montar el componente
    useEffect(() => {
        const loadIncidents = async () => {
            setLoading(true);
            try {
                const data = await fetchIncidents();
                setIncidents(data);
            } catch (err) {
                console.error('Error al cargar incidentes:', err);
                setError('Error al cargar la lista de incidentes');
            } finally {
                setLoading(false);
            }
        };

        loadIncidents();
    }, [setIncidents, setLoading, setError]);

    // Mostrar detalles de un incidente
    const showDetails = (incident) => {
        setSelectedIncident(incident);
    };

    // Formatear fecha
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return format(date, "d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es });
    };

    // Obtener clase de estado
    const getStatusClass = (status) => {
        switch (status) {
            case 'new':
                return 'bg-blue-100 text-blue-800';
            case 'resolved':
                return 'bg-green-100 text-green-800';
            case 'false_alarm':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Traducir estado
    const translateStatus = (status) => {
        switch (status) {
            case 'new':
                return 'Nuevo';
            case 'resolved':
                return 'Resuelto';
            case 'false_alarm':
                return 'Falsa alarma';
            default:
                return status;
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Lista de incidentes */}
            <div className="md:col-span-1">
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">Incidentes</h2>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                            {incidents.length} total
                        </span>
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
                            <AlertTriangle size={32} className="mx-auto mb-2 text-gray-400" />
                            <p>No hay incidentes registrados</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                            {incidents.map((incident) => (
                                <div
                                    key={incident.id}
                                    className={`p-3 rounded-lg border ${selectedIncident?.id === incident.id
                                            ? 'border-primary-500 bg-primary-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                        } cursor-pointer transition-colors`}
                                    onClick={() => showDetails(incident)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center">
                                                <AlertTriangle
                                                    size={18}
                                                    className={`mr-2 ${incident.violence_score > 0.8 ? 'text-danger-600' : 'text-warning-500'}`}
                                                />
                                                <span className="font-medium text-gray-900">
                                                    Incidente #{incident.id}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 flex items-center mt-1">
                                                <Clock size={14} className="mr-1" />
                                                {formatDate(incident.timestamp)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(incident.status)}`}>
                                                {translateStatus(incident.status)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-between items-center">
                                        <div className="text-sm text-gray-600 flex items-center">
                                            <MapPin size={14} className="mr-1" />
                                            {incident.location || 'Ubicación desconocida'}
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Detalles del incidente */}
            <div className="md:col-span-2">
                <Card>
                    {selectedIncident ? (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Detalles del Incidente #{selectedIncident.id}
                                </h2>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(selectedIncident.status)}`}>
                                    {translateStatus(selectedIncident.status)}
                                </span>
                            </div>

                            {/* Video del incidente */}
                            <div className="bg-gray-900 rounded-lg overflow-hidden mb-6">
                                <video
                                    className="w-full"
                                    controls
                                    src={`/api/incidents/${selectedIncident.id}/clip`}
                                    poster={selectedIncident.frame_path}
                                    height={480}
                                />
                            </div>

                            {/* Información del incidente */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-gray-700 mb-2">Detalles</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Fecha y hora:</span>
                                            <span className="font-medium">{formatDate(selectedIncident.timestamp)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Ubicación:</span>
                                            <span className="font-medium">{selectedIncident.location || 'No especificada'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Nivel de violencia:</span>
                                            <span className="font-medium">{(selectedIncident.violence_score * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-medium text-gray-700 mb-2">Personas involucradas</h3>
                                    {selectedIncident.persons && selectedIncident.persons.length > 0 ? (
                                        <div className="max-h-32 overflow-y-auto pr-2">
                                            {selectedIncident.persons.map((person) => (
                                                <div
                                                    key={person.id}
                                                    className="flex items-center py-1 border-b border-gray-200 last:border-0"
                                                >
                                                    <User size={16} className="mr-2 text-gray-400" />
                                                    <span className="text-gray-600">ID de persona: {person.person_id}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">No hay información de personas</p>
                                    )}
                                </div>
                            </div>

                            {/* Acciones */}
                            <div className="border-t border-gray-200 pt-4 flex justify-between">
                                <div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => window.open(`/api/incidents/${selectedIncident.id}/clip`, '_blank')}
                                        icon={<Video size={16} />}
                                    >
                                        Descargar video
                                    </Button>
                                </div>
                                <div className="space-x-2">
                                    {selectedIncident.status === 'new' && (
                                        <>
                                            <Button
                                                variant="success"
                                                onClick={() => console.log('Marcar como resuelto', selectedIncident.id)}
                                            >
                                                Marcar como resuelto
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                onClick={() => console.log('Marcar como falsa alarma', selectedIncident.id)}
                                            >
                                                Falsa alarma
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-16 text-center text-gray-500">
                            <Video size={48} className="mx-auto mb-4 text-gray-300" />
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