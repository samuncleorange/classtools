import { usePointItems } from '../lib/pointItems';
import { useAwardBatch } from '../lib/award';

export function BatchPointsBar({
  classId,
  selectedIds,
  onDone,
}: {
  classId: number;
  selectedIds: number[];
  onDone: () => void;
}) {
  const { data: items = [] } = usePointItems(classId);
  const batch = useAwardBatch(classId);
  if (selectedIds.length === 0) return null;

  function apply(itemId: number) {
    batch.mutate({ studentIds: selectedIds, itemId }, { onSuccess: onDone });
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-brand-200">
      <div className="mb-2 text-center text-sm font-medium text-slate-600">已选 {selectedIds.length} 人 · 点选项目批量加减分</div>
      <div className="flex flex-wrap justify-center gap-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => apply(it.id)}
            disabled={batch.isPending}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 disabled:opacity-50 ${
              it.kind === 'add' ? 'bg-gain-50 text-gain-700 ring-gain-200' : 'bg-lose-50 text-lose-700 ring-lose-200'
            }`}
          >
            {it.icon} {it.label} {it.kind === 'add' ? '+' : '-'}{it.points}
          </button>
        ))}
      </div>
    </div>
  );
}
