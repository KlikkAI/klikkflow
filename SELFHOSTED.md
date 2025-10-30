# 🏠 Reporunner Self-Hosted Deployment Guide

Complete guide for deploying and activating your own Reporunner instance.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Getting Your Activation Key](#getting-your-activation-key)
4. [Installation Methods](#installation-methods)
5. [Configuration](#configuration)
6. [Activation](#activation)
7. [Updates](#updates)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

**Required:**
- Docker & Docker Compose (recommended) OR
- Node.js 18+ (for manual installation)
- MongoDB 6.0+
- PostgreSQL 14+ with pgvector extension
- Redis 6+

**System Requirements:**
- **Minimum**: 2 CPU cores, 4GB RAM, 20GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 50GB storage

---

## Quick Start

The fastest way to get Reporunner running:

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/reporunner.git
cd reporunner

# 2. Copy environment configuration
cp .env.selfhosted.example .env

# 3. Edit .env and add your ACTIVATION_KEY
nano .env

# 4. Start with Docker Compose
docker-compose up -d

# 5. Open http://localhost:3000
```

That's it! 🎉

---

## Getting Your Activation Key

Every self-hosted instance requires an activation key to connect with the Reporunner platform.

### Step 1: Register an Account

1. Go to [https://reporunner.com/register](https://reporunner.com/register)
2. Create your free account
3. Verify your email

### Step 2: Generate an API Key

1. Log in to your account
2. Navigate to **Settings** → **API Keys**
3. Click **"Create API Key"**
4. Give it a name (e.g., "My Self-Hosted Instance")
5. Select permissions (minimum: `read`, `write`, `execute`)
6. Click **"Create"**
7. **Important**: Copy your API key immediately - you won't see it again!

### Step 3: Use the Activation Key

```bash
# Add to your .env file:
ACTIVATION_KEY=rkr_live_abc123xyz...
```

---

## Installation Methods

### Method 1: Docker Compose (Recommended) ⭐

**Pros:** Easiest setup, includes all dependencies, production-ready

```bash
# 1. Download docker-compose.yml
wget https://raw.githubusercontent.com/yourusername/reporunner/main/docker-compose.yml

# 2. Create .env file
cat > .env << EOF
ACTIVATION_KEY=rkr_live_your_key_here
MONGODB_URI=mongodb://mongodb:27017/reporunner
POSTGRES_HOST=postgres
POSTGRES_DB=reporunner
POSTGRES_USER=reporunner
POSTGRES_PASSWORD=change_this_password
REDIS_HOST=redis
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f backend
```

**Services included:**
- Frontend (React app) → http://localhost:3000
- Backend (API server) → http://localhost:5000
- MongoDB (database)
- PostgreSQL (vector search)
- Redis (cache & queues)

### Method 2: Kubernetes with Helm

**Pros:** Scalable, production-grade, auto-healing

```bash
# Add Reporunner Helm repository
helm repo add reporunner https://charts.reporunner.com
helm repo update

# Install with your activation key
helm install my-reporunner reporunner/reporunner \
  --set activation.key=rkr_live_your_key_here \
  --set ingress.hosts[0].host=reporunner.yourdomain.com

# Check status
kubectl get pods -n reporunner
```

### Method 3: Manual Installation

**Pros:** Full control, development-friendly

```bash
# 1. Install dependencies
pnpm install

# 2. Build the project
pnpm build

# 3. Set up databases
# (MongoDB, PostgreSQL, Redis must be running)

# 4. Configure environment
cp .env.selfhosted.example .env
nano .env

# 5. Run migrations
pnpm run migrate

# 6. Start backend
pnpm --filter backend start

# 7. Start frontend (in another terminal)
pnpm --filter frontend dev
```

---

## Configuration

### Essential Configuration

Edit your `.env` file:

```bash
# Activation (REQUIRED)
ACTIVATION_KEY=rkr_live_your_activation_key_here
CENTRAL_API_URL=https://api.reporunner.com

# Instance Info
INSTANCE_HOSTNAME=my-reporunner.company.com
INSTANCE_PLATFORM=docker  # docker, vps, local, kubernetes, cloud

# Security (REQUIRED - generate unique values!)
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Application URLs
PORT=5000
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### Database Configuration

```bash
# MongoDB
MONGODB_URI=mongodb://username:password@mongo-host:27017/reporunner

# PostgreSQL
DATABASE_URL=postgresql://user:pass@postgres-host:5432/reporunner

# Redis
REDIS_URL=redis://redis-host:6379
```

### Optional Features

```bash
# Telemetry (helps improve the platform)
TELEMETRY_ENABLED=true
AUTO_UPDATE_CHECK=true
ANALYTICS_ENABLED=true

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

---

## Activation

### Automatic Activation (First Boot)

When you first start your instance with a valid `ACTIVATION_KEY`, it automatically:

1. ✅ Validates your API key with the central server
2. ✅ Generates a unique instance ID
3. ✅ Registers your installation
4. ✅ Starts heartbeat service (daily check-in)

**Check activation status:**

```bash
# In backend logs
docker-compose logs backend | grep "Instance activated"

# Or via API
curl http://localhost:5000/api/instances/my-instances \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Manual Activation (API)

If automatic activation fails, you can activate manually:

```bash
curl -X POST http://localhost:5000/api/instances/activate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "rkr_live_your_key_here",
    "hostname": "my-reporunner.company.com",
    "version": "1.0.0",
    "platform": "docker",
    "metadata": {
      "os": "linux",
      "nodeVersion": "18.17.0",
      "architecture": "x64",
      "cpu": 4,
      "memory": 8
    }
  }'
```

### Offline Mode (Air-Gapped)

For completely offline deployments:

1. Contact support for an **offline license file**
2. Place `license.key` in the root directory
3. Set `OFFLINE_MODE=true` in `.env`
4. No internet connection required

---

## Updates

### Checking for Updates

Your instance automatically checks for updates daily. View available updates:

**In the UI:**
- Look for notification banner: "New version available: v1.2.0"
- Go to **Settings** → **System** → **Updates**

**Via API:**
```bash
curl http://localhost:5000/api/instances/{instance-id}/updates
```

### Applying Updates

#### Docker Compose

```bash
# 1. Pull latest images
docker-compose pull

# 2. Restart services
docker-compose up -d

# 3. Check version
docker-compose logs backend | grep "version"
```

#### Kubernetes

```bash
# Upgrade with Helm
helm upgrade my-reporunner reporunner/reporunner
```

#### Manual Installation

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pnpm install

# 3. Rebuild
pnpm build

# 4. Run migrations
pnpm run migrate

# 5. Restart services
pnpm run restart
```

---

## Troubleshooting

### Activation Issues

**Error: "Invalid or expired API key"**
- ✅ Check that your API key is correctly copied (no extra spaces)
- ✅ Verify the key is still active in your account settings
- ✅ Ensure `CENTRAL_API_URL` is set to `https://api.reporunner.com`

**Error: "Instance limit reached"**
- ✅ You've reached your plan's instance limit
- ✅ Deactivate unused instances or upgrade your plan
- ✅ Go to [https://reporunner.com/settings/instances](https://reporunner.com/settings/instances)

**Error: "Cannot connect to central API"**
- ✅ Check internet connectivity
- ✅ Verify firewall allows outbound HTTPS
- ✅ Try `curl https://api.reporunner.com/health`

### Common Issues

**Backend won't start**
```bash
# Check logs
docker-compose logs backend

# Common fixes:
# - MongoDB connection: verify MONGODB_URI
# - Port conflict: change PORT in .env
# - Missing JWT_SECRET: generate with `openssl rand -base64 32`
```

**Frontend shows "API connection failed"**
```bash
# Check CORS_ORIGIN in backend .env
CORS_ORIGIN=http://localhost:3000

# Verify backend is running
curl http://localhost:5000/api/health
```

**Database connection errors**
```bash
# Test MongoDB connection
mongosh $MONGODB_URI

# Test PostgreSQL connection
psql $DATABASE_URL

# Test Redis connection
redis-cli -h $REDIS_HOST ping
```

### Getting Help

1. **Documentation**: [https://docs.reporunner.com](https://docs.reporunner.com)
2. **Community Forum**: [https://community.reporunner.com](https://community.reporunner.com)
3. **GitHub Issues**: [https://github.com/yourusername/reporunner/issues](https://github.com/yourusername/reporunner/issues)
4. **Email Support**: support@reporunner.com

---

## Advanced Configuration

### Custom Domain with HTTPS

```bash
# 1. Update .env
FRONTEND_URL=https://reporunner.yourdomain.com
CORS_ORIGIN=https://reporunner.yourdomain.com

# 2. Configure reverse proxy (Nginx example)
server {
    listen 443 ssl http2;
    server_name reporunner.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### High Availability Setup

For production deployments:

- **Load Balancer**: HAProxy or Nginx
- **Multiple Backend Instances**: Scale horizontally
- **Database Replication**: MongoDB replica set + PostgreSQL streaming
- **Redis Cluster**: For distributed caching
- **Monitoring**: Prometheus + Grafana

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed HA setup.

### Backup & Restore

```bash
# Backup databases
docker exec mongodb mongodump --out=/backup
docker exec postgres pg_dump reporunner > backup.sql

# Restore
docker exec mongodb mongorestore /backup
docker exec postgres psql reporunner < backup.sql
```

---

## License & Privacy

### Licensing

- Self-hosted instances require a valid activation key
- Free tier: 1 instance
- Paid tiers: Multiple instances + support

### Privacy Commitment

**What we collect:**
- Instance metadata (version, platform, last seen)
- Anonymous usage statistics (if enabled)

**What we DON'T collect:**
- Workflow data
- User credentials
- Execution results
- Any sensitive information

**Telemetry can be disabled:**
```bash
TELEMETRY_ENABLED=false
ANALYTICS_ENABLED=false
```

Even with telemetry disabled, activation checks are still required.

---

## Support & Community

- **Documentation**: https://docs.reporunner.com
- **Community Discord**: https://discord.gg/reporunner
- **GitHub Discussions**: https://github.com/yourusername/reporunner/discussions
- **Email**: support@reporunner.com

---

**Happy automating! 🚀**

For questions or issues, reach out to our community or open a GitHub issue.
