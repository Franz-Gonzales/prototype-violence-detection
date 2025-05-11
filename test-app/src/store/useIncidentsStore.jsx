import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchIncidents as fetchIncidentsAPI, updateIncidentStatus as updateIncidentStatusAPI } from '../utils/api';
import toast from 'react-hot-toast';

export const useIncidentsStore = create(
    persist(
        (set, get) => ({
            incidents: [],
            loading: false,
            error: null,

            fetchIncidents: async (params = {}) => {
                set({ loading: true, error: null });
                try {
                    const data = await fetchIncidentsAPI(params);
                    const validIncidents = data.filter(
                        (incident) => incident.id && incident.timestamp && typeof incident.violence_score === 'number'
                    );
                    set({ incidents: validIncidents, loading: false });
                } catch (err) {
                    const errorMessage = err.response?.data?.message || 'Error al cargar incidentes';
                    set({ error: errorMessage, loading: false });
                    throw err;
                }
            },

            setIncidents: (newIncidents) => {
                const validIncidents = newIncidents.filter(
                    (incident) => incident.id && incident.timestamp && typeof incident.violence_score === 'number'
                );
                set({ incidents: validIncidents });
            },

            updateIncidentStatus: async (id, status) => {
                try {
                    await updateIncidentStatusAPI(id, status);
                    set((state) => ({
                        incidents: state.incidents.map((incident) =>
                            incident.id === id ? { ...incident, status } : incident
                        ),
                    }));
                } catch (err) {
                    const errorMessage = err.response?.data?.message || 'Error al actualizar estado';
                    toast.error(errorMessage);
                    throw err;
                }
            },

            subscribeToIncidents: (socket) => {
                if (socket) {
                    socket.on('incident', (data) => {
                        if (data.id && data.timestamp && typeof data.violence_score === 'number') {
                            set((state) => ({
                                incidents: [data, ...state.incidents.slice(0, 49)],
                            }));
                        }
                    });
                }
            },
        }),
        {
            name: 'incidents-storage',
            partialize: (state) => ({ incidents: state.incidents.slice(0, 10) }), // Persistir solo 10 incidentes
        }
    )
);