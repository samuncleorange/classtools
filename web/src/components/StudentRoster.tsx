import { useState } from 'react';
import {
  useStudents,
  useAddStudent,
  useBatchAddStudents,
  useDeleteStudent,
  useResetPoints,
  useAssignGroup,
} from '../lib/students';
import { useGroups } from '../lib/groups';

export function StudentRoster({ classId }: { classId: number }) {
  const { data: students = [] } = useStudents(classId);
  const { data: groups = [] } = useGroups(classId);
  const addStudent = useAddStudent(classId);
  const batchAdd = useBatchAddStudents(classId);
  const deleteStudent = useDeleteStudent(classId);
  const resetPoints = useResetPoints(classId);
  const assignGroup = useAssignGroup(classId);

  const [single, setSingle] = useState('');
  const [batchText, setBatchText] = useState('');
  const [showBatch, setShowBatch] = useState(false);

  function addOne() {
    const n = single.trim();
    if (!n) return;
    addStudent.mutate(n, { onSuccess: () => setSingle('') });
  }

  function addMany() {
    const names = batchText
      .split(/[\n,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    batchAdd.mutate(names, {
      onSuccess: () => {
        setBatchText('');
        setShowBatch(false);
      },
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addOne()}
          placeholder="输入学生姓名"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          onClick={addOne}
          disabled={addStudent.isPending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          添加
        </button>
        <button
          onClick={() => setShowBatch((s) => !s)}
          className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
        >
          批量
        </button>
      </div>

      {showBatch && (
        <div className="mb-4 rounded-lg bg-brand-50/60 p-3">
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={4}
            placeholder="每行一个名字，或用逗号/空格分隔"
            className="w-full rounded-lg border border-slate-200 p-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="mt-2 text-right">
            <button
              onClick={addMany}
              disabled={batchAdd.isPending}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              批量添加
            </button>
          </div>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-600">学生名单 ({students.length})</h3>
      <ul className="space-y-2">
        {students.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="flex-1 text-sm text-slate-700">{s.name}</span>
            <select
              value={s.group_id ?? ''}
              onChange={(e) =>
                assignGroup.mutate({ id: s.id, group_id: e.target.value ? Number(e.target.value) : null })
              }
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              aria-label={`${s.name} 的分组`}
            >
              <option value="">未分组</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const url = `${window.location.origin}/parent/${s.parent_token}`;
                navigator.clipboard?.writeText(url);
                alert(`已复制「${s.name}」的家长链接:\n${url}`);
              }}
              className="text-xs text-brand-600 hover:text-brand-700"
            >
              家长链接
            </button>
            <button
              onClick={() => {
                if (confirm(`确定将「${s.name}」的积分清零？此操作不可撤销。`)) resetPoints.mutate(s.id);
              }}
              className="text-xs text-accent-600 hover:text-accent-700"
            >
              重置积分
            </button>
            <button
              onClick={() => {
                if (confirm(`确定删除学生「${s.name}」？`)) deleteStudent.mutate(s.id);
              }}
              className="text-xs text-lose-500 hover:text-lose-600"
              aria-label={`删除 ${s.name}`}
            >
              删除
            </button>
          </li>
        ))}
        {students.length === 0 && <li className="py-6 text-center text-sm text-slate-400">还没有学生,先添加吧</li>}
      </ul>
    </div>
  );
}
