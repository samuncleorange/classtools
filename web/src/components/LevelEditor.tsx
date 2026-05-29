import { useEffect, useState } from 'react';
import { useLevels, useSaveLevels } from '../lib/levels';

export function LevelEditor({ classId }: { classId: number }) {
  const { data: levels = [] } = useLevels(classId);
  const save = useSaveLevels(classId);
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    if (levels.length === 9) {
      setValues([...levels].sort((a, b) => a.level - b.level).map((l) => l.required_points));
    }
  }, [levels]);

  if (values.length !== 9) return <p className="text-sm text-slate-400">加载中…</p>;

  const monotonic = values.every((v, i) => i === 0 ? v === 0 : v >= values[i - 1]);

  function setAt(i: number, v: number) {
    setValues((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">设置各等级所需「成长值」。Lv.1 固定为 0,数值需随等级递增。</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {values.map((v, i) => (
          <label key={i} className="text-xs text-slate-500">
            Lv.{i + 1}
            <input
              type="number"
              min={0}
              value={v}
              disabled={i === 0}
              onChange={(e) => setAt(i, Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
            />
          </label>
        ))}
      </div>
      {!monotonic && <p className="mt-2 text-sm text-lose-500">数值必须随等级递增,且 Lv.1 为 0。</p>}
      <div className="mt-4 text-right">
        <button
          onClick={() => save.mutate(values.map((required_points, i) => ({ level: i + 1, required_points })))}
          disabled={!monotonic || save.isPending}
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          保存等级设置
        </button>
      </div>
    </div>
  );
}
