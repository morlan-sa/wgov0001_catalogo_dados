import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ScanSearch, Boxes, Database } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', description: 'Visão geral da governança', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Catálogo', description: 'Schemas e tabelas do DB2', icon: BookOpen },
  { to: '/scanner', label: 'Scanner', description: 'Selecionar schemas para explorar', icon: ScanSearch },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-screen">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-200">
        <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0">
          <Database size={18} />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800 leading-tight">Portal Governança</div>
          <div className="text-xs text-slate-500 leading-tight">Governança de Dados</div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, description, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block font-medium">{label}</span>
                  <span className={`block text-xs ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {description}
                  </span>
                </span>
              </>
            )}
          </NavLink>
        ))}
        <div className="flex items-start gap-2 px-3 py-2 rounded-md text-sm text-slate-300 cursor-not-allowed">
          <Boxes size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="block font-medium">Domínios</span>
            <span className="block text-xs">em breve</span>
          </span>
        </div>
      </nav>
    </aside>
  );
}
