import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useNotificationStore } from '../store/useNotificationStore';
import Button from './common/Button';

function Notifications() {
    const { notifications, unreadCount, markAllAsRead, addNotification } = useNotificationStore();
    const [isOpen, setIsOpen] = useState(false);
    const notificationRef = useRef(null);

    // Limpiar notificaciones antiguas
    useEffect(() => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        notifications.forEach((notification, index) => {
            if (new Date(notification.timestamp) < weekAgo) {
                addNotification({ ...notification, read: true }); // Marcar como leída
            }
        });
    }, [notifications, addNotification]);

    // Manejar clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (isOpen) markAllAsRead();
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'violence': return <ExclamationCircleIcon className="h-5 w-5 text-danger-500" />;
            default: return <BellIcon className="h-5 w-5 text-primary-500" />;
        }
    };

    const removeNotification = (index) => {
        const newNotifications = [...notifications];
        newNotifications.splice(index, 1);
        useNotificationStore.setState({
            notifications: newNotifications,
            unreadCount: newNotifications.filter(n => !n.read).length,
        });
    };

    return (
        <div className="relative" ref={notificationRef}>
            <button
                onClick={handleToggle}
                className="p-1 text-gray-400 rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                aria-label="Abrir notificaciones"
            >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-danger-500 text-white text-xs font-bold flex items-center justify-center transform translate-x-1 -translate-y-1">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 animate-fade-in"
                    role="dialog"
                    aria-labelledby="notifications-title"
                >
                    <div className="p-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                            <h3 id="notifications-title" className="text-sm font-medium text-gray-700">Notificaciones</h3>
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
                                <BellIcon className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                                <p>No hay notificaciones</p>
                            </div>
                        ) : (
                            <ul role="list">
                                {notifications.map((notification, index) => (
                                    <li
                                        key={index}
                                        className={`p-3 border-b border-gray-100 last:border-b-0 ${notification.read ? 'bg-white' : 'bg-gray-50'}`}
                                        role="listitem"
                                    >
                                        <div className="flex">
                                            <div className="flex-shrink-0 mr-3">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {notification.incidentId ? (
                                                    <Link
                                                        to={`/incidents/${notification.incidentId}`}
                                                        className="text-sm font-medium text-gray-900 hover:text-primary-600"
                                                    >
                                                        {notification.message}
                                                    </Link>
                                                ) : (
                                                    <p className="text-sm font-medium text-gray-900">{notification.message}</p>
                                                )}
                                                {notification.details && (
                                                    <p className="text-sm text-gray-500">{notification.details}</p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {format(new Date(notification.timestamp), 'HH:mm:ss')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => removeNotification(index)}
                                                className="ml-2 text-gray-400 hover:text-gray-600"
                                                aria-label="Eliminar notificación"
                                            >
                                                <XMarkIcon className="h-4 w-4" />
                                            </button>
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