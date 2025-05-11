import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('violence_detector_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const fetchIncidents = async (params = {}) => {
    try {
        const response = await api.get('/incidents', { params });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener incidentes');
    }
};

export const updateIncidentStatus = async (id, status) => {
    try {
        const response = await api.patch(`/incidents/${id}/status`, { status });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al actualizar estado');
    }
};

export const getStreamStatus = async () => {
    try {
        const response = await api.get('/stream/status');
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener estado del stream');
    }
};

export const fetchStats = async (period) => {
    try {
        const response = await api.get(`/stats/${period}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener estadísticas');
    }
};

export const fetchConfig = async () => {
    try {
        const response = await api.get('/config');
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al obtener configuración');
    }
};

export const updateConfig = async (config) => {
    try {
        const response = await api.patch('/config', config, {
            cancelToken: new axios.CancelToken((c) => {
                config.cancel = c;
            }),
        });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            throw new Error('Petición cancelada');
        }
        throw new Error(error.response?.data?.message || 'Error al actualizar configuración');
    }
};