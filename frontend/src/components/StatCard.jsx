export default function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex-1 min-w-[140px]">
      <div className="text-2xl font-bold text-[#1A3A5C]">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
