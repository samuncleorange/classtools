import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { JournalPublicEntry } from '../lib/types';
import { makeHaloTexture, makeStarTexture, makeTrailTexture, seededRandom } from './textures';

/** 主星默认色盘:暖金主导,辅以杏金 / 蜜金 / 一抹冰蓝点缀(明亮治愈) */
const PALETTE = ['#ffd45e', '#ffc24d', '#ffe08a', '#8fe0ff'];

export interface HoverInfo {
  title: string;
  date: string;
  x: number;
  y: number;
}

/* ---------------------------------- 全景相机控制 ---------------------------------- */

/** 相机固定在球心,拖拽/触摸做 360° 环视;带阻尼惯性,松手后丝滑滑行 */
function PanoramaControls() {
  const { camera, gl } = useThree();
  const s = useRef({ lon: 0, lat: 8, vlon: 0, vlat: 0, dragging: false, px: 0, py: 0, idle: 0 });
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const el = gl.domElement;
    const st = s.current;
    const down = (e: PointerEvent) => {
      st.dragging = true;
      st.idle = 0;
      st.px = e.clientX;
      st.py = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!st.dragging) return;
      const k = 0.09; // 拖拽灵敏度
      st.vlon = -(e.clientX - st.px) * k;
      st.vlat = (e.clientY - st.py) * k;
      st.lon += st.vlon;
      st.lat += st.vlat;
      st.px = e.clientX;
      st.py = e.clientY;
    };
    const up = () => {
      st.dragging = false;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const st = s.current;
    if (!st.dragging) {
      // 惯性滑行 + 阻尼衰减
      st.lon += st.vlon;
      st.lat += st.vlat;
      st.vlon *= 0.94;
      st.vlat *= 0.94;
      // 闲置数秒后缓缓自转,让每颗星先后入画;一拖拽即停
      st.idle += dt;
      if (st.idle > 4) {
        const ease = Math.min(1, (st.idle - 4) / 6); // 6s 内柔和加速到全速
        st.lon += dt * 0.55 * ease;
      }
    }
    // 越过俯仰极限时轻柔回弹
    if (st.lat > 80) st.lat += (80 - st.lat) * 0.2;
    if (st.lat < -80) st.lat += (-80 - st.lat) * 0.2;
    const phi = THREE.MathUtils.degToRad(90 - st.lat);
    const theta = THREE.MathUtils.degToRad(st.lon);
    target.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    camera.lookAt(target);
  });
  return null;
}

/* ---------------------------------- 天空穹顶 ---------------------------------- */

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 自顶向下深空渐变 + 极低透明度的星云噪声(水彩般的洋红/青蓝晕染)
const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0); // 0=地平线下 1=天顶
    // 治愈系油画蓝:天顶深宝蓝,越靠近地平线越亮、越偏青绿
    vec3 top = vec3(0.043, 0.106, 0.353);   // #0b1b5a 深宝蓝(仍清亮,不死黑)
    vec3 mid = vec3(0.075, 0.231, 0.553);   // #133b8d 明亮群青
    vec3 low = vec3(0.106, 0.380, 0.612);   // #1b619c 海蓝
    vec3 col = mix(low, mid, smoothstep(0.0, 0.46, h));
    col = mix(col, top, smoothstep(0.46, 1.0, h));
    // 地平线一圈发光的青绿色光带(参考图里海面的那抹通透青绿)
    float band = exp(-pow((h - 0.44) / 0.14, 2.0));
    col += vec3(0.10, 0.46, 0.50) * band * 0.55;
    // 星云:暖金 + 青绿两层缓慢漂移的 fbm,明亮梦幻
    float n1 = fbm(vDir * 2.6 + vec3(uTime * 0.004, 0.0, uTime * 0.003));
    float n2 = fbm(vDir * 1.8 + vec3(7.3, uTime * 0.005, 2.1));
    col += vec3(0.62, 0.46, 0.18) * smoothstep(0.48, 0.84, n1) * 0.20; // 暖金晕
    col += vec3(0.12, 0.46, 0.52) * smoothstep(0.50, 0.82, n2) * 0.18; // 青绿晕
    // 整体托底提亮,避免任何方向发暗
    col += vec3(0.03, 0.06, 0.12);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function SkyDome() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh raycast={() => null}>
      <sphereGeometry args={[600, 48, 32]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SKY_VERT} fragmentShader={SKY_FRAG} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

/* ---------------------------------- 背景碎星(instanced Points) ---------------------------------- */

const STARS_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aTint;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vTint;
  varying float vBright;
  void main() {
    vPhase = aPhase;
    vSpeed = aSpeed;
    vTint = aTint;
    vBright = clamp((aSize - 1.5) / 5.0, 0.0, 1.0); // 越大的星越亮、星芒越明显
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (400.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

// 圆形亮核 + 随亮度增强的十字星芒,营造闪烁感(治愈系亮星空)
const STARS_FRAG = /* glsl */ `
  uniform float uTime;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vTint;
  varying float vBright;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    // 四角星芒:沿水平/竖直方向拉长的细亮线
    float gx = smoothstep(0.5, 0.0, abs(uv.x) * 7.0 + abs(uv.y) * 0.7);
    float gy = smoothstep(0.5, 0.0, abs(uv.y) * 7.0 + abs(uv.x) * 0.7);
    float spark = max(gx, gy) * vBright * 0.8;
    float shape = max(core, spark);
    float tw = 0.5 + 0.5 * sin(uTime * vSpeed + vPhase); // 各自独立的缓慢闪烁
    gl_FragColor = vec4(vTint, shape * (0.45 + 0.55 * tw));
  }
`;

// 加权挑色:金色主导,辅以暖白、淡金,少量青绿点缀(呼应参考图)
function pickStarTint(rand: () => number): [number, number, number] {
  const r = rand();
  if (r < 0.5) return [1.0, 0.82, 0.42]; // 暖金(过半)
  if (r < 0.74) return [1.0, 0.91, 0.66]; // 淡金
  if (r < 0.9) return [1.0, 0.98, 0.9]; // 暖白
  return [0.6, 0.88, 0.96]; // 青绿点缀
}

function BackgroundStars({ count = 4200 }: { count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const { positions, sizes, phases, speeds, tints } = useMemo(() => {
    const rand = seededRandom(20260612);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const tints = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // 均匀散布在球壳上,半径有层次纵深
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 280 + rand() * 280;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = s * Math.cos(t) * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = s * Math.sin(t) * r;
      // 大小:多数细小,少数明亮(带星芒)
      sizes[i] = rand() < 0.82 ? 1.4 + rand() * 2.4 : 4.0 + rand() * 3.4;
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = 0.18 + rand() * 0.7; // 极慢的明暗交替
      const tint = pickStarTint(rand);
      tints[i * 3] = tint[0];
      tints[i * 3 + 1] = tint[1];
      tints[i * 3 + 2] = tint[2];
    }
    return { positions, sizes, phases, speeds, tints };
  }, [count]);

  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aTint" args={[tints, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={STARS_VERT}
        fragmentShader={STARS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------- 金色五角星层(参考图的灵魂:散落的暖金小星星) ------------------------- */

const GOLD_FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uMap;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vTint;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float tw = 0.55 + 0.45 * sin(uTime * vSpeed + vPhase);
    gl_FragColor = vec4(vTint, tex.a * (0.5 + 0.5 * tw));
  }
`;

function GoldStars({ star, count = 620 }: { star: THREE.Texture; count?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uMap: { value: star } }), [star]);
  const { positions, sizes, phases, speeds, tints } = useMemo(() => {
    const rand = seededRandom(770315);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const tints = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 300 + rand() * 240;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3] = s * Math.cos(t) * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = s * Math.sin(t) * r;
      sizes[i] = 8 + rand() * 16; // 比碎星大,五角星造型清晰、大小错落
      phases[i] = rand() * Math.PI * 2;
      speeds[i] = 0.2 + rand() * 0.6;
      // 实色金:橙金 / 暖金 / 杏金,饱和不发白
      const g = rand();
      const tint = g < 0.55 ? [1.0, 0.74, 0.26] : g < 0.85 ? [1.0, 0.83, 0.42] : [1.0, 0.66, 0.34];
      tints[i * 3] = tint[0];
      tints[i * 3 + 1] = tint[1];
      tints[i * 3 + 2] = tint[2];
    }
    return { positions, sizes, phases, speeds, tints };
  }, [count]);

  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points raycast={() => null} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aTint" args={[tints, 3]} />
      </bufferGeometry>
      {/* 正常混合:在亮蓝天空上画出实色金星(叠加混合会被冲淡发白) */}
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={STARS_VERT}
        fragmentShader={GOLD_FRAG}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

/* ---------------------------------- 漂浮微光尘埃 ---------------------------------- */

function Dust({ halo }: { halo: THREE.Texture }) {
  const group = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rand = seededRandom(8881);
    const n = 140;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const r = 60 + rand() * 130;
      const s = Math.sqrt(1 - u * u);
      arr[i * 3] = s * Math.cos(t) * r;
      arr[i * 3 + 1] = u * r * 0.7;
      arr[i * 3 + 2] = s * Math.sin(t) * r;
    }
    return arr;
  }, []);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.006; // 整体极慢漂移
  });
  return (
    <points ref={group} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={halo} size={2.6} sizeAttenuation transparent opacity={0.42} color="#ffe2a6" depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/* ---------------------------------- 流星 ---------------------------------- */

function ShootingStars({ trail }: { trail: THREE.Texture }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const st = useRef({ active: false, t: 0, dur: 1.6, next: 7, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0 });
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  useFrame((_, dt) => {
    const s = st.current;
    const m = mesh.current;
    if (!m || !mat.current) return;
    if (!s.active) {
      m.visible = false;
      s.next -= dt;
      if (s.next <= 0) {
        // 随机选一段较高天区的轨迹
        const lat = THREE.MathUtils.degToRad(20 + Math.random() * 40);
        const lon = Math.random() * Math.PI * 2;
        s.from.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(420);
        const tangent = new THREE.Vector3(Math.random() - 0.5, -0.4 - Math.random() * 0.4, Math.random() - 0.5)
          .cross(s.from)
          .normalize();
        s.dir.copy(tangent);
        s.len = 160 + Math.random() * 120;
        s.t = 0;
        s.dur = 1.3 + Math.random() * 0.8;
        s.active = true;
        m.quaternion.setFromUnitVectors(xAxis, s.dir);
      }
      return;
    }
    s.t += dt;
    const k = s.t / s.dur;
    if (k >= 1) {
      s.active = false;
      s.next = 9 + Math.random() * 14; // 低频:十秒上下一颗,不打扰
      m.visible = false;
      return;
    }
    m.visible = true;
    m.position.copy(s.from).addScaledVector(s.dir, k * s.len);
    mat.current.opacity = Math.sin(Math.PI * k) * 0.5; // 淡入划过再淡出
  });

  return (
    <mesh ref={mesh} visible={false} raycast={() => null}>
      <planeGeometry args={[70, 2.2]} />
      <meshBasicMaterial ref={mat} map={trail} transparent side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/* ---------------------------------- 主星(手帐条目) ---------------------------------- */

interface StarSpec {
  entry: JournalPublicEntry;
  position: THREE.Vector3;
  color: string;
  baseScale: number;
  phase: number;
  speed: number;
}

function JournalStar({
  spec,
  halo,
  star,
  onSelect,
  onHover,
}: {
  spec: StarSpec;
  halo: THREE.Texture;
  star: THREE.Texture;
  onSelect: (entry: JournalPublicEntry, x: number, y: number) => void;
  onHover: (info: HoverInfo | null) => void;
}) {
  const sprite = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);
  const hovered = useRef(false);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 错相位呼吸:明暗 + 体积同步律动;hover 时放大、光晕增强
    const breath = 1 + 0.1 * Math.sin(t * spec.speed + spec.phase);
    const target = spec.baseScale * breath * (hovered.current ? 1.45 : 1);
    if (sprite.current) {
      const cur = sprite.current.scale.x;
      const next = cur + (target - cur) * 0.12; // 平滑过渡
      sprite.current.scale.setScalar(next);
      const m = sprite.current.material as THREE.SpriteMaterial;
      m.opacity = (hovered.current ? 1 : 0.9) * (0.85 + 0.15 * Math.sin(t * spec.speed + spec.phase));
    }
    // 五角星亮核:跟随呼吸 + 极缓慢自转,hover 时一起放大
    if (core.current) {
      core.current.scale.setScalar(spec.baseScale * 0.62 * breath * (hovered.current ? 1.4 : 1));
      core.current.material.rotation = Math.sin(t * 0.15 + spec.phase) * 0.25;
    }
  });

  function over(e: ThreeEvent<PointerEvent>) {
    e.stopPropagation();
    hovered.current = true;
    document.body.style.cursor = 'pointer';
    onHover({ title: spec.entry.title, date: spec.entry.entry_date, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  }
  function out() {
    hovered.current = false;
    document.body.style.cursor = '';
    onHover(null);
  }
  function click(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (e.delta > 8) return; // 拖拽环视结束时不当作点击
    onSelect(spec.entry, e.nativeEvent.clientX, e.nativeEvent.clientY);
  }

  return (
    <group position={spec.position}>
      {/* 宽光晕(承担点击区域) */}
      <sprite ref={sprite} onPointerOver={over} onPointerOut={out} onPointerMove={over} onClick={click}>
        <spriteMaterial map={halo} color={spec.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {/* 五角星亮核:实色金星画在发光晕之上(参考图里发光的金色主星) */}
      <sprite ref={core} raycast={() => null} renderOrder={3}>
        <spriteMaterial map={star} color={spec.color} transparent depthWrite={false} />
      </sprite>
    </group>
  );
}

/* ---------------------------------- 场景组装 ---------------------------------- */

export function StarrySky({
  entries,
  onSelect,
  onHover,
}: {
  entries: JournalPublicEntry[];
  onSelect: (entry: JournalPublicEntry, x: number, y: number) => void;
  onHover: (info: HoverInfo | null) => void;
}) {
  const halo = useMemo(() => makeHaloTexture(), []);
  const star = useMemo(() => makeStarTexture(), []);
  const trail = useMemo(() => makeTrailTexture(), []);
  useEffect(() => () => {
    halo.dispose();
    star.dispose();
    trail.dispose();
  }, [halo, star, trail]);

  // 主星布点:黄金角螺旋铺在地平线以上的球带,错落有致;同一条目位置稳定
  const specs = useMemo<StarSpec[]>(() => {
    const n = entries.length;
    return entries.map((e, i) => {
      const rand = seededRandom(e.id * 7919 + 13);
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const latDeg = -16 + t * 64 + (rand() - 0.5) * 10; // 越新的条目越靠近天顶
      const lonDeg = i * 137.508 + rand() * 24; // 黄金角散开经度
      const lat = THREE.MathUtils.degToRad(latDeg);
      const lon = THREE.MathUtils.degToRad(lonDeg);
      const radius = 300 + rand() * 110; // 深度差,产生视差
      const position = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(lon),
      ).multiplyScalar(radius);
      const sizeStep = e.star_size ?? 2;
      const baseScale = (18 + sizeStep * 9) * (radius / 380); // 远星稍放大,视觉大小一致
      return {
        entry: e,
        position,
        color: e.star_color || PALETTE[i % PALETTE.length],
        baseScale,
        phase: rand() * Math.PI * 2,
        speed: 1.4 + rand() * 1.6, // 2-4s 左右一次呼吸
      };
    });
  }, [entries]);

  return (
    <>
      <PanoramaControls />
      <SkyDome />
      <BackgroundStars />
      <GoldStars star={star} />
      <Dust halo={halo} />
      <ShootingStars trail={trail} />
      {specs.map((s) => (
        <JournalStar key={s.entry.id} spec={s} halo={halo} star={star} onSelect={onSelect} onHover={onHover} />
      ))}
    </>
  );
}
