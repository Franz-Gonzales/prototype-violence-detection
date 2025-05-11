import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const backendUrl = 'http://localhost:8000'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target: backendUrl,
                changeOrigin: true,
                secure: false,
                onError: (err) => console.error('Error de proxy /api:', err),
            },
            '/ws': {
                target: backendUrl.replace('http', 'ws'),
                ws: true,
                changeOrigin: true,
                timeout: 5000,
                pingInterval: 30000,
                onError: (err) => console.error('Error de proxy /ws:', err),
            }
        }
    },
    build: {
        minify: 'terser',
    },
    css: {
        postcss: './postcss.config.js',
    },
})