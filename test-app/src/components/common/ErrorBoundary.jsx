import React, { Component } from 'react';
import Button from './Button';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

class ErrorBoundary extends Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
                    <ExclamationCircleIcon className="h-16 w-16 text-danger-600 mb-4" />
                    <h1 className="text-2xl font-semibold text-gray-900 mb-2">Algo salió mal</h1>
                    <p className="text-gray-600 mb-4">{this.state.error?.message || 'Error desconocido'}</p>
                    <Button
                        variant="primary"
                        onClick={() => window.location.reload()}
                    >
                        Reintentar
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;