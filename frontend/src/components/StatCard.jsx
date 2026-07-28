const TONE_STYLES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  green: 'bg-emerald-50 text-emerald-600',
  sky: 'bg-sky-50 text-sky-600',
  purple: 'bg-purple-50 text-purple-600',
  amber: 'bg-amber-50 text-amber-600',
};

export default function StatCard({ label, value, icon: Icon, tone = 'indigo' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex-1 min-w-[140px] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500">{label}</div>
        {Icon && (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              TONE_STYLES[tone] || TONE_STYLES.indigo
            }`}
          >
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
    </div>
  );
}
