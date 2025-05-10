import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Incidents from './pages/Incidents';

function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="incidents" element={<Incidents />} />
            </Route>
        </Routes>
    );
}

export default App;