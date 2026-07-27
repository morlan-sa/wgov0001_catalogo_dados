import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, ScanSearch, Boxes } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { to: '/scanner', label: 'Scanner', icon: ScanSearch },
];

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-[#1A3A5C] text-white flex flex-col min-h-screen">
      <div className="px-4 py-5 text-lg font-bold tracking-wide border-b border-white/10">
        Portal Governança
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-white/15 font-semibold' : 'text-white/85 hover:bg-white/10'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/40 cursor-not-allowed">
          <Boxes size={16} />
          Domínios
          <span className="text-[10px] ml-auto">em breve</span>
        </div>
      </nav>
    </aside>
  );
}
