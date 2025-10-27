# GCP Cloud Load Balancing Configuration

## Overview

This guide covers complete setup of Google Cloud Platform (GCP) HTTP(S) Load Balancer for Reporunner deployment on GKE or Compute Engine. GCP's load balancing provides global distribution, auto-scaling, and integrated CDN capabilities.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: gcloud CLI Setup](#method-1-gcloud-cli-setup)
4. [Method 2: Terraform Configuration](#method-2-terraform-configuration)
5. [SSL/TLS with Google-Managed Certificates](#ssltls-with-google-managed-certificates)
6. [URL Map Configuration](#url-map-configuration)
7. [Backend Services and Health Checks](#backend-services-and-health-checks)
8. [Cloud CDN Integration](#cloud-cdn-integration)
9. [Cloud Armor (WAF)](#cloud-armor-waf)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
    ↓
Global HTTP(S) Load Balancer (anycast IP)
    ↓
URL Map (routing rules)
    ├── /api/*          → Backend Service: Backend (GKE/GCE)
    ├── /socket.io/*    → Backend Service: Backend (WebSocket)
    ├── /grafana/*      → Backend Service: Grafana
    ├── /prometheus/*   → Backend Service: Prometheus
    └── /*              → Backend Service: Frontend
        ↓
    Instance Groups (GKE Node Pools or Managed Instance Groups)
```

**Key Components**:
- **Global Forwarding Rule**: Entry point with anycast IP
- **Target HTTPS Proxy**: SSL termination and HTTP/2
- **URL Map**: Path-based routing (like nginx config)
- **Backend Services**: Groups of instances with health checks
- **Instance Groups**: GKE pods or Compute Engine VMs
- **Managed SSL Certificate**: Free, auto-renewing certificates

---

## Prerequisites

- GCP project with billing enabled
- `gcloud` CLI installed and authenticated
- GKE cluster or Compute Engine instances running Reporunner
- Domain with DNS access (Cloud DNS recommended)
- APIs enabled: `compute`, `container`, `dns`

---

## Method 1: gcloud CLI Setup

### Step 1: Enable Required APIs

```bash
# Set project
PROJECT_ID="your-project-id"
REGION="us-central1"

gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable compute.googleapis.com
gcloud services enable container.googleapis.com
gcloud services enable dns.googleapis.com
```

### Step 2: Reserve Static IP

```bash
# Reserve global static IP
gcloud compute addresses create reporunner-lb-ip \
    --ip-version=IPV4 \
    --global

# Get the IP address
LB_IP=$(gcloud compute addresses describe reporunner-lb-ip \
    --global \
    --format="value(address)")

echo "Load Balancer IP: $LB_IP"
```

### Step 3: Create Health Checks

```bash
# Frontend health check
gcloud compute health-checks create http frontend-health-check \
    --port=3000 \
    --request-path=/ \
    --check-interval=30s \
    --timeout=5s \
    --healthy-threshold=2 \
    --unhealthy-threshold=3

# Backend health check
gcloud compute health-checks create http backend-health-check \
    --port=3001 \
    --request-path=/api/health \
    --check-interval=30s \
    --timeout=5s \
    --healthy-threshold=2 \
    --unhealthy-threshold=3

# Grafana health check
gcloud compute health-checks create http grafana-health-check \
    --port=3000 \
    --request-path=/api/health \
    --check-interval=30s \
    --timeout=5s
```

### Step 4: Create Backend Services

**For GKE**:

```bash
# Get GKE cluster details
CLUSTER_NAME="reporunner-cluster"
ZONE="us-central1-a"

# Create Network Endpoint Groups (NEGs) for each service
# This is typically done through GKE Service annotations (see GKE section)

# Create backend service for frontend
gcloud compute backend-services create frontend-backend \
    --protocol=HTTP \
    --port-name=http \
    --health-checks=frontend-health-check \
    --global

# Add NEG as backend (after NEG creation from GKE)
gcloud compute backend-services add-backend frontend-backend \
    --network-endpoint-group=frontend-neg \
    --network-endpoint-group-zone=$ZONE \
    --balancing-mode=RATE \
    --max-rate-per-endpoint=100 \
    --global
```

**For Compute Engine**:

```bash
# Create instance group (if not using managed instance groups)
gcloud compute instance-groups unmanaged create frontend-ig \
    --zone=$ZONE

# Add instances to group
gcloud compute instance-groups unmanaged add-instances frontend-ig \
    --zone=$ZONE \
    --instances=frontend-vm-1,frontend-vm-2

# Create backend service
gcloud compute backend-services create frontend-backend \
    --protocol=HTTP \
    --port-name=http \
    --health-checks=frontend-health-check \
    --global

# Add instance group as backend
gcloud compute backend-services add-backend frontend-backend \
    --instance-group=frontend-ig \
    --instance-group-zone=$ZONE \
    --balancing-mode=UTILIZATION \
    --max-utilization=0.8 \
    --global
```

Create backend services for other services (backend, grafana, etc.) following the same pattern.

### Step 5: Create URL Map

```bash
# Create URL map with default service
gcloud compute url-maps create reporunner-url-map \
    --default-service=frontend-backend

# Add path matchers
gcloud compute url-maps add-path-matcher reporunner-url-map \
    --path-matcher-name=reporunner-matcher \
    --default-service=frontend-backend \
    --path-rules="/api/*=backend-backend,/socket.io/*=backend-backend,/grafana/*=grafana-backend,/prometheus/*=prometheus-backend"
```

### Step 6: Create Managed SSL Certificate

```bash
# Create managed certificate
gcloud compute ssl-certificates create reporunner-cert \
    --domains=app.example.com,api.example.com

# For wildcard certificate
gcloud compute ssl-certificates create reporunner-wildcard-cert \
    --domains=example.com,"*.example.com"

# Check certificate status (takes 10-60 minutes)
gcloud compute ssl-certificates describe reporunner-cert \
    --format="value(managed.status)"
```

### Step 7: Create Target HTTPS Proxy

```bash
# Create target HTTPS proxy
gcloud compute target-https-proxies create reporunner-https-proxy \
    --ssl-certificates=reporunner-cert \
    --url-map=reporunner-url-map
```

### Step 8: Create Forwarding Rules

```bash
# HTTPS forwarding rule
gcloud compute forwarding-rules create reporunner-https-rule \
    --address=reporunner-lb-ip \
    --target-https-proxy=reporunner-https-proxy \
    --global \
    --ports=443

# HTTP forwarding rule (redirect to HTTPS)
gcloud compute target-http-proxies create reporunner-http-proxy \
    --url-map=reporunner-url-map

gcloud compute forwarding-rules create reporunner-http-rule \
    --address=reporunner-lb-ip \
    --target-http-proxy=reporunner-http-proxy \
    --global \
    --ports=80
```

### Step 9: Update DNS

```bash
# Create Cloud DNS zone
gcloud dns managed-zones create reporunner-zone \
    --dns-name=example.com \
    --description="Reporunner production DNS"

# Create A record
gcloud dns record-sets create app.example.com \
    --rrdatas=$LB_IP \
    --type=A \
    --ttl=300 \
    --zone=reporunner-zone
```

---

## Method 2: Terraform Configuration

Create `infrastructure/terraform/gcp/modules/load-balancer/main.tf`:

```hcl
# Reserve static IP
resource "google_compute_global_address" "lb_ip" {
  name = "reporunner-lb-ip"
}

# Health Checks
resource "google_compute_health_check" "frontend" {
  name                = "frontend-health-check"
  check_interval_sec  = 30
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 3000
    request_path = "/"
  }
}

resource "google_compute_health_check" "backend" {
  name                = "backend-health-check"
  check_interval_sec  = 30
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 3001
    request_path = "/api/health"
  }
}

# Backend Services
resource "google_compute_backend_service" "frontend" {
  name                  = "frontend-backend"
  port_name             = "http"
  protocol              = "HTTP"
  timeout_sec           = 30
  health_checks         = [google_compute_health_check.frontend.id]
  load_balancing_scheme = "EXTERNAL"

  backend {
    group           = google_compute_instance_group.frontend.self_link
    balancing_mode  = "UTILIZATION"
    max_utilization = 0.8
  }

  # Enable Cloud CDN
  enable_cdn = true
  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    client_ttl        = 7200
    max_ttl           = 86400
  }
}

resource "google_compute_backend_service" "backend" {
  name                  = "backend-backend"
  port_name             = "http"
  protocol              = "HTTP"
  timeout_sec           = 300  # Longer timeout for workflow execution
  health_checks         = [google_compute_health_check.backend.id]
  load_balancing_scheme = "EXTERNAL"

  backend {
    group          = google_compute_instance_group.backend.self_link
    balancing_mode = "UTILIZATION"
  }

  # Connection draining
  connection_draining_timeout_sec = 60
}

# URL Map
resource "google_compute_url_map" "reporunner" {
  name            = "reporunner-url-map"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = ["app.example.com"]
    path_matcher = "reporunner-paths"
  }

  path_matcher {
    name            = "reporunner-paths"
    default_service = google_compute_backend_service.frontend.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend.id
    }

    path_rule {
      paths   = ["/socket.io/*"]
      service = google_compute_backend_service.backend.id
    }

    path_rule {
      paths   = ["/grafana/*"]
      service = google_compute_backend_service.grafana.id
    }

    path_rule {
      paths   = ["/prometheus/*"]
      service = google_compute_backend_service.prometheus.id
    }
  }
}

# Managed SSL Certificate
resource "google_compute_managed_ssl_certificate" "reporunner" {
  name = "reporunner-cert"

  managed {
    domains = [
      "app.example.com",
      "api.example.com",
      "grafana.example.com"
    ]
  }
}

# HTTPS Target Proxy
resource "google_compute_target_https_proxy" "reporunner" {
  name             = "reporunner-https-proxy"
  url_map          = google_compute_url_map.reporunner.id
  ssl_certificates = [google_compute_managed_ssl_certificate.reporunner.id]
}

# HTTP Target Proxy (for redirect)
resource "google_compute_target_http_proxy" "reporunner" {
  name    = "reporunner-http-proxy"
  url_map = google_compute_url_map.redirect.id
}

# URL Map for HTTP → HTTPS redirect
resource "google_compute_url_map" "redirect" {
  name = "reporunner-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

# Global Forwarding Rules
resource "google_compute_global_forwarding_rule" "https" {
  name       = "reporunner-https-rule"
  target     = google_compute_target_https_proxy.reporunner.id
  port_range = "443"
  ip_address = google_compute_global_address.lb_ip.address
}

resource "google_compute_global_forwarding_rule" "http" {
  name       = "reporunner-http-rule"
  target     = google_compute_target_http_proxy.reporunner.id
  port_range = "80"
  ip_address = google_compute_global_address.lb_ip.address
}

# Outputs
output "load_balancer_ip" {
  description = "IP address of the load balancer"
  value       = google_compute_global_address.lb_ip.address
}

output "ssl_certificate_status" {
  description = "Status of the SSL certificate"
  value       = google_compute_managed_ssl_certificate.reporunner.managed[0].status
}
```

**Apply Terraform**:

```bash
cd infrastructure/terraform/gcp

terraform init
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
```

---

## SSL/TLS with Google-Managed Certificates

### Advantages of Google-Managed Certificates

✅ **Free** and automatically renewed
✅ **Zero-downtime** renewal
✅ **Global** - works across all regions
✅ **Multi-domain** support (up to 100 domains)

### Create Managed Certificate

```bash
# Single domain
gcloud compute ssl-certificates create reporunner-cert \
    --domains=app.example.com

# Multiple domains
gcloud compute ssl-certificates create reporunner-cert \
    --domains=app.example.com,api.example.com,grafana.example.com

# Wildcard + apex domain
gcloud compute ssl-certificates create reporunner-wildcard \
    --domains=example.com,"*.example.com"
```

### Verification Process

1. **Create certificate** (status: PROVISIONING)
2. **Point DNS** to load balancer IP
3. **Wait 10-60 minutes** (Google validates domain ownership)
4. **Status becomes ACTIVE**

```bash
# Check status
gcloud compute ssl-certificates describe reporunner-cert \
    --format="get(managed.status)"

# Watch status
watch -n 30 'gcloud compute ssl-certificates describe reporunner-cert --format="get(managed.status)"'
```

### Using Your Own Certificate

```bash
# Upload self-managed certificate
gcloud compute ssl-certificates create reporunner-custom-cert \
    --certificate=certificate.crt \
    --private-key=private.key
```

---

## URL Map Configuration

### Basic Path-Based Routing

```bash
# Define path rules
gcloud compute url-maps add-path-matcher reporunner-url-map \
    --path-matcher-name=main-matcher \
    --default-service=frontend-backend \
    --path-rules=" \
        /api/*=backend-backend, \
        /api/v1/*=backend-v1-backend, \
        /socket.io/*=backend-backend, \
        /grafana/*=grafana-backend, \
        /prometheus/*=prometheus-backend, \
        /static/*=static-bucket-backend"
```

### Host-Based Routing (Subdomains)

```bash
# Create URL map with host rules
gcloud compute url-maps create reporunner-subdomain-map \
    --default-service=frontend-backend

# Add host rule for api.example.com
gcloud compute url-maps add-host-rule reporunner-subdomain-map \
    --hosts=api.example.com \
    --path-matcher-name=api-matcher

gcloud compute url-maps add-path-matcher reporunner-subdomain-map \
    --path-matcher-name=api-matcher \
    --default-service=backend-backend

# Add host rule for grafana.example.com
gcloud compute url-maps add-host-rule reporunner-subdomain-map \
    --hosts=grafana.example.com \
    --path-matcher-name=grafana-matcher

gcloud compute url-maps add-path-matcher reporunner-subdomain-map \
    --path-matcher-name=grafana-matcher \
    --default-service=grafana-backend
```

### Advanced: Header-Based Routing

```bash
# Use URL map YAML for complex routing
cat > url-map-config.yaml <<EOF
name: reporunner-advanced-map
defaultService: https://www.googleapis.com/compute/v1/projects/PROJECT_ID/global/backendServices/frontend-backend

hostRules:
- hosts:
  - 'app.example.com'
  pathMatcher: advanced-matcher

pathMatchers:
- name: advanced-matcher
  defaultService: https://www.googleapis.com/compute/v1/projects/PROJECT_ID/global/backendServices/frontend-backend

  routeRules:
  # Admin API (requires header)
  - priority: 1
    matchRules:
    - prefixMatch: '/api/admin/'
      headerMatches:
      - headerName: 'X-Admin-Token'
        exactMatch: 'admin-secret-value'
    service: https://www.googleapis.com/compute/v1/projects/PROJECT_ID/global/backendServices/admin-backend

  # Regular API
  - priority: 10
    matchRules:
    - prefixMatch: '/api/'
    service: https://www.googleapis.com/compute/v1/projects/PROJECT_ID/global/backendServices/backend-backend
EOF

# Import URL map
gcloud compute url-maps import reporunner-advanced-map \
    --source=url-map-config.yaml \
    --global
```

---

## Backend Services and Health Checks

### Health Check Best Practices

```bash
# Create health check with custom settings
gcloud compute health-checks create http backend-health-check \
    --port=3001 \
    --request-path=/api/health \
    --check-interval=30s \
    --timeout=5s \
    --healthy-threshold=2 \
    --unhealthy-threshold=3 \
    --proxy-header=NONE
```

### Backend Service with Connection Draining

```bash
# Create backend service with draining
gcloud compute backend-services create backend-backend \
    --protocol=HTTP \
    --port-name=http \
    --health-checks=backend-health-check \
    --timeout=300 \
    --connection-draining-timeout=60 \
    --global

# Update existing backend service
gcloud compute backend-services update backend-backend \
    --connection-draining-timeout=60 \
    --global
```

### Session Affinity

```bash
# Enable session affinity (sticky sessions)
gcloud compute backend-services update backend-backend \
    --session-affinity=CLIENT_IP \
    --global

# Options:
# - NONE: No affinity
# - CLIENT_IP: Based on client IP
# - CLIENT_IP_PROTO: Based on client IP and protocol
# - CLIENT_IP_PORT_PROTO: Based on client IP, port, and protocol
# - GENERATED_COOKIE: HTTP cookie
# - HTTP_COOKIE: Application cookie
```

---

## Cloud CDN Integration

### Enable CDN

```bash
# Enable Cloud CDN on backend service
gcloud compute backend-services update frontend-backend \
    --enable-cdn \
    --cache-mode=CACHE_ALL_STATIC \
    --default-ttl=3600 \
    --client-ttl=7200 \
    --max-ttl=86400 \
    --global
```

### Cache Control

**Backend Headers**:
```
Cache-Control: public, max-age=3600
Cache-Control: private, no-cache
Cache-Control: no-store
```

**Invalidate Cache**:
```bash
# Invalidate all cached content
gcloud compute url-maps invalidate-cdn-cache reporunner-url-map \
    --path "/*" \
    --global

# Invalidate specific paths
gcloud compute url-maps invalidate-cdn-cache reporunner-url-map \
    --path "/static/*" \
    --path "/api/data/*" \
    --global
```

---

## Cloud Armor (WAF)

### Create Security Policy

```bash
# Create security policy
gcloud compute security-policies create reporunner-policy \
    --description="WAF policy for Reporunner"

# Block specific countries
gcloud compute security-policies rules create 1000 \
    --security-policy=reporunner-policy \
    --expression="origin.region_code == 'CN' || origin.region_code == 'RU'" \
    --action=deny-403

# Rate limiting
gcloud compute security-policies rules create 2000 \
    --security-policy=reporunner-policy \
    --expression="true" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60 \
    --ban-duration-sec=600

# SQL injection protection
gcloud compute security-policies rules create 3000 \
    --security-policy=reporunner-policy \
    --expression="evaluatePreconfiguredExpr('sqli-stable')" \
    --action=deny-403

# XSS protection
gcloud compute security-policies rules create 4000 \
    --security-policy=reporunner-policy \
    --expression="evaluatePreconfiguredExpr('xss-stable')" \
    --action=deny-403
```

### Attach to Backend Service

```bash
# Attach security policy
gcloud compute backend-services update backend-backend \
    --security-policy=reporunner-policy \
    --global
```

---

## Monitoring and Logging

### Enable Logging

```bash
# Enable access logs
gcloud compute backend-services update backend-backend \
    --enable-logging \
    --logging-sample-rate=1.0 \
    --global
```

### View Logs in Cloud Logging

```bash
# View load balancer logs
gcloud logging read "resource.type=http_load_balancer" \
    --limit=100 \
    --format=json

# Filter by status code
gcloud logging read 'resource.type=http_load_balancer AND httpRequest.status>=500' \
    --limit=50
```

### Key Metrics in Cloud Monitoring

**Request Metrics**:
- `loadbalancing.googleapis.com/https/request_count`
- `loadbalancing.googleapis.com/https/request_bytes_count`
- `loadbalancing.googleapis.com/https/response_bytes_count`

**Latency Metrics**:
- `loadbalancing.googleapis.com/https/total_latencies`
- `loadbalancing.googleapis.com/https/backend_latencies`

**Error Metrics**:
- `loadbalancing.googleapis.com/https/backend_request_count` (filtered by response_code_class:500)

### Create Alerts

```bash
# Alert on high error rate
gcloud alpha monitoring policies create \
    --notification-channels=CHANNEL_ID \
    --display-name="High 5xx Error Rate" \
    --condition-display-name="5xx errors > 10%" \
    --condition-threshold-value=0.1 \
    --condition-threshold-duration=300s \
    --condition-filter='resource.type="http_load_balancer" AND metric.type="loadbalancing.googleapis.com/https/request_count" AND metric.label.response_code_class="500"'
```

---

## GKE Integration

### Expose Services via Load Balancer

**Method 1: Using Ingress (Recommended)**:

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: reporunner-ingress
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "reporunner-lb-ip"
    networking.gke.io/managed-certificates: "reporunner-cert"
    kubernetes.io/ingress.allow-http: "true"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: backend-service
            port:
              number: 3001
      - path: /socket.io/*
        pathType: ImplementationSpecific
        backend:
          service:
            name: backend-service
            port:
              number: 3001
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: frontend-service
            port:
              number: 3000

---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: reporunner-cert
spec:
  domains:
    - app.example.com
    - api.example.com
```

**Apply**:
```bash
kubectl apply -f ingress.yaml
```

---

## Troubleshooting

### Issue: Certificate Not Provisioning

**Symptoms**: Certificate status stuck in "PROVISIONING"

**Diagnosis**:
```bash
gcloud compute ssl-certificates describe reporunner-cert \
    --format="yaml"
```

**Solutions**:
1. Verify DNS A record points to load balancer IP
2. Wait 10-60 minutes after DNS propagation
3. Check domain validation errors
4. Ensure forwarding rule is created and active

### Issue: 502 Bad Gateway

**Diagnosis**:
```bash
# Check backend health
gcloud compute backend-services get-health backend-backend \
    --global

# Check firewall rules
gcloud compute firewall-rules list \
    --filter="targetTags:reporunner"
```

**Solutions**:
1. Verify health check passes
2. Ensure firewall allows traffic from load balancer (130.211.0.0/22, 35.191.0.0/16)
3. Check backend service timeout settings

### Issue: Slow Performance

**Solutions**:
1. Enable Cloud CDN for static assets
2. Increase backend capacity
3. Use Premium Tier networking
4. Check backend latency in Cloud Monitoring

---

## Cost Optimization

**Estimated Monthly Costs**:
- Forwarding rules: $18/month (1 rule × $0.025/hour × 720 hours)
- LB usage: ~$20-50/month (varies by traffic)
- Premium Tier networking: $0.08-0.23/GB
- **Total**: ~$40-100/month

**Tips**:
1. Use Standard Tier for non-critical traffic
2. Enable Cloud CDN to reduce backend load
3. Use sustained use discounts
4. Delete unused backend services

---

## Next Steps

- [AWS Load Balancer Guide](./aws-alb.md)
- [Azure Application Gateway Guide](./azure-appgw.md)
- [Kubernetes Ingress](../../kubernetes/ingress.md)
- [Domain Management](../domain-management.md)

---

**Last Updated**: October 27, 2025
**Maintained By**: Reporunner Development Team
