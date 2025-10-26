# KlikkFlow Deployment Guide

Complete deployment guide for KlikkFlow workflow automation platform across all environments and cloud providers.

**Last Updated**: October 2025
**Version**: 1.0.0
**Target Audience**: DevOps Engineers, System Administrators, Platform Engineers

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Deployment Options Overview](#deployment-options-overview)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Cloud Provider Deployments](#cloud-provider-deployments)
6. [Production Best Practices](#production-best-practices)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [Backup and Recovery](#backup-and-recovery)
9. [Troubleshooting](#troubleshooting)
10. [Upgrade Guide](#upgrade-guide)

---

## Quick Start

Get KlikkFlow running in **60 seconds** with the core stack:

```bash
# Clone repository
git clone https://github.com/KlikkAI/klikkflow.git
cd klikkflow

# Start core services (6 containers)
docker-compose up -d

# Verify health
docker-compose ps
curl http://localhost:3000/health
```

**Access Points**:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- MongoDB: localhost:27017
- PostgreSQL: localhost:5432
- Redis: localhost:6379

**Default Credentials**:
- Email: `demo@klikkflow.com`
- Password: `demo123`

---

## Deployment Options Overview

KlikkFlow supports multiple deployment strategies:

| Deployment Type | Use Case | Startup Time | Containers | Complexity |
|----------------|----------|--------------|------------|------------|
| **Core Only** | Local development, testing | 60s | 6 | Low |
| **Core + Monitoring** | Development, staging | 90s | 12 | Medium |
| **Core + HA** | Production (small-medium) | 120s | 10 | Medium |
| **Full Stack** | Production (enterprise) | 180s | 22 | High |
| **Kubernetes** | Production, multi-tenant | 300s | 15+ | High |
| **Cloud Managed** | Production, scalable | Varies | Managed | Medium |

---

## Docker Compose Deployment

### Profile-Based Architecture

KlikkFlow uses Docker Compose profiles for progressive complexity:

```yaml
# 5 Available Profiles:
- monitoring   # Prometheus, Grafana, AlertManager, exporters (adds 6 containers)
- ha           # High Availability with load balancer, backups (adds 4 containers)
- logging      # ELK stack for centralized logging (adds 3 containers)
- dev          # Dev tools: MailHog, Adminer, Redis Commander (adds 3 containers)
- full         # All profiles combined (22 containers)
```

### Deployment Scenarios

#### 1. Core Only (Solo Developer)

```bash
# Start core services
docker-compose up -d

# Services: frontend, backend, worker, mongo, postgres, redis (6 containers)
# Resources: ~2GB RAM, 2 CPUs
# Best for: Local development, quick testing
```

#### 2. Core + Monitoring (Team Development)

```bash
# Start with monitoring
docker-compose --profile monitoring up -d

# Adds: Prometheus, Grafana, AlertManager, node-exporter, redis-exporter, mongodb-exporter
# Total: 12 containers
# Resources: ~4GB RAM, 4 CPUs
# Access Grafana: http://localhost:3030 (admin/admin)
```

#### 3. Core + High Availability (Production Ready)

```bash
# Start with HA
docker-compose --profile ha up -d

# Adds: nginx-lb, backup, backend-2, worker-2
# Total: 10 containers
# Resources: ~6GB RAM, 4 CPUs
# Load Balancer: http://localhost (round-robin to backends)
```

#### 4. Full Stack (Enterprise Production)

```bash
# Start all profiles
docker-compose --profile full up -d

# Total: 22 containers
# Resources: ~12GB RAM, 8 CPUs
# Includes: Monitoring, HA, Logging, Dev Tools
```

#### 5. Custom Profile Combination

```bash
# Mix profiles as needed
docker-compose --profile monitoring --profile ha up -d

# Total: 16 containers (core + monitoring + ha)
# Best for: Production with monitoring, no logging overhead
```

### Environment Variables

Create `.env` file in the project root:

```bash
# Note: Angle brackets <> indicate placeholders - replace with your actual values

# Core Configuration
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000

# Database URLs (replace <PLACEHOLDERS> with your actual credentials)
MONGODB_URI=mongodb://<MONGO_USER>:<MONGO_PASSWORD>@mongo:27017/klikkflow
POSTGRES_URI=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/klikkflow
REDIS_URL=redis://:<REDIS_PASSWORD>@redis:6379

# Security (IMPORTANT: Generate secure random values!)
JWT_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-32-character-encryption-key>

# OAuth (Optional - for integrations)
GMAIL_CLIENT_ID=<your-gmail-oauth-client-id>
GMAIL_CLIENT_SECRET=<your-gmail-oauth-client-secret>

# Monitoring (Optional)
GRAFANA_ADMIN_PASSWORD=<secure-grafana-admin-password>

# Backup (Optional - for S3 backup)
BACKUP_S3_BUCKET=klikkflow-backups
BACKUP_S3_ENDPOINT=https://s3.amazonaws.com
BACKUP_RETENTION_DAYS=7
```

### Docker Compose Commands

```bash
# Start services
docker-compose up -d                          # Core only
docker-compose --profile full up -d           # All profiles

# View logs
docker-compose logs -f                        # All services
docker-compose logs -f backend                # Specific service

# Stop services
docker-compose down                           # Keep data
docker-compose down -v                        # Remove data volumes

# Restart service
docker-compose restart backend

# Scale workers
docker-compose up -d --scale worker=3

# Health check
docker-compose ps
curl http://localhost:3000/health
curl http://localhost:3001/api/health

# View resource usage
docker stats

# Cleanup
docker-compose down -v --remove-orphans       # Full cleanup
docker system prune -a --volumes              # Clean Docker system
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Helm 3.x installed
- Persistent Volume provisioner (e.g., AWS EBS, GCP Persistent Disk)

### Helm Installation

```bash
# Add Helm repo (when available)
helm repo add klikkflow https://charts.klikkflow.com
helm repo update

# Install with default values
helm install klikkflow klikkflow/klikkflow \
  --namespace klikkflow \
  --create-namespace

# Install with custom values
helm install klikkflow klikkflow/klikkflow \
  --namespace klikkflow \
  --create-namespace \
  --values custom-values.yaml
```

### Custom Helm Values Example

Create `custom-values.yaml`:

```yaml
# KlikkFlow Configuration
klikkflow:
  backend:
    replicas: 3
    image:
      repository: klikkflow/backend
      tag: "1.0.0"
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 2000m
        memory: 4Gi

  frontend:
    replicas: 2
    image:
      repository: klikkflow/frontend
      tag: "1.0.0"
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi

  worker:
    replicas: 5
    image:
      repository: klikkflow/worker
      tag: "1.0.0"
    resources:
      requests:
        cpu: 1000m
        memory: 2Gi
      limits:
        cpu: 4000m
        memory: 8Gi

# MongoDB Configuration
mongodb:
  enabled: true
  architecture: replicaset
  replicaCount: 3
  auth:
    enabled: true
    rootPassword: "change-this-mongodb-root-password"
    username: klikkflow
    password: "change-this-mongodb-password"
    database: klikkflow
  persistence:
    size: 50Gi
    storageClass: "gp3"  # AWS EBS gp3

# PostgreSQL Configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: "change-this-postgres-password"
    username: klikkflow
    password: "change-this-postgres-password"
    database: klikkflow
  primary:
    persistence:
      size: 20Gi
      storageClass: "gp3"
  pgvector:
    enabled: true  # Enable pgvector extension

# Redis Configuration
redis:
  enabled: true
  architecture: standalone
  auth:
    enabled: true
    password: "change-this-redis-password"
  master:
    persistence:
      size: 10Gi
      storageClass: "gp3"

# Ingress Configuration
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: app.klikkflow.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: klikkflow-tls
      hosts:
        - app.klikkflow.com

# Monitoring
monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "change-this-grafana-password"

# Autoscaling
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
```

### Kubectl Deployment (Manual)

If not using Helm, deploy manually with kubectl:

```bash
# Create namespace
kubectl create namespace klikkflow

# Apply secrets
# Note: Angle brackets <> indicate placeholders - replace with your actual values
# Example: mongodb://<USERNAME>:<PASSWORD>@host becomes mongodb://admin:secret123@host
#
# First, set your credentials as environment variables:
# export JWT_SECRET="<your-secure-random-jwt-secret>"
# export MONGODB_URI="mongodb://<USERNAME>:<PASSWORD>@mongo:27017/klikkflow"
# export POSTGRES_URI="postgresql://<USERNAME>:<PASSWORD>@postgres:5432/klikkflow"
# export REDIS_URL="redis://:<REDIS_PASSWORD>@redis:6379"

kubectl create secret generic klikkflow-secrets \
  --from-literal=jwt-secret="${JWT_SECRET}" \
  --from-literal=mongodb-uri="${MONGODB_URI}" \
  --from-literal=postgres-uri="${POSTGRES_URI}" \
  --from-literal=redis-url="${REDIS_URL}" \
  -n klikkflow

# Apply manifests
kubectl apply -f infrastructure/kubernetes/manifests/ -n klikkflow

# Verify deployment
kubectl get pods -n klikkflow
kubectl get services -n klikkflow
kubectl get ingress -n klikkflow
```

---

## Cloud Provider Deployments

### AWS Deployment

#### Option 1: ECS Fargate (Serverless)

```bash
cd infrastructure/terraform/aws/ecs

# Note: Angle brackets <> indicate placeholders - replace with your actual values
# First, set your credentials as environment variables:
# export MONGODB_URI="mongodb+srv://<USERNAME>:<PASSWORD>@cluster.mongodb.net/klikkflow"
# export POSTGRES_URI="postgresql://<USERNAME>:<PASSWORD>@rds-instance.region.rds.amazonaws.com:5432/klikkflow"
# export REDIS_URI="redis://elasticache-cluster.region.cache.amazonaws.com:6379"

# Configure variables
cat > terraform.tfvars <<EOF
region = "us-east-1"
environment = "production"
vpc_cidr = "10.0.0.0/16"
mongodb_uri = "${MONGODB_URI}"
postgres_uri = "${POSTGRES_URI}"
redis_uri = "${REDIS_URI}"
EOF

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Estimated cost: $220/mo (dev), $1,950/mo (production)
```

**AWS Components**:
- **ECS Fargate**: Serverless containers (frontend, backend, worker)
- **RDS PostgreSQL**: Managed database with pgvector support
- **DocumentDB**: MongoDB-compatible managed database
- **ElastiCache Redis**: Managed Redis for BullMQ
- **ALB**: Application Load Balancer for traffic distribution
- **CloudWatch**: Monitoring and logging
- **Auto Scaling**: Dynamic scaling based on CPU/memory

#### Option 2: EKS (Kubernetes)

```bash
cd infrastructure/terraform/aws/eks

# Deploy EKS cluster
terraform init
terraform plan
terraform apply

# Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name klikkflow-cluster

# Install with Helm
helm install klikkflow ./infrastructure/kubernetes/helm/klikkflow \
  --namespace klikkflow \
  --create-namespace \
  --values infrastructure/kubernetes/helm/values-aws.yaml
```

### GCP Deployment

#### Option 1: Cloud Run (Serverless)

```bash
cd infrastructure/terraform/gcp/cloud-run

# Configure project
gcloud config set project YOUR_PROJECT_ID

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Estimated cost: $110/mo (dev), $1,850/mo (production)
```

**GCP Components**:
- **Cloud Run**: Serverless containers with auto-scaling
- **Cloud SQL**: Managed PostgreSQL with pgvector
- **Memorystore**: Managed Redis
- **Cloud Storage**: File storage with CDN
- **Cloud Armor**: DDoS protection and WAF
- **Cloud Monitoring**: Observability

#### Option 2: GKE (Kubernetes)

```bash
cd infrastructure/terraform/gcp/gke

# Deploy GKE cluster
terraform init
terraform apply

# Get credentials
gcloud container clusters get-credentials klikkflow-cluster --region us-central1

# Install with Helm
helm install klikkflow ./infrastructure/kubernetes/helm/klikkflow \
  --namespace klikkflow \
  --create-namespace \
  --values infrastructure/kubernetes/helm/values-gcp.yaml
```

### Azure Deployment

#### Option 1: Container Instances (Serverless)

```bash
cd infrastructure/terraform/azure/aci

# Login to Azure
az login

# Deploy infrastructure
terraform init
terraform plan
terraform apply

# Estimated cost: $220/mo (dev), $2,650/mo (production)
```

**Azure Components**:
- **Azure Container Instances**: Serverless containers
- **Azure Database for PostgreSQL**: Managed PostgreSQL with pgvector
- **Cosmos DB**: MongoDB API compatible
- **Azure Cache for Redis**: Managed Redis
- **Application Gateway**: Load balancer with WAF
- **Azure Monitor**: Monitoring and logging

#### Option 2: AKS (Kubernetes)

```bash
cd infrastructure/terraform/azure/aks

# Deploy AKS cluster
terraform init
terraform apply

# Get credentials
az aks get-credentials --resource-group klikkflow-rg --name klikkflow-cluster

# Install with Helm
helm install klikkflow ./infrastructure/kubernetes/helm/klikkflow \
  --namespace klikkflow \
  --create-namespace \
  --values infrastructure/kubernetes/helm/values-azure.yaml
```

---

## Production Best Practices

### 1. Security Hardening

```bash
# Use secrets management
# AWS: Secrets Manager
# GCP: Secret Manager
# Azure: Key Vault

# Example with AWS Secrets Manager
aws secretsmanager create-secret \
  --name klikkflow/production/jwt-secret \
  --secret-string "your-secure-jwt-secret"

# Rotate secrets regularly (90 days recommended)
# Enable encryption at rest for all databases
# Use TLS/SSL for all connections
# Implement network policies in Kubernetes
# Enable audit logging
```

### 2. Resource Limits

```yaml
# Kubernetes resource limits example
resources:
  requests:
    cpu: 1000m      # Guaranteed CPU
    memory: 2Gi     # Guaranteed memory
  limits:
    cpu: 4000m      # Max CPU
    memory: 8Gi     # Max memory
```

### 3. High Availability

- **Multiple Replicas**: Run at least 2-3 replicas of each service
- **Pod Anti-Affinity**: Spread pods across nodes/zones
- **Load Balancing**: Use managed load balancers (ALB, GCP LB, Azure LB)
- **Database Replication**: MongoDB ReplicaSet (3 nodes), PostgreSQL standby replicas
- **Redis Sentinel/Cluster**: For Redis high availability
- **Backup Strategy**: Automated daily backups with 30-day retention

### 4. Performance Optimization

```bash
# Connection Pooling
# MongoDB: 50-100 connections per backend instance
# PostgreSQL: 20-50 connections per backend instance
# Redis: 10-20 connections per backend instance

# Caching Strategy
# Enable Redis caching for:
# - User sessions (TTL: 24h)
# - Workflow definitions (TTL: 1h)
# - Integration metadata (TTL: 6h)

# Database Indexing
# Ensure proper indexes on:
# - workflows.userId
# - executions.workflowId
# - executions.startedAt
# - credentials.userId
```

### 5. Monitoring and Alerting

Set up alerts for:
- **API Error Rate**: >5% errors
- **Response Time**: p95 >2s
- **Queue Depth**: >1000 jobs waiting
- **CPU Usage**: >80% sustained
- **Memory Usage**: >85% sustained
- **Disk Usage**: >85% full
- **Failed Logins**: >50% failure rate

---

## Monitoring and Observability

### Grafana Dashboards

Access Grafana at `http://localhost:3030` (default: admin/admin)

**7 Pre-configured Dashboards**:
1. **API Performance**: Request rates, latency (p50, p95), error rates
2. **Workflow Execution**: Execution metrics, success rates, duration
3. **System Health**: CPU, memory, disk, network usage
4. **Database Performance**: MongoDB/PostgreSQL operations, connections, latency
5. **Queue Metrics**: BullMQ job processing, queue depths, Redis stats
6. **Security**: Authentication attempts, failed logins, rate limiting
7. **Business Metrics**: Active users, workflows, executions, integrations

### Prometheus Metrics

Access Prometheus at `http://localhost:9090`

**Key Metrics**:
```promql
# API Performance
rate(http_requests_total[5m])
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Workflow Execution
rate(workflow_executions_total[5m])
workflow_execution_duration_seconds

# System Resources
node_cpu_seconds_total
node_memory_MemAvailable_bytes

# Database
mongodb_opcounters_total
pg_stat_database_xact_commit
```

### Logging

#### ELK Stack (Elasticsearch + Kibana)

```bash
# Start with logging profile
docker-compose --profile logging up -d

# Access Kibana: http://localhost:5601
# Configure index pattern: filebeat-*
```

#### Cloud Logging

- **AWS**: CloudWatch Logs
- **GCP**: Cloud Logging
- **Azure**: Azure Monitor Logs

---

## Backup and Recovery

### Automated Backups

The backup service automatically backs up both databases:

```yaml
# Configuration (docker-compose.yml)
backup:
  environment:
    BACKUP_SCHEDULE: "0 2 * * *"  # 2 AM daily
    BACKUP_RETENTION_DAYS: 7
    S3_BUCKET: klikkflow-backups
    S3_ENDPOINT: https://s3.amazonaws.com
```

**Backup Locations**:
- Local: `/backups` volume
- S3: `s3://your-bucket/mongodb/YYYY-MM-DD/` and `s3://your-bucket/postgresql/YYYY-MM-DD/`

### Manual Backup

```bash
# Trigger manual backup
docker-compose exec backup /app/backup.sh

# MongoDB manual backup
docker-compose exec mongo mongodump --uri="mongodb://mongo:27017/klikkflow" --gzip --archive=/backup/manual-mongodb.gz

# PostgreSQL manual backup
docker-compose exec postgres pg_dump -U postgres klikkflow | gzip > manual-postgresql.sql.gz
```

### Restore from Backup

```bash
# MongoDB restore
docker-compose exec mongo mongorestore --uri="mongodb://mongo:27017" --gzip --archive=/backup/mongodb_20251016_020000.gz

# PostgreSQL restore
gunzip < postgresql_20251016_020000.sql.gz | docker-compose exec -T postgres psql -U postgres -d klikkflow
```

### Disaster Recovery Plan

1. **Automated Daily Backups**: Stored in S3 with 30-day retention
2. **Point-in-Time Recovery**: Database WAL archiving (PostgreSQL), Oplog (MongoDB)
3. **Multi-Region Replication**: Cross-region backup copies
4. **Recovery Time Objective (RTO)**: <1 hour
5. **Recovery Point Objective (RPO)**: <15 minutes

---

## Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check logs
docker-compose logs backend

# Check health
docker-compose ps
curl http://localhost:3001/api/health

# Restart service
docker-compose restart backend

# Rebuild if needed
docker-compose build backend
docker-compose up -d backend
```

#### 2. Database Connection Errors

```bash
# Check database status
docker-compose ps mongo postgres

# Verify connection strings
docker-compose exec backend env | grep URI

# Test connection
docker-compose exec backend node -e "require('mongodb').MongoClient.connect('mongodb://mongo:27017', console.log)"
```

#### 3. High Memory Usage

```bash
# Check resource usage
docker stats

# Increase memory limits (docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 4G

# Scale down workers if needed
docker-compose up -d --scale worker=1
```

#### 4. Workflow Execution Failures

```bash
# Check worker logs
docker-compose logs -f worker

# Check queue depth
docker-compose exec redis redis-cli LLEN bull:workflow:wait

# Check BullMQ metrics
curl http://localhost:3001/metrics | grep bullmq
```

#### 5. Slow Performance

```bash
# Check database performance
docker-compose logs mongo | grep slow
docker-compose exec postgres psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check API latency
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/workflows

# Enable query profiling
docker-compose exec mongo mongosh --eval "db.setProfilingLevel(1, { slowms: 100 })"
```

### Health Checks

```bash
# Frontend health
curl http://localhost:3000/health

# Backend health
curl http://localhost:3001/api/health

# Database health
docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
docker-compose exec postgres pg_isready -U postgres

# Redis health
docker-compose exec redis redis-cli ping
```

### Performance Diagnostics

```bash
# Check container resources
docker stats --no-stream

# Check database connections
docker-compose exec mongo mongosh --eval "db.serverStatus().connections"
docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check queue metrics
docker-compose exec redis redis-cli INFO stats
```

---

## Upgrade Guide

### Docker Compose Upgrade

```bash
# Backup before upgrade
docker-compose exec backup /app/backup.sh

# Pull new images
docker-compose pull

# Stop services
docker-compose down

# Start with new images
docker-compose up -d

# Run database migrations (if needed)
docker-compose exec backend npm run migrate

# Verify upgrade
docker-compose ps
curl http://localhost:3001/api/health
```

### Kubernetes Upgrade

```bash
# Backup before upgrade
kubectl create job backup-pre-upgrade-$(date +%Y%m%d) --from=cronjob/klikkflow-backup -n klikkflow

# Upgrade with Helm
helm upgrade klikkflow klikkflow/klikkflow \
  --namespace klikkflow \
  --values custom-values.yaml \
  --set klikkflow.backend.image.tag=1.1.0 \
  --set klikkflow.frontend.image.tag=1.1.0 \
  --set klikkflow.worker.image.tag=1.1.0

# Monitor rollout
kubectl rollout status deployment/klikkflow-backend -n klikkflow

# Rollback if needed
helm rollback klikkflow -n klikkflow
```

### Zero-Downtime Upgrade

```bash
# Use blue-green deployment
helm install klikkflow-blue ./infrastructure/kubernetes/helm/klikkflow \
  --namespace klikkflow \
  --set klikkflow.backend.image.tag=1.1.0

# Verify blue deployment
kubectl wait --for=condition=ready pod -l version=blue -n klikkflow

# Switch traffic
kubectl patch service klikkflow-backend -n klikkflow \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/selector/version", "value": "blue"}]'

# Remove old green deployment
helm uninstall klikkflow-green -n klikkflow
```

---

## Support and Resources

**Documentation**:
- Main docs: https://docs.klikkflow.com
- API docs: https://docs.klikkflow.com/api
- Guides: https://docs.klikkflow.com/guides

**Community**:
- GitHub: https://github.com/KlikkAI/klikkflow
- Discord: https://discord.gg/klikkflow
- Stack Overflow: Tag `klikkflow`

**Commercial Support**:
- Enterprise Support: enterprise@klikkflow.com
- Managed Hosting: https://klikkflow.com/managed

---

**Document Version**: 1.0.0
**Last Updated**: October 2025
**Maintained By**: KlikkFlow Team
**License**: MIT
