import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Limitar a las 50 notificaciones más recientes
const MAX_NOTIFICATIONS = 50;

// Store para gestionar notificaciones
const useNotificationStore = create(
    persist(
        (set, get) => ({
            // Estado
            notifications: [],
            unreadCount: 0,

            // Acciones
            addNotification: (notification) => {
                // Preparar notificación
                const newNotification = {
                    ...notification,
                    read: false,
                    timestamp: new Date(),
                };

                // Actualizar estado
                set((state) => {
                    // Añadir al inicio, mantener límite
                    const updatedNotifications = [
                        newNotification,
                        ...state.notifications,
                    ].slice(0, MAX_NOTIFICATIONS);

                    return {
                        notifications: updatedNotifications,
                        unreadCount: state.unreadCount + 1,
                    };
                });
            },

            markAsRead: (index) => {
                set((state) => {
                    // Clonar array
                    const updatedNotifications = [...state.notifications];

                    // Si la notificación no estaba leída, reducir contador
                    let newUnreadCount = state.unreadCount;
                    if (!updatedNotifications[index].read) {
                        newUnreadCount -= 1;
                    }

                    // Marcar como leída
                    updatedNotifications[index] = {
                        ...updatedNotifications[index],
                        read: true,
                    };

                    return {
                        notifications: updatedNotifications,
                        unreadCount: Math.max(0, newUnreadCount),
                    };
                });
            },

            markAllAsRead: () => {
                set((state) => ({
                    notifications: state.notifications.map(notification => ({
                        ...notification,
                        read: true,
                    })),
                    unreadCount: 0,
                }));
            },

            clearNotifications: () => {
                set({ notifications: [], unreadCount: 0 });
            },
        }),
        {
            name: 'violence-detector-notifications',
            getStorage: () => localStorage,
        }
    )
);

export { useNotificationStore };