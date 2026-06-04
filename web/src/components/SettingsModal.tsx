import { useState } from 'react';
import { Modal } from './Modal';
import { StudentRoster } from './StudentRoster';
import { GroupManager } from './GroupManager';
import { PointItemsManager } from './PointItemsManager';
import { LevelEditor } from './LevelEditor';
import { MedalsManager } from './MedalsManager';
import { useCurrentClass } from '../state/CurrentClass';
import { useCreateClass, useUpdateClass, useDeleteClass } from '../lib/classes';
import { useResetWallToken } from '../lib/wall';

type Tab = 'roster' | 'groups' | 'items' | 'levels' | 'medals' | 'class';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current, classes, setCurrentId } = useCurrentClass();
  const [tab, setTab] = useState<Tab>('roster');
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const [newClassName, setNewClassName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const resetToken = useResetWallToken(current?.id ?? 0);

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
          ['items', '积分项目'],
          ['levels', '等级'],
          ['medals', '奖章'],
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
      {tab === 'items' && current && <PointItemsManager classId={current.id} />}
      {tab === 'levels' && current && <LevelEditor key={current.id} classId={current.id} />}
      {tab === 'medals' && current && <MedalsManager classId={current.id} />}

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

              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">公共展示墙</h3>
                <div className="mb-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/wall/${current.wall_token}`}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500"
                    aria-label="公共链接"
                  />
                  <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/wall/${current.wall_token}`)} className="rounded-md border border-brand-300 px-2 py-1 text-xs text-brand-600 hover:bg-brand-50">复制</button>
                  <button onClick={() => { if (confirm('重置后旧链接立即失效,确定？')) resetToken.mutate(); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">重置</button>
                </div>
                <div className="space-y-1 text-sm text-slate-600">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.public_show_real === 1} onChange={(e) => updateClass.mutate({ id: current.id, public_show_real: e.target.checked })} />显示真实姓名与照片(关闭则用昵称,保护隐私)</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.honor_roll_on_wall === 1} onChange={(e) => updateClass.mutate({ id: current.id, honor_roll_on_wall: e.target.checked })} />显示光荣榜</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={current.show_medals_on_wall === 1} onChange={(e) => updateClass.mutate({ id: current.id, show_medals_on_wall: e.target.checked })} />在卡片下显示奖章</label>
                </div>
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
