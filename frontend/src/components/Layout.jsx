import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Camera, AlertTriangle, Settings, Menu, X } from 'react-feather';
import Notifications from './Notifications';
import { useNotificationStore } from '../store/useNotificationStore';

function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const unreadCount = useNotificationStore((state) => state.unreadCount);

    const navLinks = [
        { to: '/', label: 'Monitor en Vivo', icon: <Camera size={20} /> },
        { to: '/incidents', label: 'Incidentes', icon: <AlertTriangle size={20} /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-gray-100">
            {/* Sidebar para móvil */}
            <div
                className={`fixed inset-0 z-40 flex md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setSidebarOpen(false)}
            >
                <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
                <div className="relative flex flex-col flex-1 w-full max-w-xs pt-5 pb-4 bg-white">
                    <div className="absolute top-0 right-0 p-1">
                        <button
                            className="flex items-center justify-center w-10 h-10 rounded-md text-gray-400 hover:text-gray-500"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="flex items-center justify-center flex-shrink-0 px-4">
                        <h1 className="text-xl font-bold text-primary-600">Detector de Violencia</h1>
                    </div>
                    <div className="flex-1 h-0 mt-5 overflow-y-auto">
                        <nav className="px-2 space-y-1">
                            {navLinks.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className={({ isActive }) =>
                                        `group flex items-center px-2 py-2 text-base font-medium rounded-md ${isActive
                                            ? 'bg-primary-50 text-primary-600'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                            <nav className="flex-1 px-2 space-y-1 bg-white">
                                {navLinks.map((link) => (
                                    <NavLink
                                        key={link.to}
                                        to={link.to}
                                        className={({ isActive }) =>
                                            `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                                                ? 'bg-primary-50 text-primary-600'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                    >
                        <Menu size={24} />
                    </button>
                    <div className="flex justify-between flex-1 px-4">
                        <div className="flex flex-1"></div>
                        <div className="flex items-center ml-4 md:ml-6 space-x-4">
                            {/* Icono de notificaciones */}
                            <Notifications />

                            {/* Icono de configuración */}
                            <button className="p-1 text-gray-400 bg-white rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                                <Settings size={20} />
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
        </div>
    );
}

export default Layout;