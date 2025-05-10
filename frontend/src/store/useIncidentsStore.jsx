import { create } from 'zustand';

const useIncidentsStore = create((set) => ({
    // Estado
    incidents: [],
    loading: false,
    error: null,

    // Acciones
    setIncidents: (incidents) => set({ incidents }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    updateIncidentStatus: (id, status) => {
        set((state) => ({
            incidents: state.incidents.map(incident =>
                incident.id === id ? { ...incident, status } : incident
            )
        }));
    },

    resetError: () => set({ error: null }),
}));

export { useIncidentsStore };