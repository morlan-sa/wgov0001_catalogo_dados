import { Link } from 'react-router-dom';

export default function Breadcrumb({ items }) {
  return (
    <nav className="text-sm text-slate-500 mb-4 flex items-center gap-1 flex-wrap">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-blue-700 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-blue-700 font-semibold' : ''}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300">›</span>}
          </span>
        );
      })}
    </nav>
  );
}
