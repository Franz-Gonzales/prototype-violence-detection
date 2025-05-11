import React, { useState, memo } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { HomeIcon, ExclamationTriangleIcon, CogIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import Notifications from './Notifications';
import { useNotificationStore } from '../store/useNotificationStore';
import Button from './common/Button';
import Card from './common/Card';

const Layout = memo(() => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const unreadCount = useNotificationStore((state) => state.unreadCount);
    const navigate = useNavigate();
    const user = localStorage.getItem('violence_detector_user') || null; // Asumiendo autenticación

    const navLinks = [
        { to: '/', label: 'Monitor en Vivo', icon: <HomeIcon className="h-5 w-5" /> },
        { to: '/incidents', label: 'Incidentes', icon: <ExclamationTriangleIcon className="h-5 w-5" /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-gray-100">
            {/* Sidebar para móvil */}
            <div
                className={`fixed inset-0 z-40 flex md:hidden ${sidebarOpen ? 'block' : 'hidden'} animate-slide-in`}
                onClick={() => setSidebarOpen(false)}
            >
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75" aria-hidden="true" />
                <div className="relative flex flex-col flex-1 w-full max-w-xs pt-5 pb-4 bg-white">
                    <div className="absolute top-0 right-0 p-1">
                        <button
                            className="flex items-center justify-center w-10 h-10 rounded-md text-gray-400 hover:text-gray-500"
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Cerrar menú"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex items-center justify-center flex-shrink-0 px-4">
                        <h1 className="text-xl font-bold text-primary-600">Detector de Violencia</h1>
                    </div>
                    <div className="flex-1 h-0 mt-5 overflow-y-auto">
                        <nav className="px-2 space-y-1" role="navigation">
                            {navLinks.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className={({ isActive }) =>
                                        `group flex items-center px-2 py-2 text-base font-medium rounded-md ${isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`
                                    }
                                    end
                                >
                                    <div className="mr-4">{link.icon}</div>
                                    {link.label}
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>

            {/* Sidebar para desktop */}
            <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                    <div className="flex flex-col flex-1 h-0 bg-white border-r border-gray-200">
                        <div className="flex items-center justify-center h-16 flex-shrink-0 px-4 bg-primary-600">
                            <h1 className="text-xl font-bold text-white">Detector de Violencia</h1>
                        </div>
                        <div className="flex flex-col flex-1 pt-5 pb-4 overflow-y-auto">
                            <nav className="flex-1 px-2 space-y-1 bg-white" role="navigation">
                                {navLinks.map((link) => (
                                    <NavLink
                                        key={link.to}
                                        to={link.to}
                                        className={({ isActive }) =>
                                            `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`
                                        }
                                        end
                                    >
                                        <div className="mr-3">{link.icon}</div>
                                        {link.label}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex flex-col flex-1 w-0 overflow-hidden">
                {/* Barra superior */}
                <div className="relative z-10 flex flex-shrink-0 h-16 bg-white shadow">
                    <button
                        className="px-4 text-gray-500 md:hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Abrir menú"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                    <div className="flex justify-between flex-1 px-4">
                        <div className="flex flex-1"></div>
                        <div className="flex items-center ml-4 md:ml-6 space-x-4">
                            {user && (
                                <div className="flex items-center">
                                    <span className="text-sm text-gray-600 mr-2">Bienvenido, {user}</span>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            localStorage.removeItem('violence_detector_user');
                                            localStorage.removeItem('violence_detector_token');
                                            navigate('/login');
                                        }}
                                    >
                                        Cerrar sesión
                                    </Button>
                                </div>
                            )}
                            <Notifications />
                            <button
                                className="p-1 text-gray-400 bg-white rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                onClick={() => setSettingsOpen(true)}
                                aria-label="Abrir configuración"
                            >
                                <CogIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Área de contenido principal */}
                <main className="relative flex-1 overflow-y-auto focus:outline-none">
                    <div className="py-6">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Modal de configuración */}
            {settingsOpen && (
                <div className="modal">
                    <Card className="w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Configuración</h2>
                            <button
                                className="text-gray-400 hover:text-gray-500"
                                onClick={() => setSettingsOpen(false)}
                                aria-label="Cerrar configuración"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                // Implementar actualización de configuración
                                setSettingsOpen(false);
                            }}
                        >
                            <div className="mb-4">
                                <label htmlFor="violenceThreshold" className="block text-sm font-medium text-gray-700">
                                    Umbral de violencia (%)
                                </label>
                                <input
                                    type="number"
                                    id="violenceThreshold"
                                    defaultValue={70}
                                    min={0}
                                    max={100}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div className="mb-4">
                                <label htmlFor="frameResolution" className="block text-sm font-medium text-gray-700">
                                    Resolución de la cámara
                                </label>
                                <select
                                    id="frameResolution"
                                    defaultValue="1280x720"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="640x480">640x480</option>
                                    <option value="1280x720">1280x720</option>
                                    <option value="1920x1080">1920x1080</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-2">
                                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" type="submit">
                                    Guardar
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
});

export default Layout;