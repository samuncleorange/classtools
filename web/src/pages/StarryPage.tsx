import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { usePublicJournal } from '../lib/journal';
import { StarrySky, type HoverInfo } from '../starry/StarrySky';
import { StarDetailOverlay } from '../starry/StarDetailOverlay';
import { AmbientPad } from '../starry/ambient';
import type { JournalPublicEntry } from '../lib/types';
import '../starry/starry.css';

const TITLE = '2026 年春学期满天星手帐';

/** 入场加载罩:零星光点由暗渐亮,数据就绪后整页柔和淡入 */
function LoadingVeil({ done }: { done: boolean }) {
  const dots = useMemo(
    () => Array.from({ length: 9 }, () => ({ left: `${20 + Math.random() * 60}%`, top: `${30 + Math.random() * 40}%`, size: 4 + Math.random() * 6, delay: `${Math.random() * 1.4}s` })),
    [],
  );
  return (
    <div className={`absolute inset-0 z-30 bg-[#070b1a] transition-opacity duration-1000 ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      {dots.map((d, i) => (
        <span key={i} className="starry-loading-dot absolute" style={{ left: d.left, top: d.top, width: d.size, height: d.size, animationDelay: d.delay }} />
      ))}
      <p className="absolute inset-x-0 bottom-[30%] text-center text-xs tracking-[0.3em] text-indigo-200/50">星光汇聚中…</p>
    </div>
  );
}

export function StarryPage() {
  const { token = '' } = useParams();
  const { data, isError } = usePublicJournal(token);
  const [veilDone, setVeilDone] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [selected, setSelected] = useState<{ entry: JournalPublicEntry; origin: { x: number; y: number } } | null>(null);
  const [playing, setPlaying] = useState(false);
  const pad = useRef<AmbientPad | null>(null);

  useEffect(() => {
    document.title = TITLE;
    return () => {
      document.title = '满天星积分榜';
      document.body.style.cursor = '';
      pad.current?.dispose();
    };
  }, []);

  // 数据就绪后稍候片刻再揭开加载罩,让首帧星空先渲染好
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setVeilDone(true), 1100);
    return () => clearTimeout(t);
  }, [data]);

  function toggleAudio() {
    if (!pad.current) pad.current = new AmbientPad();
    if (playing) {
      pad.current.stop();
      setPlaying(false);
    } else {
      pad.current.start(); // 用户点击手势内启动,符合自动播放策略
      setPlaying(true);
    }
  }

  // 副标题:班级名 + 手帐日期范围
  const subtitle = useMemo(() => {
    if (!data) return '';
    const dates = data.entries.map((e) => e.entry_date).sort();
    const range = dates.length > 0 ? ` · ${dates[0]} ~ ${dates[dates.length - 1]}` : '';
    return `${data.class_name}${range}`;
  }, [data]);

  if (isError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#070b1a]">
        <p className="text-sm tracking-widest text-indigo-200/60">链接无效或已失效</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#070b1a]">
      {/* 星空画布:浮层打开时轻微虚化下沉 */}
      <div className={`absolute inset-0 transition-all duration-500 ${selected ? 'scale-[1.02] opacity-70 blur-[2px]' : ''}`}>
        {data && (
          <Canvas dpr={[1, 2]} camera={{ fov: 72, near: 0.1, far: 1500, position: [0, 0, 0.1] }} gl={{ antialias: true }}>
            <StarrySky entries={data.entries} onSelect={(entry, x, y) => setSelected({ entry, origin: { x, y } })} onHover={setHover} />
          </Canvas>
        )}
      </div>

      {/* 主标题 */}
      <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center sm:top-12">
        <h1 className="starry-title text-xl sm:text-3xl">{TITLE}</h1>
        {subtitle && <p className="starry-subtitle mt-3 text-xs text-indigo-200/70 sm:text-sm">{subtitle}</p>}
      </div>

      {/* 返回后台 */}
      <Link
        to="/"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 px-4 py-2 text-xs tracking-wider text-indigo-100/90 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15"
      >← 返回后台</Link>

      {/* 空状态 */}
      {data && data.entries.length === 0 && veilDone && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 z-10 text-center text-sm tracking-[0.2em] text-indigo-200/60">
          夜空还很安静,去手帐里记下第一笔,点亮第一颗星 ✨
        </p>
      )}

      {/* hover 浮签:标题 + 日期 */}
      {hover && !selected && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-full bg-[#0d1b3a]/85 px-4 py-1.5 text-xs text-indigo-50 ring-1 ring-white/20 backdrop-blur"
          style={{ left: hover.x, top: hover.y - 44 }}
        >
          <span className="font-medium">{hover.title}</span>
          <span className="ml-2 text-indigo-200/70">{hover.date}</span>
        </div>
      )}

      {/* 音乐:极简毛玻璃圆形按钮,播放时柔和呼吸 */}
      <button
        onClick={toggleAudio}
        aria-label={playing ? '暂停音乐' : '播放音乐'}
        className={`absolute bottom-5 right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg text-indigo-100 ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15 ${playing ? 'starry-breathe' : ''}`}
      >{playing ? '♪' : '♫'}</button>

      {/* 操作提示 */}
      <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] tracking-[0.25em] text-indigo-200/40">
        拖动环视星空 · 点击星星查看手帐
      </p>

      {/* 星星详情浮层 */}
      {selected && <StarDetailOverlay entry={selected.entry} origin={selected.origin} onClose={() => setSelected(null)} />}

      <LoadingVeil done={veilDone} />
    </div>
  );
}
