import { Modal } from './Modal';
import { useStudentLogs } from '../lib/award';
import type { Student } from '../lib/types';

export function StudentLogsModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data: logs = [] } = useStudentLogs(student.id);
  return (
    <Modal open title={`积分记录 · ${student.name}`} onClose={onClose}>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li key={log.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-600">{log.reason}</span>
            <span className="flex items-center gap-3">
              <span className={log.delta_spendable >= 0 ? 'text-gain-600' : 'text-lose-600'}>
                {log.delta_spendable >= 0 ? '+' : ''}{log.delta_spendable} 🍪
              </span>
              <span className="text-xs text-slate-400">{log.created_at.slice(0, 10)}</span>
            </span>
          </li>
        ))}
        {logs.length === 0 && <li className="py-6 text-center text-sm text-slate-400">还没有积分记录</li>}
      </ul>
    </Modal>
  );
}
