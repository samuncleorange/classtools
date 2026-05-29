import { useState } from 'react';
import { useGroups, useCreateGroup, useDeleteGroup } from '../lib/groups';

export function GroupManager({ classId }: { classId: number }) {
  const { data: groups = [] } = useGroups(classId);
  const createGroup = useCreateGroup(classId);
  const deleteGroup = useDeleteGroup(classId);
  const [name, setName] = useState('');

  function add() {
    const n = name.trim();
    if (!n) return;
    createGroup.mutate(n, { onSuccess: () => setName('') });
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="新分组名称"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          onClick={add}
          disabled={createGroup.isPending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          添加分组
        </button>
      </div>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">{g.name}</span>
            <button
              onClick={() => {
                if (confirm(`确定删除分组「${g.name}」？组内学生将变为未分组。`)) deleteGroup.mutate(g.id);
              }}
              className="text-lose-500 hover:text-lose-600"
              aria-label={`删除分组 ${g.name}`}
            >
              删除
            </button>
          </li>
        ))}
        {groups.length === 0 && <li className="text-sm text-slate-400">还没有分组</li>}
      </ul>
    </div>
  );
}
