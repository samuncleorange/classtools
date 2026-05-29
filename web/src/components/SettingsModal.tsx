import { useState } from 'react';
import { Modal } from './Modal';
import { StudentRoster } from './StudentRoster';
import { GroupManager } from './GroupManager';
import { useCurrentClass } from '../state/CurrentClass';
import { useCreateClass, useUpdateClass, useDeleteClass } from '../lib/classes';

type Tab = 'roster' | 'groups' | 'class';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, classes, setCurrentId } = useCurrentClass();
  const [tab, setTab] = useState<Tab>('roster');
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const [newClassName, setNewClassName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  function addClass() {
    const n = newClassName.trim();
    if (!n) return;
    createClass.mutate(n, {
      onSuccess: (c) => {
        setNewClassName('');
        setCurrentId(c.id);
      },
    });
  }

  return (
    <Modal open={open} title="设置" onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-slate-100 text-sm">
        {([
          ['roster', '学生名单'],
          ['groups', '分组'],
          ['class', '班级设置'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 font-medium ${
              tab === key ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!current && tab !== 'class' && (
        <p className="py-6 text-center text-sm text-slate-400">请先在「班级设置」创建一个班级</p>
      )}

      {tab === 'roster' && current && <StudentRoster classId={current.id} />}
      {tab === 'groups' && current && <GroupManager classId={current.id} />}

      {tab === 'class' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-600">新建班级</h3>
            <div className="flex gap-2">
              <input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addClass()}
                placeholder="班级名称,如 五年级2班"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button onClick={addClass} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                创建
              </button>
            </div>
          </div>

          {current && (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">重命名当前班级</h3>
                <div className="flex gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    placeholder={current.name}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  <button
                    onClick={() => {
                      const n = renameValue.trim();
                      if (n) updateClass.mutate({ id: current.id, name: n }, { onSuccess: () => setRenameValue('') });
                    }}
                    className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-600">显示模式</h3>
                <div className="flex gap-2">
                  {(['pet', 'photo'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateClass.mutate({ id: current.id, display_mode: m })}
                      className={`rounded-lg px-4 py-2 text-sm font-medium ${
                        current.display_mode === m
                          ? 'bg-brand-500 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'pet' ? '🐾 宠物模式' : '📷 照片模式'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400">照片模式与宠物模式都保留 Lv.1–9 等级成长。</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <button
                  onClick={() => {
                    if (confirm(`确定删除班级「${current.name}」？该班所有学生、分组都会被删除,不可撤销。`)) {
                      deleteClass.mutate(current.id, { onSuccess: onClose });
                    }
                  }}
                  className="text-sm text-lose-500 hover:text-lose-600"
                >
                  删除当前班级
                </button>
              </div>
            </div>
          )}

          {classes.length > 1 && (
            <p className="text-xs text-slate-400">共 {classes.length} 个班级,可在左上角切换。</p>
          )}
        </div>
      )}
    </Modal>
  );
}
