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

    client_max_body_size 12m;   # 5MB 原始图片经 base64 编码后约 7MB,12m 留余量(应用 bodyLimit 为 10MB)

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
> Caddy 会自动申请并续期 HTTPS 证书,无需像 nginx 那样手动配置 certbot。

## 4. 常见问题
- **登录成功但刷新后退出**:多半是用 http 直连了 `production` 模式(Secure Cookie 被丢弃)。请走 HTTPS,或本机测试时设 `NODE_ENV=development`。
- **图片上传失败/413**:反向代理的 body 大小限制太小,调大到 ≥12MB。
- **公共墙打不开**:确认用的是最新的班级链接(老师重置过 token 则旧链接失效)。
- **迁移/数据**:升级自动迁移;务必先备份 `data/`。
