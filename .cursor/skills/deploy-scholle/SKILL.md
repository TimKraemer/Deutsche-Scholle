---
name: deploy-scholle
description: Build and deploy this app to https://scholle.tim-kraemer.de (nginx container on the scortex-vm server via SSH + rsync). Use when the user asks to deploy, publish, release, or ship this project, or to update the live site.
---

# Deploy Deutsche Scholle

Deploys the built SPA to `https://scholle.tim-kraemer.de`. The site is served by an
nginx Docker container on the server reachable via `ssh scortex-vm`. The web root is
**bind-mounted**, so a normal deploy is just **build + rsync** — no container restart needed.

## Standard deploy (recurring)

Run these from the project root:

```bash
# 1. Build the production bundle
bun run build

# 2. Sync dist/ to the server web root (mirrors, deletes removed files)
rsync -az --delete -e ssh dist/ scortex-vm:/var/www/www-scholle/

# 3. Verify (expect HTTP 200; the SPA route must also return 200)
curl -sS -o /dev/null -w "root: HTTP %{http_code}\n" https://scholle.tim-kraemer.de/
curl -sS -o /dev/null -w "spa:  HTTP %{http_code}\n" https://scholle.tim-kraemer.de/123
```

That's it. Because `/var/www/www-scholle/` is mounted into the container read-only,
the new files are live immediately after rsync.

## Pre-deploy checklist

- [ ] Working tree is clean / changes are committed (deploy ships the local build, not git HEAD).
- [ ] `bun run build` succeeds (it runs `tsc -b` first, so type errors block the deploy).
- [ ] Then run the rsync + verify steps above.

## Infrastructure (reference — one-time setup, already done)

The server follows the existing `/opt/services/*.yaml` + `dc` pattern (the `dc` script at
`/usr/local/bin/dc` loads every `*.yaml` in `/opt/services/` as one compose project that
shares the `nginx-proxy` + `acme-companion` from the main `docker-compose.yaml`).

Files on the server (`scortex:root` owns the web root; `/opt/services` needs `sudo`):

- `/var/www/www-scholle/` — web root (rsync target)
- `/opt/services/scholle/default.conf` — nginx config with **SPA fallback** for
  `BrowserRouter` routes like `/:gardenNumber`, plus immutable caching for `/assets/`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gehashte Assets aggressiv und unveraenderlich cachen
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # HTML/SPA-Einstiegspunkt nie hart cachen, damit nach einem Deploy
    # immer die aktuellen Asset-Hashes geladen werden (Revalidierung via ETag).
    # Ohne dies cachen Browser index.html heuristisch und zeigen alte Builds.
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
    }
}
```

After editing this config on the server, reload nginx (the config is bind-mounted, no restart needed):

```bash
ssh scortex-vm 'docker exec scholle-nginx nginx -t && docker exec scholle-nginx nginx -s reload'
```

- `/opt/services/scholle.yaml` — compose service joined to the proxy network. Host port
  `8204:80` (8201–8203 were taken); the proxy routes via the internal network, not the host port:

```yaml
services:
  scholle-nginx:
    container_name: scholle-nginx
    ports:
      - "8204:80"
    volumes:
      - "/var/www/www-scholle/:/usr/share/nginx/html:ro"
      - "/opt/services/scholle/default.conf:/etc/nginx/conf.d/default.conf:ro"
    image: nginx
    restart: always
    depends_on:
      - nginx-proxy
      - acme-companion
    networks:
      - public
    environment:
      - VIRTUAL_HOST=scholle.tim-kraemer.de
      - LETSENCRYPT_HOST=scholle.tim-kraemer.de
      - LETSENCRYPT_EMAIL=tk@scortex.de
```

### Start / restart the container (only if config changed)

```bash
ssh scortex-vm 'sudo dc up -d scholle-nginx'
```

The `acme-companion` issues the Let's Encrypt cert automatically on first start (can take
a minute). Check with:

```bash
ssh scortex-vm 'docker logs --tail 60 nginx-proxy-acme 2>&1 | grep -i scholle'
```

## Notes

- A harmless `bind [127.0.0.1]:5005: Address already in use` warning may appear on SSH; it
  does not affect the deploy.
- For a config/infra change, edit the files under `/opt/services/` (needs `sudo`) and run
  `sudo dc up -d scholle-nginx`. For content-only updates, build + rsync is enough.
