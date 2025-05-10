import axios from 'axios';

// Cliente API
const apiClient = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptores para manejar errores
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

// Función para obtener incidentes
export const fetchIncidents = async (params = {}) => {
    try {
        const response = await apiClient.get('/incidents', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching incidents:', error);
        throw error;
    }
};

// Función para obtener un incidente por ID
export const fetchIncidentById = async (id) => {
    try {
        const response = await apiClient.get(`/incidents/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching incident #${id}:`, error);
        throw error;
    }
};


// Función para actualizar estado de un incidente
export const updateIncidentStatus = async (id, status) => {
    try {
        const response = await apiClient.put(`/incidents/${id}?status=${status}`);
        return response.data;
    } catch (error) {
        console.error(`Error updating incident #${id}:`, error);
        throw error;
    }
};

// Función para obtener estado del stream
export const fetchStreamStatus = async () => {
    try {
        const response = await apiClient.get('/stream/status');
        return response.data;
    } catch (error) {
        console.error('Error fetching stream status:', error);
        throw error;
    }
};

// Función para obtener estadísticas
export const fetchStats = async (period = 'today') => {
    try {
        const response = await apiClient.get(`/stats/${period}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${period} stats:`, error);
        throw error;
    }
};

// Función para obtener configuración
export const fetchSettings = async () => {
    try {
        const response = await apiClient.get('/settings');
        return response.data;
    } catch (error) {
        console.error('Error fetching settings:', error);
        throw error;
    }
};

// Función para actualizar configuración
export const updateSetting = async (key, value) => {
    try {
        const response = await apiClient.put(`/settings/${key}`, { value });
        return response.data;
    } catch (error) {
        console.error(`Error updating setting ${key}:`, error);
        throw error;
    }
};

export default apiClient;