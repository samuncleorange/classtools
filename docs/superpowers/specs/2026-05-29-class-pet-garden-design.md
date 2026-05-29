# 班级宠物园（自用复刻版 · classtools）设计文档

- 日期：2026-05-29
- 状态：已确认（待评审）
- 目标用户：单个/少数老师自用，部署在自有 VPS

## 1. 背景与目标

老师购买了一个商用的「班级宠物养成系统」（原网站 `xuexi.banjiguanli.net`），希望复刻一份**自用版本**并做局部修改，用 Docker 部署到自己的 VPS。

本项目从零实现一个功能相近但更适合老师自用的系统，**不复制原系统的代码与图片资产**（宠物图片等版权素材由老师自行上传/替换）。复刻的是"班级游戏化积分养成"这一通用教学功能，而非原产品的具体实现。

### 相对原系统的主要改动

1. 去掉卡密激活 / 试用期 / 付费墙。
2. 新增**公共展示墙**与**公共奖章大厅**，供学生和家长查看；通过**随机不可猜的链接**保护隐私。
3. 宠物种类与图片**由老师自行添加/上传**（不内置原系统版权图片）。
4. 新增**学生照片模式**：用学生本人照片作头像，替代宠物形象（两种模式都保留 Lv.1–9 等级成长）。
5. 去掉小卖部，改为**用积分兑换奖章**。
6. UI 主题改为**薄荷晴空系**：主色 cyan + 强调色 amber。

## 2. 技术方案

- **单 Docker 镜像**：Node 后端（Fastify + better-sqlite3）同时提供 REST API 并托管打包后的 React 前端静态文件。
- **数据持久化**：单个挂载卷 `/data`，包含 `app.db`（SQLite）与 `uploads/`（图片）。备份=复制该目录。
- **前端**：React + Vite + TypeScript + Tailwind CSS（薄荷晴空主题）。
- **部署**：容器暴露一个 HTTP 端口，放在用户**自有的反向代理**后（HTTPS 由用户自理，不内置 Caddy）。

## 3. 访问入口

| 入口 | 路径 | 鉴权 | 用途 |
|---|---|---|---|
| 老师端 | `/` 及子路由 | 需登录（session cookie） | 全部管理与操作 |
| 公共展示墙 | `/wall/:token` | 无（凭随机 token） | 只读展示，含光荣榜 |
| 公共奖章大厅 | `/medals/:token` | 无（凭随机 token） | 只读展示已获奖章 |

- token 为高熵随机串（如 ≥ 22 字符 base62），**每班各自独立**。
- 老师可一键**重置 token**，重置后旧链接立即失效。

## 4. 认证模型

- 单/少量老师账号。首次启动通过环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 创建初始管理员；若库中已有账号则忽略。
- 登录使用 httpOnly session cookie；密码以 argon2/bcrypt 哈希存储。
- 公共墙不需登录，仅凭 token 访问对应班级的只读数据。

## 5. 数据模型（SQLite）

> 字段为概要，迁移/索引在实现阶段细化。

- `teachers`(id, username, password_hash, created_at)
- `classes`(id, teacher_id, name, display_mode['pet'|'photo'], wall_token, medal_token,
  public_show_real[bool], honor_roll_on_wall[bool],
  life_cycle_enabled[bool], hunger_days, death_days, created_at)
- `groups`(id, class_id, name, sort_order)
- `students`(id, class_id, name, group_id?, growth_points[int,只增], spendable_points[int],
  avatar_mode['pet'|'photo'|null=继承班级], pet_type_id?, pet_custom_name?, photo_path?, created_at)
- `pet_types`(id, owner_teacher_id, name, personality_desc, image_path, is_builtin[bool], sort_order)
- `point_items`(id, class_id, kind['add'|'subtract'], label, icon, points[int>0], sort_order)
- `level_config`(class_id, level[1..9], required_points[int]) — 各级累计所需**成长值**阈值
- `medals`(id, class_id, name, image_path, cost_points[int], sort_order)
- `student_medals`(id, student_id, medal_id, redeemed_at)
- `point_logs`(id, student_id, batch_id, delta_growth[int], delta_spendable[int],
  reason, growth_after, spendable_after, created_at)

### 关键规则

- **双数值**：
  - `growth_points`（成长值）**只增不减**，决定等级，永不掉级。
  - `spendable_points`（可用积分）用于兑换奖章，可增可减，下限为 0。
  - **加分**：两者**同时增加**相同分值。
  - **减分**：**只扣 `spendable_points`**（下限 0），**不动 `growth_points`**，因此不会掉级。
- **等级计算**：根据 `growth_points` 与 `level_config` 阈值得出当前等级（1–9），满级有标识。
- **奖章兑换**：`spendable_points >= medal.cost_points` 时可兑换，扣除 `cost_points`，写入 `student_medals` 与 `point_logs`。
- **撤销**：每次操作生成 `batch_id`；撤销上一步即按 `batch_id` 反向应用 delta 并删除对应日志。

## 6. 老师端功能

1. **班级**：创建/改名/删除/切换；班级设置（显示模式、生命周期、公共墙开关与隐私开关、token 重置、光荣榜是否并入展示墙）。
2. **学生名单**：单个添加、批量添加（粘贴名单）、删除、积分重置（含二次确认）、分组（批量+单个）、分组版视图与整组加减分。
3. **头像系统**：
   - 模式粒度：**按班级选**（宠物班 / 照片班），允许**个别学生单独覆盖**。
   - 宠物模式：一键分配未领养学生、（老师代）选宠物/命名/换形象、**自定义上传宠物种类**（名称+性格描述+图片）。
   - 照片模式：上传学生照片作头像。
   - 宠物形象：**一种宠物一张图**，升级只变等级牌，不变图（与原系统一致）。
4. **积分**：单个/批量加减分、自定义加减分项目（图标+分值）、撤销上一步、积分记录（按学生/按班级）。
5. **等级**：Lv.1–9 阈值设置（折线图拖拽/数值输入）、升级提示动画、满级标识；生命周期（饥饿/死亡天数）可选开关。
6. **奖章**：自定义奖章（名称+图标/图片+所需积分），学生兑换扣可用积分，兑换记录。
7. **公共链接管理**：查看/复制/重置 展示墙与奖章大厅链接；隐私开关（真实照片/姓名 vs 昵称/宠物）。

## 7. 公共墙（只读，适配大屏）

- **展示墙** `/wall/:token`：学生头像（宠物或照片）、昵称、等级、成长进度条、可用积分；顶部含**光荣榜**（前三领奖台 + 排名）。受隐私开关控制是否显示真实照片/姓名。
- **奖章大厅** `/medals/:token`：按学生展示其已获得的奖章及获得时间，班级奖章总数统计。

## 8. UI 主题（薄荷晴空）

- 主色 **cyan**（品牌、主按钮、链接、进度条）；强调色 **amber**（奖章、高亮、领奖台、升级）。
- 浅薄荷/白底、柔和圆角、清新留白；加分**绿**、减分**红**等语义色保留。
- 响应式：手机 / 电脑 / 希沃大屏（大字号、大按钮、可全屏）。
- Tailwind 主题集中配置，便于一处换色。

## 9. 部署与运维

- `Dockerfile`：多阶段（构建前端 → Node 运行时）。
- `docker-compose.yml`：单服务 `app`，端口映射，挂载 `./data:/data`。不含 Caddy。
- `.env`：`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`PORT`、`SESSION_SECRET`。
- README：部署步骤、备份（打包 `data` 目录）、放置到自有反向代理后的示例配置。

## 10. 测试策略

- 后端核心逻辑 **TDD**：积分增减/撤销、等级计算、奖章兑换扣分、token 生成与校验、批量操作。
- 关键 REST API 集成测试。
- 前端关键交互轻量测试（等级折线图编辑、加减分弹窗）。

## 11. 不做（YAGNI）

- 卡密激活 / 付费 / 计费
- 学生独立账号与自助端操作（公共墙只读）
- 小卖部 / 购物
- 多语言
- 宠物随等级进化多形象（暂用单图，未来可扩展）

## 12. 模块边界（便于实现与测试）

- **auth**：登录、session、初始管理员引导。
- **classes**：班级 CRUD、设置、token 管理。
- **students**：名单、分组、批量操作。
- **avatars**：宠物种类管理与上传、照片上传、模式切换。
- **points**：加减分、双数值规则、撤销、流水。
- **levels**：阈值配置与等级计算、生命周期。
- **medals**：奖章定义与兑换。
- **public**：展示墙与奖章大厅的只读数据接口（按 token）。
- **frontend**：老师端 SPA + 两个公共只读页面 + 薄荷晴空主题。
- **deploy**：Dockerfile / compose / 文档。
