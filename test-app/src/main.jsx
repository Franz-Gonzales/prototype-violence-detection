import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/globals.css';

const App = lazy(() => import('./App'));

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <HelmetProvider>
                <BrowserRouter>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Cargando...</div>}>
                        <App />
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                duration: 4000,
                                style: {
                                    border: '1px solid #0ea5e9',
                                    padding: '12px',
                                    color: '#075985',
                                    background: '#f0f9ff',
                                },
                            }}
                        />
                    </Suspense>
                </BrowserRouter>
            </HelmetProvider>
        </ErrorBoundary>
    </React.StrictMode>,
);