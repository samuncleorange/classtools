import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { JournalPublicEntry } from '../lib/types';

/**
 * 星星节点详情浮层:从被点击星星的位置"光点绽放"成卡片,
 * 关闭时收拢回星点。毛玻璃 + 细描边 + 柔和外发光,延续星空冷色调。
 */
export function StarDetailOverlay({
  entry,
  origin,
  onClose,
}: {
  entry: JournalPublicEntry;
  origin: { x: number; y: number };
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [zoom, setZoom] = useState(false); // 图片全屏查看
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null); // 图片真实尺寸

  // 卡片宽度随图片比例自适应:以图片最大显示高度时的宽度为基准,夹在合理区间。
  // 竖图 → 窄卡,横图 → 宽卡,几乎不留深色边。图片已预加载,尺寸通常即时可得。
  const cardWidth = useMemo<number | undefined>(() => {
    if (!entry.image_path || !natural) return undefined;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxH = vh * 0.66; // 图片最大显示高度
    const maxW = Math.min(vw * 0.92, 880);
    const minW = Math.min(vw * 0.86, 300); // 太窄则文字难读,设下限
    const ar = natural.w / natural.h;
    return Math.round(Math.min(Math.max(maxH * ar, minW), maxW));
  }, [entry.image_path, natural]);

  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 320);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (zoom ? setZoom(false) : close());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, closing]);

  // 绽放原点:点击位置相对视口中心的偏移,供 CSS 关键帧使用
  const cardStyle = useMemo<CSSProperties>(
    () => ({
      ['--ox' as string]: `${origin.x - window.innerWidth / 2}px`,
      ['--oy' as string]: `${origin.y - window.innerHeight / 2}px`,
    }),
    [origin],
  );

  // 卡片周围的微光颗粒(挂载时随机散布)
  const motes = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        left: `${6 + Math.random() * 88}%`,
        top: `${4 + Math.random() * 92}%`,
        size: 3 + Math.random() * 5,
        delay: `${i * 0.7}s`,
      })),
    [],
  );

  return (
    <div className={`fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 ${closing ? 'starry-fade-out' : 'starry-fade-in'}`} onClick={close}>
      {/* 遮罩:压暗 + 虚化背景星空 */}
      <div className="absolute inset-0 bg-[#05070f]/55 backdrop-blur-[5px]" />

      <div
        style={{ ...cardStyle, ...(cardWidth ? { width: cardWidth } : {}) }}
        onClick={(e) => e.stopPropagation()}
        className={`relative max-w-[92vw] overflow-hidden rounded-[2rem] bg-white/[0.07] ring-1 ring-white/15 backdrop-blur-2xl shadow-[0_0_60px_rgba(140,170,255,0.18),0_24px_70px_rgba(0,0,0,0.5)] ${cardWidth ? '' : 'w-[min(92vw,42rem)]'} ${closing ? 'starry-card-out' : 'starry-card-in'}`}
      >
        {/* 微光颗粒 */}
        {motes.map((m, i) => (
          <span key={i} className="starry-mote" style={{ left: m.left, top: m.top, width: m.size, height: m.size, animationDelay: m.delay }} />
        ))}

        {/* 关闭按钮 */}
        <button
          onClick={close}
          aria-label="关闭"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm text-indigo-100 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20"
        >✕</button>

        <div className="max-h-[82vh] overflow-y-auto">
          {/* 图片:卡片宽度已随图片比例自适应,图片铺满卡宽完整显示;点击可全屏放大 */}
          {entry.image_path && (
            <button
              onClick={() => setZoom(true)}
              className="flex w-full cursor-zoom-in items-center justify-center bg-[#070d24]"
              aria-label="放大查看图片"
            >
              <img
                src={entry.image_path}
                alt={entry.title}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="block max-h-[66vh] w-full object-contain"
                draggable={false}
              />
            </button>
          )}

          <div className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="starry-title text-xl text-indigo-50 sm:text-2xl" style={{ animation: 'none', textIndent: 0, letterSpacing: '0.12em' }}>
                {entry.title}
              </h2>
              <span className="rounded-full bg-indigo-300/10 px-3 py-1 text-xs tracking-widest text-indigo-200/90 ring-1 ring-indigo-200/20">
                {entry.entry_date}
              </span>
            </div>
            {entry.note ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-indigo-100/85 sm:text-[15px] sm:leading-8">{entry.note}</p>
            ) : (
              <p className="text-sm text-indigo-200/40">这一天没有留下文字,只点亮了一颗星。</p>
            )}
          </div>
        </div>
      </div>

      {/* 图片全屏查看 */}
      {zoom && entry.image_path && (
        <div className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-[#05070f]/90 starry-fade-in" onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          <img src={entry.image_path} alt={entry.title} className="max-h-[94vh] max-w-[94vw] rounded-xl object-contain shadow-2xl" draggable={false} />
        </div>
      )}
    </div>
  );
}
