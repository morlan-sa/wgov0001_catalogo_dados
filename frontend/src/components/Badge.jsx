const COLOR_BY_CLASSIFICATION = {
  Sigiloso: 'bg-red-100 text-red-700',
  Restrito: 'bg-amber-100 text-amber-700',
  Corporativo: 'bg-blue-100 text-blue-700',
  Público: 'bg-emerald-100 text-emerald-700',
  'Não classificado': 'bg-slate-100 text-slate-500',
};

export default function Badge({ children }) {
  const classes = COLOR_BY_CLASSIFICATION[children] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}
