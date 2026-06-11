import { useRef, useState, type ChangeEvent } from 'react';
import { useJournal, useCreateEntry, useUpdateEntry, useDeleteEntry } from '../lib/journal';
import { fileToDataUrl } from '../lib/upload';
import { Modal } from './Modal';
import { Toast } from './Toast';
import type { Class, JournalEntry } from '../lib/types';

// 雅致低饱和星色:淡金 / 冰蓝 / 藕粉 / 薄荷绿
const STAR_COLORS = ['#f5d488', '#9ad7f5', '#f3b8c9', '#a8e6cf'];
const SIZE_LABELS = ['小', '中', '大'];

interface Draft {
  title: string;
  entry_date: string;
  note: string;
  dataUrl: string; // 新选的图(data URL),空串表示未选
  removeImage: boolean;
  starColor: string | null;
  starSize: number;
}

function emptyDraft(): Draft {
  return { title: '', entry_date: new Date().toISOString().slice(0, 10), note: '', dataUrl: '', removeImage: false, starColor: null, starSize: 2 };
}

export function JournalManager({ open, cls, onClose }: { open: boolean; cls: Class; onClose: () => void }) {
  const { data: entries = [] } = useJournal(open ? cls.id : null);
  const create = useCreateEntry(cls.id);
  const update = useUpdateEntry(cls.id);
  const del = useDeleteEntry(cls.id);

  const [editing, setEditing] = useState<JournalEntry | null>(null); // null = 新增模式
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const starryUrl = `/starry/${cls.journal_token}`;

  function set<K extends keyof Draft>(key: K, val: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: val }));
  }
  function resetForm() {
    setEditing(null);
    setDraft(emptyDraft());
    setErr('');
    if (fileRef.current) fileRef.current.value = '';
  }
  function startEdit(e: JournalEntry) {
    setEditing(e);
    setDraft({ title: e.title, entry_date: e.entry_date, note: e.note, dataUrl: '', removeImage: false, starColor: e.star_color, starSize: e.star_size ?? 2 });
    setErr('');
    if (fileRef.current) fileRef.current.value = '';
  }
  async function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setErr('图片需小于 5MB'); return; }
    setErr('');
    set('dataUrl', await fileToDataUrl(file));
    set('removeImage', false);
  }
  function save() {
    const title = draft.title.trim();
    if (!title || !draft.entry_date) { setErr('请填写标题和日期'); return; }
    const common = {
      title,
      entry_date: draft.entry_date,
      note: draft.note,
      star_color: draft.starColor,
      star_size: draft.starSize,
      ...(draft.dataUrl ? { data_url: draft.dataUrl } : {}),
    };
    if (editing) {
      update.mutate({ id: editing.id, ...common, ...(draft.removeImage ? { remove_image: true } : {}) }, {
        onSuccess: () => { resetForm(); setToast('已保存 ✨'); },
        onError: () => setErr('保存失败,请重试'),
      });
    } else {
      create.mutate({ ...common, star_color: draft.starColor ?? undefined, star_size: draft.starSize }, {
        onSuccess: () => { resetForm(); setToast('新的星星已点亮 ✨'); },
        onError: () => setErr('保存失败,请重试'),
      });
    }
  }
  function remove(e: JournalEntry) {
    if (!confirm(`删除手帐「${e.title}」?这颗星星将从星空中消失。`)) return;
    del.mutate(e.id, { onSuccess: () => { if (editing?.id === e.id) resetForm(); setToast('已删除'); } });
  }

  // 当前预览图:新选的 > 原图(未标记移除)
  const previewSrc = draft.dataUrl || (!draft.removeImage && editing?.image_path) || '';
  const saving = create.isPending || update.isPending;

  return (
    <Modal open={open} title={`✨ 满天星手帐 · ${cls.name}`} onClose={onClose}>
      <div className="space-y-5">
        {/* 顶部:进入星空 */}
        <a
          href={starryUrl}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#0d1b3a] to-[#1b2a5b] px-5 py-3.5 text-white shadow-lg shadow-indigo-900/20 transition-all hover:shadow-xl hover:shadow-indigo-900/30"
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="animate-pulse-slow">🌌</span> 进入星空
            <span className="text-xs font-normal text-indigo-200">共 {entries.length} 颗星 · 此链接可分享给家长</span>
          </span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </a>

        {/* 编辑表单 */}
        <div className="space-y-3 rounded-2xl bg-brand-50/60 p-4 ring-1 ring-brand-100/60">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-700">{editing ? `编辑「${editing.title}」` : '记一笔新手帐'}</h3>
            {editing && <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-600">取消编辑</button>}
          </div>
          <div className="flex gap-2">
            <input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="标题,如:春游植物园"
              aria-label="手帐标题"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="date"
              value={draft.entry_date}
              onChange={(e) => set('entry_date', e.target.value)}
              aria-label="手帐日期"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <textarea
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="这一天发生了什么…"
            aria-label="手帐内容"
            rows={3}
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} aria-label="手帐图片(可选)" className="text-xs text-slate-500" />
            {previewSrc && (
              <span className="relative inline-block">
                <img src={previewSrc} alt="预览" className="h-14 w-14 rounded-xl object-cover shadow-sm ring-1 ring-slate-200" />
                <button
                  onClick={() => { set('dataUrl', ''); set('removeImage', true); if (fileRef.current) fileRef.current.value = ''; }}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[10px] text-white shadow hover:bg-lose-500"
                  aria-label="移除图片"
                >✕</button>
              </span>
            )}
          </div>
          {/* 星星外观 */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              星色
              <button
                onClick={() => set('starColor', null)}
                className={`h-6 rounded-full px-2 ring-1 transition ${draft.starColor === null ? 'bg-slate-700 text-white ring-slate-700' : 'bg-white text-slate-500 ring-slate-200 hover:ring-slate-300'}`}
              >自动</button>
              {STAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('starColor', c)}
                  aria-label={`星色 ${c}`}
                  className={`h-6 w-6 rounded-full ring-2 transition hover:scale-110 ${draft.starColor === c ? 'ring-slate-600' : 'ring-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="flex items-center gap-1.5">
              大小
              {SIZE_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => set('starSize', i + 1)}
                  className={`rounded-full px-2.5 py-1 ring-1 transition ${draft.starSize === i + 1 ? 'bg-brand-500 text-white ring-brand-500' : 'bg-white text-slate-500 ring-slate-200 hover:ring-brand-200'}`}
                >{label}</button>
              ))}
            </span>
            <button
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 hover:shadow disabled:opacity-60"
            >{saving ? '保存中…' : editing ? '保存修改' : '＋ 点亮这颗星'}</button>
          </div>
          {err && <p className="text-sm text-lose-500">{err}</p>}
        </div>

        {/* 条目列表 */}
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className={`flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 ring-1 transition hover:shadow-md ${editing?.id === e.id ? 'ring-brand-300 shadow-md' : 'ring-slate-100'}`}>
              {e.image_path ? (
                <img src={e.image_path} alt={e.title} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-100" />
              ) : (
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#0d1b3a] to-[#1b2a5b] text-lg"
                  style={{ color: e.star_color ?? '#f5d488' }}
                >✦</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-bold text-slate-700">{e.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">{e.entry_date}</span>
                </div>
                {e.note && <p className="truncate text-xs text-slate-400">{e.note}</p>}
              </div>
              <button onClick={() => startEdit(e)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-brand-50 hover:text-brand-600" aria-label={`编辑 ${e.title}`}>编辑</button>
              <button onClick={() => remove(e)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-lose-50 hover:text-lose-600" aria-label={`删除 ${e.title}`}>删除</button>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-400">还没有手帐,记下第一笔,夜空就会亮起第一颗星 ✨</p>
          )}
        </div>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Modal>
  );
}
