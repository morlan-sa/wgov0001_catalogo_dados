import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ScannerPage from './pages/ScannerPage.jsx';
import CatalogSchemasPage from './pages/CatalogSchemasPage.jsx';
import CatalogTablesPage from './pages/CatalogTablesPage.jsx';
import CatalogTableDetailPage from './pages/CatalogTableDetailPage.jsx';
import DomainsPage from './pages/DomainsPage.jsx';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/catalogo" element={<CatalogSchemasPage />} />
          <Route path="/catalogo/:schema" element={<CatalogTablesPage />} />
          <Route path="/catalogo/:schema/:table" element={<CatalogTableDetailPage />} />
          <Route path="/dominios" element={<DomainsPage />} />
        </Routes>
      </main>
    </div>
  );
}
