# Nginx Reverse Proxy Guide for Reporunner

## Overview

When deploying the full Reporunner stack (up to 22 containers), you need a reverse proxy to route external traffic to the correct internal services. This guide covers nginx configuration for accessing all services through a single domain with path-based or subdomain-based routing.

**Problem**: Running `docker-compose --profile full up` starts 22 containers, but how do users access them?

**Solution**: Use nginx as a reverse proxy to route traffic:
- `app.example.com` → Frontend (React app)
- `app.example.com/api` → Backend API
- `app.example.com/socket.io` → WebSocket connections
- `grafana.example.com` → Monitoring dashboards
- `kibana.example.com` → Log analytics

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Container Access Map](#container-access-map)
3. [Method 1: Nginx as Docker Container (Recommended)](#method-1-nginx-as-docker-container-recommended)
4. [Method 2: Standalone Nginx Installation](#method-2-standalone-nginx-installation)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Production Best Practices](#production-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
    ↓
Nginx Reverse Proxy (Port 80/443)
    ↓
    ├── /                    → Frontend Container (Port 3000)
    ├── /api/*               → Backend Container (Port 3001)
    ├── /socket.io/*         → Backend WebSocket (Port 3001)
    ├── /grafana/*           → Grafana (Port 3030)
    ├── /prometheus/*        → Prometheus (Port 9090)
    ├── /kibana/*            → Kibana (Port 5601)
    └── /jaeger/*            → Jaeger UI (Port 16686)
```

**Subdomain Architecture** (Alternative):
```
app.example.com          → Frontend
api.example.com          → Backend
ws.example.com           → WebSocket
grafana.example.com      → Grafana
kibana.example.com       → Kibana
prometheus.example.com   → Prometheus
jaeger.example.com       → Jaeger
```

---

## Container Access Map

Here are all 22 services that can run in the full deployment:

### Core Application Services (6)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **Frontend** | `reporunner-frontend` | 3000 | React web application | `/` |
| **Backend** | `reporunner-backend` | 3001 | REST API + WebSocket | `/api`, `/socket.io` |
| **Worker** | `reporunner-worker` | N/A | Background job processing | Internal only |
| **PostgreSQL** | `reporunner-postgres` | 5432 | Primary database | Internal only |
| **MongoDB** | `reporunner-mongodb` | 27017 | Document database | Internal only |
| **Redis** | `reporunner-redis` | 6379 | Cache + queue | Internal only |

### Development Tools (1)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **MailHog** | `reporunner-mailhog` | 8025 | Email testing UI | `/mailhog` or subdomain |

### Core Monitoring (3)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **Prometheus** | `reporunner-prometheus` | 9090 | Metrics collection | `/prometheus` |
| **Grafana** | `reporunner-grafana` | 3030 | Metrics visualization | `/grafana` |
| **Jaeger** | `reporunner-jaeger` | 16686 | Distributed tracing | `/jaeger` |

### Logging Stack - ELK (4)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **Elasticsearch** | `reporunner-elasticsearch` | 9200, 9300 | Log storage | Internal only |
| **Logstash** | `reporunner-logstash` | 5044, 5000 | Log processing | Internal only |
| **Kibana** | `reporunner-kibana` | 5601 | Log analytics UI | `/kibana` |
| **Filebeat** | `reporunner-filebeat` | N/A | Log shipping | Internal only |

### Metrics Exporters (5)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **Node Exporter** | `reporunner-node-exporter` | 9100 | System metrics | Internal only |
| **cAdvisor** | `reporunner-cadvisor` | 8080 | Container metrics | Internal only |
| **Redis Exporter** | `reporunner-redis-exporter` | 9121 | Redis metrics | Internal only |
| **PostgreSQL Exporter** | `reporunner-postgres-exporter` | 9187 | PostgreSQL metrics | Internal only |
| **MongoDB Exporter** | `reporunner-mongodb-exporter` | 9216 | MongoDB metrics | Internal only |

### Alerting (1)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **AlertManager** | `reporunner-alertmanager` | 9093 | Alert management | `/alertmanager` |

### Load Balancing (1)

| Service | Container Name | Internal Port | Purpose | External Access |
|---------|---------------|---------------|---------|-----------------|
| **Nginx** | `reporunner-nginx` | 80, 443 | Reverse proxy | Entry point |

**Total: 22 Services**

---

## Method 1: Nginx as Docker Container (Recommended)

### Why Docker Container?

✅ **Advantages:**
- Portable across environments
- Easy to version control configuration
- Consistent behavior in dev/staging/production
- Can be included in docker-compose.yml
- No system-level nginx installation required

### Step 1: Create Nginx Configuration

Create `infrastructure/docker/nginx/production.conf`:

```nginx
# ============================================
# Nginx Reverse Proxy for Reporunner
# Production Configuration
# ============================================

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

worker_rlimit_nofile 8192;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging Format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # Performance Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Upload limits
    client_max_body_size 100M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;
    gzip_min_length 256;

    # Upstream Definitions
    upstream backend_api {
        server backend:3001 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }

    upstream frontend_app {
        server frontend:3000 max_fails=3 fail_timeout=30s;
    }

    upstream grafana_dashboard {
        server grafana:3000 max_fails=2 fail_timeout=10s;
    }

    upstream prometheus_metrics {
        server prometheus:9090 max_fails=2 fail_timeout=10s;
    }

    upstream jaeger_ui {
        server jaeger:16686 max_fails=2 fail_timeout=10s;
    }

    upstream kibana_logs {
        server kibana:5601 max_fails=2 fail_timeout=10s;
    }

    # ==========================================
    # Main Application Server
    # ==========================================
    server {
        listen 80;
        listen [::]:80;
        server_name _;

        # Security Headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # ==========================================
        # Health Check
        # ==========================================
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }

        # ==========================================
        # API Routes (REST)
        # ==========================================
        location /api/ {
            proxy_pass http://backend_api;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header Connection "";

            # Buffer settings
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;

            # Error handling
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
            proxy_next_upstream_tries 2;
        }

        # ==========================================
        # WebSocket Routes (Socket.IO)
        # ==========================================
        location /socket.io/ {
            proxy_pass http://backend_api;
            proxy_http_version 1.1;

            # WebSocket upgrade headers
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Extended timeouts for WebSocket
            proxy_connect_timeout 7d;
            proxy_send_timeout 7d;
            proxy_read_timeout 7d;

            # Disable buffering
            proxy_buffering off;

            # No retry for WebSocket
            proxy_next_upstream off;
        }

        # ==========================================
        # Grafana Dashboard
        # ==========================================
        location /grafana/ {
            rewrite ^/grafana/(.*) /$1 break;
            proxy_pass http://grafana_dashboard;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Grafana WebSocket (for live updates)
        location /grafana/api/live/ {
            rewrite ^/grafana/(.*) /$1 break;
            proxy_pass http://grafana_dashboard;
            proxy_http_version 1.1;

            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }

        # ==========================================
        # Prometheus Metrics
        # ==========================================
        location /prometheus/ {
            proxy_pass http://prometheus_metrics;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # ==========================================
        # Jaeger Tracing UI
        # ==========================================
        location /jaeger/ {
            proxy_pass http://jaeger_ui/;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # ==========================================
        # Kibana Log Analytics
        # ==========================================
        location /kibana/ {
            rewrite ^/kibana/(.*) /$1 break;
            proxy_pass http://kibana_logs;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # Kibana requires these for WebSocket
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # ==========================================
        # Frontend Application
        # ==========================================
        location / {
            proxy_pass http://frontend_app;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Cache frontend responses
            proxy_cache_bypass $http_upgrade;
        }

        # ==========================================
        # Error Pages
        # ==========================================
        error_page 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
            internal;
        }
    }
}
```

### Step 2: Add Nginx to docker-compose.yml

Add this service to your `infrastructure/docker/docker-compose.yml`:

```yaml
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: reporunner-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/production.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - frontend
      - backend
      - grafana
      - prometheus
      - jaeger
      - kibana
    networks:
      - reporunner-network
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  nginx_logs:
    name: reporunner_nginx_logs
```

### Step 3: Start All Services

```bash
cd infrastructure/docker

# Start core services + monitoring + nginx
docker-compose --profile full up -d

# Verify nginx is running
docker ps | grep nginx

# Check nginx configuration
docker exec reporunner-nginx nginx -t

# View nginx logs
docker logs reporunner-nginx -f
```

### Step 4: Access Your Services

Open your browser:

- **Frontend**: http://localhost/
- **API**: http://localhost/api/health
- **Grafana**: http://localhost/grafana/
- **Prometheus**: http://localhost/prometheus/
- **Jaeger**: http://localhost/jaeger/
- **Kibana**: http://localhost/kibana/

---

## Method 2: Standalone Nginx Installation

If you prefer installing nginx on the host system (Ubuntu/Debian example):

### Step 1: Install Nginx

```bash
# Update package list
sudo apt update

# Install nginx
sudo apt install nginx -y

# Check status
sudo systemctl status nginx
```

### Step 2: Create Site Configuration

Create `/etc/nginx/sites-available/reporunner`:

```nginx
server {
    listen 80;
    server_name app.example.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Grafana
    location /grafana/ {
        proxy_pass http://localhost:3030/;
        proxy_set_header Host $host;
    }

    # Prometheus
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
        proxy_set_header Host $host;
    }
}
```

### Step 3: Enable Site and Reload

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/reporunner /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Free, Automatic)

Using **Certbot**:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d app.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Option 2: Self-Signed Certificate (Development)

```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/reporunner.key \
  -out /etc/nginx/ssl/reporunner.crt \
  -subj "/C=US/ST=State/L=City/O=Org/CN=app.example.com"

# Add to nginx config
ssl_certificate /etc/nginx/ssl/reporunner.crt;
ssl_certificate_key /etc/nginx/ssl/reporunner.key;
```

### Option 3: Commercial Certificate

Place your certificate files:

```bash
/etc/nginx/ssl/
├── certificate.crt
├── certificate.key
└── ca_bundle.crt
```

Update nginx config:

```nginx
ssl_certificate /etc/nginx/ssl/certificate.crt;
ssl_certificate_key /etc/nginx/ssl/certificate.key;
ssl_trusted_certificate /etc/nginx/ssl/ca_bundle.crt;
```

### Complete HTTPS Configuration

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.example.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/certificate.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Rest of your proxy configuration...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name app.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Production Best Practices

### 1. Rate Limiting

Protect against DDoS and brute force:

```nginx
http {
    # Define rate limit zones
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

    server {
        # Apply to API routes
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend_api;
        }

        # Stricter limit for auth
        location /api/auth/ {
            limit_req zone=auth_limit burst=5 nodelay;
            proxy_pass http://backend_api;
        }
    }
}
```

### 2. IP Whitelisting for Monitoring

Restrict access to sensitive dashboards:

```nginx
location /grafana/ {
    # Allow specific IPs
    allow 10.0.0.0/8;       # Internal network
    allow 203.0.113.0/24;   # Office network
    deny all;

    proxy_pass http://grafana_dashboard;
}
```

### 3. Request Body Size Limits

Prevent memory exhaustion:

```nginx
http {
    # Default limit
    client_max_body_size 10M;

    server {
        # Higher limit for file uploads
        location /api/workflows/import {
            client_max_body_size 100M;
            proxy_pass http://backend_api;
        }
    }
}
```

### 4. Timeouts for Different Routes

```nginx
# Fast timeout for health checks
location /health {
    proxy_connect_timeout 2s;
    proxy_send_timeout 5s;
    proxy_read_timeout 5s;
    proxy_pass http://backend_api;
}

# Extended timeout for workflow execution
location /api/workflows/execute {
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    proxy_pass http://backend_api;
}
```

### 5. Caching Static Assets

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    proxy_pass http://frontend_app;
    proxy_cache_valid 200 1d;
    proxy_cache_bypass $http_cache_control;
    add_header Cache-Control "public, immutable";
    expires 1y;
}
```

### 6. Logging

Separate logs for different purposes:

```nginx
http {
    # Access log with custom format
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        'rt=$request_time uct="$upstream_connect_time" '
                        'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log detailed;
    error_log /var/log/nginx/error.log warn;

    server {
        # Disable logging for health checks
        location /health {
            access_log off;
            proxy_pass http://backend_api;
        }
    }
}
```

---

## Troubleshooting

### Issue: 502 Bad Gateway

**Cause**: Backend container not ready or not accessible.

**Solution**:
```bash
# Check if backend is running
docker ps | grep backend

# Check backend logs
docker logs reporunner-backend

# Verify backend health
curl http://localhost:3001/health

# Check nginx error logs
docker logs reporunner-nginx
```

### Issue: WebSocket Connection Fails

**Cause**: Missing upgrade headers.

**Solution**: Ensure your nginx config includes:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Issue: Grafana Dashboard Shows 404

**Cause**: Path rewriting issues.

**Solution**: Check your rewrite rules:
```nginx
location /grafana/ {
    rewrite ^/grafana/(.*) /$1 break;  # Remove /grafana prefix
    proxy_pass http://grafana:3000;
}
```

And set Grafana root URL in docker-compose.yml:
```yaml
grafana:
  environment:
    GF_SERVER_ROOT_URL: http://your-domain.com/grafana
```

### Issue: Large File Upload Fails

**Cause**: Request body size limit.

**Solution**: Increase limit in nginx config:
```nginx
client_max_body_size 100M;
```

### Issue: Slow API Responses

**Cause**: Buffering or timeout issues.

**Solution**: Adjust buffer and timeout settings:
```nginx
proxy_buffering off;  # For streaming responses
proxy_read_timeout 300s;  # For long-running requests
```

---

## Next Steps

- [Domain Management Guide](./domain-management.md) - DNS setup for all cloud providers
- [SSL/TLS Certificate Guide](./ssl-certificates.md) - Detailed certificate management
- [Load Balancer Configurations](./load-balancers/) - Cloud provider-specific load balancers
- [Kubernetes Ingress](../kubernetes/ingress.md) - K8s ingress controller setup

---

**Last Updated**: October 27, 2025
**Maintained By**: Reporunner Development Team
