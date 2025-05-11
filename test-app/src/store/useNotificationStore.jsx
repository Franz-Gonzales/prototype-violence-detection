import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { debounce } from 'lodash';

export const useNotificationStore = create(
    persist(
        (set, get) => ({
            notifications: [],
            unreadCount: 0,

            addNotification: (notification) => {
                if (!notification.message || !notification.timestamp) return;
                const newNotification = {
                    ...notification,
                    read: false,
                    incidentId: notification.incidentId || null,
                };
                set((state) => {
                    const newNotifications = [newNotification, ...state.notifications.slice(0, 49)];
                    // Limpiar notificaciones antiguas
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    const filteredNotifications = newNotifications.filter(
                        (n) => new Date(n.timestamp) >= weekAgo
                    );
                    return {
                        notifications: filteredNotifications,
                        unreadCount: filteredNotifications.filter((n) => !n.read).length,
                    };
                });
            },

            markAllAsRead: () => {
                set((state) => ({
                    notifications: state.notifications.map((n) => ({ ...n, read: true })),
                    unreadCount: 0,
                }));
            },

            removeNotification: (index) => {
                set((state) => {
                    const newNotifications = [...state.notifications];
                    newNotifications.splice(index, 1);
                    return {
                        notifications: newNotifications,
                        unreadCount: newNotifications.filter((n) => !n.read).length,
                    };
                });
            },
        }),
        {
            name: 'notifications-storage',
            partialize: (state) => ({ notifications: state.notifications, unreadCount: state.unreadCount }),
            onRehydrateStorage: () => {
                return (state) => {
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    state.setState({
                        notifications: state.notifications.filter(
                            (n) => new Date(n.timestamp) >= weekAgo
                        ),
                        unreadCount: state.notifications.filter((n) => !n.read).length,
                    });
                };
            },
        }
    )
);

// Debounce para escrituras en localStorage
const debouncedSetState = debounce((state) => useNotificationStore.setState(state), 500);
useNotificationStore.setState = (state) => debouncedSetState(state);