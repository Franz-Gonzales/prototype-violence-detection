import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        // Simulación de autenticación (reemplazar con API real)
        if (username && password) {
            localStorage.setItem('violence_detector_token', 'mock-token');
            localStorage.setItem('violence_detector_user', username);
            toast.success('Inicio de sesión exitoso');
            navigate('/');
        } else {
            toast.error('Por favor, complete todos los campos');
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <Helmet>
                <title>Iniciar Sesión | Detector de Violencia</title>
                <meta name="description" content="Iniciar sesión en el sistema de detección de violencia" />
            </Helmet>
            <Card className="w-full max-w-md">
                <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">Iniciar Sesión</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                            Usuario
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                            required
                        />
                    </div>
                    <Button variant="primary" type="submit" className="w-full">
                        Iniciar Sesión
                    </Button>
                </form>
            </Card>
        </div>
    );
}

export default Login;