import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import Button from '../components/common/Button';

function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
            <Helmet>
                <title>Página No Encontrada | Detector de Violencia</title>
                <meta name="description" content="La página solicitada no existe" />
            </Helmet>
            <ExclamationCircleIcon className="h-16 w-16 text-gray-400 mb-4" />
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">404 - Página No Encontrada</h1>
            <p className="text-gray-600 mb-6">La página que estás buscando no existe o ha sido movida.</p>
            <Link to="/">
                <Button variant="primary">Volver al Inicio</Button>
            </Link>
        </div>
    );
}

export default NotFoundPage;