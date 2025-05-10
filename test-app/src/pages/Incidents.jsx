import React from 'react';
import IncidentList from '../components/IncidentList';

function Incidents() {
    return (
        <div className="container px-4 mx-auto">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">Historial de Incidentes</h1>
            <IncidentList />
        </div>
    );
}

export default Incidents;