export default function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-[140px] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-500">{label}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
