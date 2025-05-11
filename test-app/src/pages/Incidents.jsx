import React from 'react';
import { Helmet } from 'react-helmet-async';
import IncidentList from '../components/IncidentList';

function Incidents() {
    return (
        <div className="container px-4 mx-auto">
            <Helmet>
                <title>Historial de Incidentes | Detector de Violencia</title>
                <meta name="description" content="Historial de incidentes detectados por el sistema de detección de violencia" />
            </Helmet>
            <header role="banner">
                <h1 className="text-2xl font-semibold text-gray-900 mb-6">Historial de Incidentes</h1>
            </header>
            <IncidentList />
        </div>
    );
}

export default Incidents;