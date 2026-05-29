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
