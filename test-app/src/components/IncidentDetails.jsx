import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { VideoCameraIcon, UserIcon } from '@heroicons/react/24/outline';
import Button from './common/Button';
import { updateIncidentStatus } from '../utils/api';
import toast from 'react-hot-toast';

function IncidentDetails({ incident, updateLocalStatus }) {
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

    const handleStatusUpdate = async (status) => {
        try {
            await updateIncidentStatus(incident.id, status);
            updateLocalStatus(incident.id, status);
            toast.success(`Incidente marcado como ${translateStatus(status)}`);
        } catch (err) {
            toast.error('Error al actualizar el estado');
        }
    };

    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                    Detalles del Incidente #{incident.id}
                </h2>
                <span className={`badge ${getStatusClass(incident.status)}`}>
                    {translateStatus(incident.status)}
                </span>
            </div>

            <div className="bg-gray-900 rounded-lg overflow-hidden mb-6">
                <video
                    className="w-full"
                    controls
                    src={`/api/incidents/${incident.id}/clip`}
                    poster={incident.frame_path}
                    style={{ aspectRatio: '16/9' }}
                    onError={() => toast.error('Error al cargar el video')}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-700 mb-2">Detalles</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Fecha y hora:</span>
                            <span className="font-medium">{formatDate(incident.timestamp)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Ubicación:</span>
                            <span className="font-medium">{incident.location || 'No especificada'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Nivel de violencia:</span>
                            <span className="font-medium">{(incident.violence_score * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-700 mb-2">Personas involucradas</h3>
                    {incident.persons && incident.persons.length > 0 ? (
                        <div className="max-h-32 overflow-y-auto pr-2">
                            {incident.persons.map((person) => (
                                <div
                                    key={person.id}
                                    className="flex items-center py-1 border-b border-gray-200 last:border-0"
                                >
                                    <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                                    <span className="text-gray-600">ID de persona: {person.person_id}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No hay información de personas</p>
                    )}
                </div>
            </div>

            <div className="border-t border-gray-200 pt-4 flex justify-between">
                <div>
                    <Button
                        variant="secondary"
                        onClick={() => window.open(`/api/incidents/${incident.id}/clip`, '_blank')}
                        icon={<VideoCameraIcon className="h-4 w-4" />}
                    >
                        Descargar video
                    </Button>
                </div>
                <div className="space-x-2">
                    {incident.status === 'new' && (
                        <>
                            <Button
                                variant="success"
                                onClick={() => handleStatusUpdate('resolved')}
                            >
                                Marcar como resuelto
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => handleStatusUpdate('false_alarm')}
                            >
                                Falsa alarma
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

export default IncidentDetails;