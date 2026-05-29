# classtools M6 — 主题打磨与部署文档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收官里程碑。统一薄荷晴空主题与品牌(favicon/标题),让仪表盘与公共墙在希沃大屏/投影下更友好,补齐操作反馈与审查遗留小项,并产出完整的**部署文档**,使老师能在 VPS 上 `docker compose up` 稳定运行。

**Architecture:** 无新数据/接口。以打磨现有前端、补充文档为主。验收以「构建通过 + 既有 114 测试不回归 + 少量新增组件测试 + Docker 全链路冒烟 + 文档完整」为准(主题打磨属视觉判断,不强行 TDD)。

**Tech Stack:** 沿用。无新依赖。

**前置:** M1–M5 已合并入 `main`(系统功能完整)。本里程碑在分支 `m6-polish-deploy` 上开发。

---

## 范围与裁定

- **主题打磨**:不重构,只统一与点缀——favicon、theme-color、标题、登录页/卡片视觉一致性。
- **大屏/响应式**:仪表盘与公共墙在 `xl/2xl` 断点增加列数与字号;公共墙加「全屏」按钮(投影展示)。不引入新布局系统。
- **UX 反馈**:撤销/一键分配等给出短暂提示(自动消失 Toast);补齐加载/空态一致性。
- **审查遗留**:`/uploads` 静态加注释说明(随机文件名的公开设计);公共墙页脚保持简洁品牌。
- **部署文档**:完整 README + nginx 反代示例 + 备份/恢复 + 环境变量 + 首登/升级/排错。
- **不做**:不加新业务功能;不引入 i18n;不做 PWA(原系统的"添加到桌面"靠浏览器自带,文档里说明即可)。

---

## 文件结构(M6 产出/改动)

```
web/index.html                       # favicon/theme-color/描述
web/public/favicon.svg               # 新增:薄荷青小爪 favicon
web/src/components/Toast.tsx         # 新增:自动消失提示
web/src/pages/DashboardPage.tsx      # 大屏列数;撤销/分配 Toast 反馈
web/src/components/PublicWall.tsx    # 大屏列数/字号;全屏按钮;页脚
web/src/pages/WallPage.tsx           # (可能)传 token 给全屏标题(可选)
server/src/app.ts                    # /uploads 注释
web/src/test/Toast.test.tsx          # 新增组件测试
README.md                            # 重写:完整部署文档
docs/DEPLOY.md                       # 新增:反向代理与运维详述(README 链接到它)
```

---

## Task 1: 品牌与全局主题点缀

**Files:** Create `web/public/favicon.svg`; Modify `web/index.html`

- [ ] **Step 1: 创建 `web/public/favicon.svg`**(薄荷青圆角底 + 白色小爪)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#06b6d4"/>
  <g fill="#ffffff">
    <ellipse cx="32" cy="40" rx="11" ry="8"/>
    <circle cx="20" cy="28" r="4.5"/>
    <circle cx="32" cy="24" r="4.5"/>
    <circle cx="44" cy="28" r="4.5"/>
  </g>
</svg>
```

- [ ] **Step 2: 修改 `web/index.html`** —— 在 `<head>` 内补充 favicon、theme-color 与描述(保留既有 charset/viewport/title)

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#06b6d4" />
    <meta name="description" content="班级宠物园 — 班级积分与宠物养成,激励学生成长" />
```
(插入到 `<title>班级宠物园</title>` 附近。)

- [ ] **Step 3: 验证构建** —— `npm run build -w web` → 成功;确认 `web/dist/favicon.svg` 存在(Vite 自动拷贝 `public/`)。

- [ ] **Step 4: 提交**
```bash
git add web/public/favicon.svg web/index.html
git commit -m "feat(web): favicon、theme-color 与页面描述(薄荷晴空品牌)"
```

---

## Task 2: 自动消失提示组件 Toast(TDD)

**Files:** Create `web/src/components/Toast.tsx`; Test `web/src/test/Toast.test.tsx`

- [ ] **Step 1: 写失败测试 `web/src/test/Toast.test.tsx`**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '../components/Toast';

afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('显示消息', () => {
    render(<Toast message="已撤销" onDone={() => {}} />);
    expect(screen.getByText('已撤销')).toBeInTheDocument();
  });

  it('到时后调用 onDone', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast message="x" onDone={onDone} duration={1000} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onDone).toHaveBeenCalled();
  });

  it('message 为空时不渲染', () => {
    const { container } = render(<Toast message={null} onDone={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败** —— `npm run test -w web -- Toast` → FAIL。

- [ ] **Step 3: 创建 `web/src/components/Toast.tsx`**

```tsx
import { useEffect } from 'react';

export function Toast({ message, onDone, duration = 2000 }: { message: string | null; onDone: () => void; duration?: number }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDone]);

  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-800/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}
```

- [ ] **Step 4: 运行确认通过** —— `npm run test -w web -- Toast` → PASS(3)。

- [ ] **Step 5: 提交**
```bash
git add web/src/components/Toast.tsx web/src/test/Toast.test.tsx
git commit -m "feat(web): 自动消失提示组件 Toast"
```

---

## Task 3: 大屏/响应式 + 操作反馈(仪表盘)

**Files:** Modify `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 学生卡片网格在大屏增加列数**

把仪表盘里学生网格的 className(两处:批量模式与正常模式所在的 `grid` 容器,以及空态无需改)从
```
className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
```
改为
```
className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
```
(若批量模式与正常模式是同一个 `grid` 容器包裹则只有一处;按实际代码定位 `grid-cols-2 ... lg:grid-cols-5` 出现处统一替换。)

- [ ] **Step 2: 撤销 / 一键分配 给出 Toast 反馈**

- import 追加:`import { Toast } from '../components/Toast';`
- 新增 state:`const [toast, setToast] = useState<string | null>(null);`
- 撤销按钮 onClick 改为带回调:
```tsx
                onClick={() => undo.mutate(undefined, { onSuccess: (r) => setToast(r.undone > 0 ? `已撤销 ${r.undone} 项操作` : '没有可撤销的操作') })}
```
- 一键分配按钮 onClick 改为:
```tsx
                onClick={() => { if (pets.length === 0) { setToast('请先在「设置 → 宠物」上传宠物'); return; } assignPets.mutate(undefined, { onSuccess: (r) => setToast(`已为 ${r.assigned} 名学生分配宠物`) }); }}
```
(去掉原先的 `alert(...)`,改用 Toast。`undo.mutate`/`assignPets.mutate` 的 mutationFn 无参,传 `undefined` 作为第一个实参以便带 options。)
- 在组件返回 JSX 末尾(其它弹窗附近)追加:`<Toast message={toast} onDone={() => setToast(null)} />`

- [ ] **Step 3: 验证测试与构建** —— `npm run test -w web && npm run build` → 前端测试全 PASS(原 20 + Toast 3 = 23);构建成功。

- [ ] **Step 4: 提交**
```bash
git add web/src/pages/DashboardPage.tsx
git commit -m "feat(web): 仪表盘大屏列数与撤销/分配 Toast 反馈"
```

---

## Task 4: 公共墙大屏友好 + 全屏 + 页脚 + /uploads 注释

**Files:** Modify `web/src/components/PublicWall.tsx`, `server/src/app.ts`

- [ ] **Step 1: 公共墙学生网格大屏列数**

把 PublicWall 学生网格的
```
className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
```
改为
```
className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8"
```

- [ ] **Step 2: 加「全屏」按钮**(投影/大屏展示用)

在 PublicWall 顶部标题区(`<h1>` 同级)右上角加一个全屏切换按钮。改标题块:
```tsx
      <div className="relative mb-6">
        <h1 className="text-center text-3xl font-bold text-brand-600">{cls.name}</h1>
        <button
          onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }}
          className="absolute right-0 top-0 rounded-lg border border-brand-200 px-3 py-1 text-xs text-brand-600 hover:bg-brand-50"
          aria-label="全屏"
        >⛶ 全屏</button>
      </div>
```
(替换原来的 `<h1 ...>{cls.name}</h1>` 单行。)

- [ ] **Step 3: 页脚品牌**

把原页脚 `<p ...>班级宠物园</p>` 改为更克制的品牌行(保留文案,弱化样式即可,无需大改):
```tsx
      <p className="mt-10 text-center text-xs text-slate-300">🐾 班级宠物园 · 共同见证成长</p>
```

- [ ] **Step 4: `server/src/app.ts` 给 /uploads 静态加注释**

在注册 `/uploads` 静态那一段上方加注释:
```ts
  // /uploads 为公开静态目录(宠物图/学生照片);文件名为高熵随机串,
  // 未授权者无法枚举。公共墙在 public_show_real=0 时不会输出照片路径。
```

- [ ] **Step 5: 验证测试与构建** —— `npm run test -w web -- PublicWall && npm run build` → PASS + 成功。

- [ ] **Step 6: 提交**
```bash
git add web/src/components/PublicWall.tsx server/src/app.ts
git commit -m "feat: 公共墙大屏列数/全屏/页脚 + /uploads 注释"
```

---

## Task 5: 部署文档(README + DEPLOY.md)

**Files:** Modify `README.md`; Create `docs/DEPLOY.md`

- [ ] **Step 1: 重写 `README.md`**

```markdown
# 班级宠物园 · classtools

一个自托管的「班级积分 + 宠物养成」工具:老师给学生加减分,学生的宠物随积分升级;可自定义宠物与奖章,学生用积分兑换奖章;家长/学生可通过随机只读链接查看班级展示墙。

> 设计与里程碑文档见 `docs/superpowers/`。

## 功能
- 多班级、学生名单(单个/批量)、分组
- 自定义加减分项目;单个/批量加减分;撤销;积分流水
- Lv.1–9 等级(阈值可配)与升级进度
- 头像:自定义宠物上传 / 学生照片模式;宠物生命周期(饥饿/死亡)
- 自定义奖章 + 积分兑换 + 撤销退还
- 公共展示墙(随机链接、只读、隐私可控、光荣榜、内联奖章)
- 适配电脑 / 手机 / 希沃大屏

## 技术栈
React + Vite + Tailwind(前端) · Fastify + better-sqlite3(后端) · 单 Docker 镜像。

## 本地开发
1. `cp .env.example .env` 并填写(至少改 `SESSION_SECRET`、`ADMIN_PASSWORD`)。
2. `npm install`
3. `npm run dev` —— 后端 :8080,前端 Vite :5173(已代理 `/api`、`/uploads`)。
4. 浏览器开 http://localhost:5173 ,用 `.env` 里的管理员账号登录。

## 测试
`npm test`(后端 vitest + 前端 vitest)。

## 生产部署(Docker)
详见 **[docs/DEPLOY.md](docs/DEPLOY.md)**。最简流程:
1. 在服务器准备 `.env`(见下方变量表),`NODE_ENV=production`。
2. `docker compose up -d --build`
3. 应用监听容器内 8080,映射到宿主 `${HOST_PORT:-8080}`;放到你的反向代理后启用 HTTPS。
4. 首次启动按 `.env` 自动创建管理员(仅当库为空)。

### 环境变量
| 变量 | 说明 |
|---|---|
| `PORT` | 容器内端口(默认 8080) |
| `HOST_PORT` | 宿主映射端口(compose,默认 8080) |
| `DATA_DIR` | 数据目录(容器内 `/data`,挂载卷) |
| `SESSION_SECRET` | 会话签名密钥,**务必改成长随机串**(`openssl rand -hex 32`) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始管理员(仅空库时创建一次) |
| `NODE_ENV` | `production`(启用 Secure Cookie,需 HTTPS)或 `development`(本机 http 直连测试) |

### 数据与备份
所有数据在挂载目录 `./data`(SQLite `app.db` + `uploads/` 图片)。**备份 = 打包该目录**:
```bash
docker compose stop app
tar czf classtools-backup-$(date +%F).tar.gz data/
docker compose start app
```
恢复:停服务 → 用备份覆盖 `data/` → 启服务。

## 升级
```bash
git pull
docker compose up -d --build
```
数据库迁移在启动时自动按需执行(幂等),数据保留。

## 安全提示
- 公共展示墙链接虽随机不可猜,但拿到链接者即可查看;涉及学生照片/真实姓名时,建议在班级设置里关闭「显示真实姓名与照片」。
- 上传图片仅限 png/jpg/webp/gif 且 ≤5MB。
```

- [ ] **Step 2: 创建 `docs/DEPLOY.md`**(反向代理与运维详述)

```markdown
# 部署详解(VPS + 反向代理)

本应用是单容器服务,容器内监听 `8080`,同时提供 API(`/api`)、上传文件(`/uploads`)与前端页面(SPA)。生产环境建议放在反向代理后,由代理终止 HTTPS。

## 1. 准备
```bash
git clone <你的仓库> classtools && cd classtools
cp .env.example .env
# 编辑 .env:SESSION_SECRET(openssl rand -hex 32)、ADMIN_USERNAME/PASSWORD、NODE_ENV=production
docker compose up -d --build
docker compose logs -f app   # 应看到 "已创建初始管理员" 与监听日志
```
默认映射宿主 `8080`(可用 `HOST_PORT` 改)。先用 `curl http://127.0.0.1:8080/api/health` 验证返回 `{"status":"ok"}`。

## 2. Nginx 反向代理(HTTPS 终止)示例
将你的域名解析到服务器,证书可用 certbot/Let's Encrypt。`/`、`/api`、`/uploads` 全部转发到应用 8080 即可(同源):
```nginx
server {
    listen 443 ssl http2;
    server_name pet.example.com;

    ssl_certificate     /etc/letsencrypt/live/pet.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pet.example.com/privkey.pem;

    client_max_body_size 12m;   # 允许 base64 图片上传(应用 bodyLimit 10MB)

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # 应用 trustProxy 已开启
    }
}

server {
    listen 80;
    server_name pet.example.com;
    return 301 https://$host$request_uri;
}
```
> 关键:`NODE_ENV=production` 会设 Secure Cookie,必须通过 HTTPS 访问,否则登录态不保持。`X-Forwarded-Proto` 让应用识别原始协议。`client_max_body_size` 需 ≥ 12m 以容纳图片上传。

## 3. Caddy(可选,自动 HTTPS)
```
pet.example.com {
    reverse_proxy 127.0.0.1:8080
    request_body { max_size 12MB }
}
```

## 4. 常见问题
- **登录成功但刷新后退出**:多半是用 http 直连了 `production` 模式(Secure Cookie 被丢弃)。请走 HTTPS,或本机测试时设 `NODE_ENV=development`。
- **图片上传失败/413**:反向代理的 body 大小限制太小,调大到 ≥12MB。
- **公共墙打不开**:确认用的是最新的班级链接(老师重置过 token 则旧链接失效)。
- **迁移/数据**:升级自动迁移;务必先备份 `data/`。
```

- [ ] **Step 3: 提交**
```bash
git add README.md docs/DEPLOY.md
git commit -m "docs: 完整部署文档(README + DEPLOY 反向代理/备份/排错)"
```

---

## Task 6: M6 收尾验证与发布

- [ ] **Step 1: 全量测试** —— `npm test` → server(94)+ web(23)全部 PASS。

- [ ] **Step 2: 全量构建** —— `npm run build` → 成功;确认 `web/dist/favicon.svg` 存在。

- [ ] **Step 3: Docker 全链路冒烟**(需 Docker 守护进程)

```bash
cp .env.example .env 2>/dev/null || true
# 确保 .env 有可用值(SESSION_SECRET 够长、ADMIN_PASSWORD 已设、NODE_ENV=production、HOST_PORT=8091)
docker compose up -d --build
sleep 5
docker compose ps
curl -s localhost:8091/api/health; echo
curl -s -o /dev/null -w "favicon: %{http_code}\n" localhost:8091/favicon.svg
docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q app)"
docker compose down
```
Expected: health `{"status":"ok"}`;favicon 200;容器 `healthy`。
> 若本机无 Docker 守护进程,记录"待 VPS 验证",不阻塞(M1 已验证镜像构建链路;M6 未改 Dockerfile)。

- [ ] **Step 4: 工作区干净 + 里程碑提交 + 打标签**

Run: `git status`(应干净;`.env` 已 gitignore)
```bash
git commit --allow-empty -m "chore: M6 主题打磨与部署文档完成 — classtools v1.0.0"
git tag v1.0.0
```
(标签先打在本地;推送时一并推。)

---

## 自查(Self-Review 结果)

- **Spec 覆盖**:覆盖设计文档第 8(薄荷晴空主题、响应式/大屏)、第 9(部署:Dockerfile/compose 自 M1 就绪,本里程碑补全 README/DEPLOY 文档与备份说明)。6 个里程碑至此全部完成。
- **占位扫描**:各步骤含真实代码/文档与命令,无 TBD。
- **不破坏**:主题/响应式改动均为 className 与新增组件,不改数据/接口;既有 114 测试 + 新增 Toast 3 = 全绿目标。
- **大屏**:网格在 xl/2xl 增列;公共墙加全屏按钮(`requestFullscreen`)。
- **反馈**:撤销/分配以 Toast 替代静默/alert。
- **文档**:README + DEPLOY 覆盖开发/构建/Docker/环境变量/备份恢复/nginx+Caddy 反代/HTTPS-Secure-Cookie 注意/升级/排错。
- **审查遗留**:`/uploads` 公开设计加注释;公共墙页脚品牌化;(早前 useWall credentials、StudentCard guard 已在 M5 处理)。
- **验收**:全量测试 + 构建 + Docker 全链路冒烟(health/favicon/healthy)。
- **发布**:打标签 v1.0.0。
