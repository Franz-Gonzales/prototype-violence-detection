import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertCircle } from 'react-feather';
import { format } from 'date-fns';
import { useNotificationStore } from '../store/useNotificationStore';

function Notifications() {
    const { notifications, unreadCount, markAllAsRead } = useNotificationStore();
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef(null);

    // Manejar clic fuera del componente para cerrarlo
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [notificationRef]);

    // Marcar como leídas al cerrar
    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (isOpen) {
            markAllAsRead();
        }
    };

    // Obtener icono según el tipo de notificación
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'violence':
                return <AlertCircle size={20} className="text-danger-500" />;
            default:
                return <Bell size={20} className="text-primary-500" />;
        }
    };

    return (
        <div className="relative" ref={notificationRef}>
            <button
                onClick={handleToggle}
                className="p-1 text-gray-400 rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    // absolute top-0 right-0 block h-4
                    <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-danger-500 text-white text-xs font-bold flex items-center justify-center transform translate-x-1 -translate-y-1">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50">
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium text-gray-700">Notificaciones</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-primary-600 hover:text-primary-800"
                                >
                                    Marcar todas como leídas
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-6 text-center text-gray-500">
                                <Bell size={24} className="mx-auto mb-2 text-gray-300" />
                                <p>No hay notificaciones</p>
                            </div>
                        ) : (
                            <ul>
                                {notifications.map((notification, index) => (
                                    <li
                                        key={index}
                                        className={`p-3 border-b border-gray-100 last:border-b-0 ${notification.read ? 'bg-white' : 'bg-gray-50'}`}
                                    >
                                        <div className="flex">
                                            <div className="flex-shrink-0 mr-3">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {notification.message}
                                                </p>
                                                {notification.details && (
                                                    <p className="text-sm text-gray-500">
                                                        {notification.details}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {format(new Date(notification.timestamp), 'HH:mm:ss')}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Notifications;