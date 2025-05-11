import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Home = lazy(() => import('./pages/Home'));
const Incidents = lazy(() => import('./pages/Incidents'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const IncidentDetails = lazy(() => import('./components/IncidentDetails'));

function App() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Cargando...</div>}>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="incidents" element={<Incidents />} />
                    <Route path="incidents/:id" element={<IncidentDetails />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Routes>
        </Suspense>
    );
}

export default App;