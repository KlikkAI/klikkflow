# Domain and DNS Management Guide

## Overview

This guide covers complete domain and DNS configuration for deploying Reporunner across all major cloud providers. Whether you're using AWS Route 53, GCP Cloud DNS, Azure DNS, or Cloudflare, this guide provides step-by-step instructions for setting up domains, subdomains, SSL/TLS certificates, and routing.

**Goal**: Map your domain (e.g., `example.com`) to your Reporunner deployment with proper SSL/TLS security.

---

## Table of Contents

1. [Domain Strategy](#domain-strategy)
2. [AWS Route 53 Setup](#aws-route-53-setup)
3. [GCP Cloud DNS Setup](#gcp-cloud-dns-setup)
4. [Azure DNS Setup](#azure-dns-setup)
5. [Cloudflare Setup](#cloudflare-setup)
6. [SSL/TLS Certificates](#ssltls-certificates)
7. [Testing and Verification](#testing-and-verification)
8. [Troubleshooting](#troubleshooting)

---

## Domain Strategy

### Option 1: Path-Based Routing (Single Domain)

**Best for**: Simple deployments, cost-effective

```
https://app.example.com/              → Frontend
https://app.example.com/api/          → Backend API
https://app.example.com/grafana/      → Grafana
https://app.example.com/prometheus/   → Prometheus
https://app.example.com/kibana/       → Kibana
```

**Pros**:
- ✅ Single SSL certificate
- ✅ One DNS record
- ✅ Simple CORS configuration
- ✅ Lower cost

**Cons**:
- ❌ URL paths look less professional
- ❌ All services share same origin

### Option 2: Subdomain-Based Routing (Multiple Domains)

**Best for**: Enterprise deployments, better isolation

```
https://app.example.com        → Frontend
https://api.example.com        → Backend API
https://grafana.example.com    → Grafana
https://prometheus.example.com → Prometheus
https://kibana.example.com     → Kibana
```

**Pros**:
- ✅ Professional appearance
- ✅ Better service isolation
- ✅ Easier to set different policies per subdomain
- ✅ Cleaner architecture

**Cons**:
- ❌ Multiple SSL certificates (or wildcard)
- ❌ More DNS records to manage
- ❌ CORS configuration more complex

### Option 3: Wildcard Subdomain (Recommended for Multi-Tenant)

**Best for**: SaaS platforms with customer subdomains

```
https://app.example.com             → Main application
https://customer1.example.com       → Customer 1's instance
https://customer2.example.com       → Customer 2's instance
https://*.example.com               → Dynamic subdomains
```

---

## AWS Route 53 Setup

### Prerequisites

- AWS account with Route 53 access
- Domain registered (can use Route 53 or external registrar)
- AWS CLI installed

### Step 1: Create Hosted Zone

```bash
# Create hosted zone
aws route53 create-hosted-zone \
    --name example.com \
    --caller-reference $(date +%s) \
    --hosted-zone-config Comment="Reporunner production domain"

# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='example.com.'].Id" \
    --output text)

echo "Hosted Zone ID: $ZONE_ID"
```

Or using **AWS Console**:

1. Go to [Route 53 Console](https://console.aws.amazon.com/route53/)
2. Click **Hosted zones** → **Create hosted zone**
3. Enter domain name: `example.com`
4. Type: **Public hosted zone**
5. Click **Create hosted zone**
6. Note the **Name servers** (NS records)

### Step 2: Update Domain Registrar

If your domain is registered outside AWS:

1. Copy the 4 NS records from Route 53
2. Update your domain registrar's nameservers:
   ```
   ns-1234.awsdns-12.org
   ns-5678.awsdns-34.com
   ns-9012.awsdns-56.net
   ns-3456.awsdns-78.co.uk
   ```

### Step 3: Create DNS Records

**For Load Balancer (ALB)**:

```bash
# Get your ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names reporunner-alb \
    --query "LoadBalancers[0].DNSName" \
    --output text)

# Create A record (alias to ALB)
cat > change-batch.json <<EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "app.example.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z35SXDOTRQ7X7K",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": true
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
    --hosted-zone-id $ZONE_ID \
    --change-batch file://change-batch.json
```

**For Multiple Subdomains**:

```bash
# Create multiple subdomain records
for SUBDOMAIN in app api grafana prometheus kibana; do
  aws route53 change-resource-record-sets \
    --hosted-zone-id $ZONE_ID \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"${SUBDOMAIN}.example.com\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"Z35SXDOTRQ7X7K\",
            \"DNSName\": \"$ALB_DNS\",
            \"EvaluateTargetHealth\": true
          }
        }
      }]
    }"
done
```

**For Wildcard Subdomain**:

```bash
# Wildcard A record
aws route53 change-resource-record-sets \
    --hosted-zone-id $ZONE_ID \
    --change-batch "{
      \"Changes\": [{
        \"Action\": \"CREATE\",
        \"ResourceRecordSet\": {
          \"Name\": \"*.example.com\",
          \"Type\": \"A\",
          \"AliasTarget\": {
            \"HostedZoneId\": \"Z35SXDOTRQ7X7K\",
            \"DNSName\": \"$ALB_DNS\",
            \"EvaluateTargetHealth\": true
          }
        }
      }]
    }"
```

### Step 4: SSL Certificate with ACM

```bash
# Request certificate
aws acm request-certificate \
    --domain-name example.com \
    --subject-alternative-names "*.example.com" \
    --validation-method DNS

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
    --query "CertificateSummaryList[?DomainName=='example.com'].CertificateArn" \
    --output text)

# Get validation records
aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --query "Certificate.DomainValidationOptions"

# Add validation CNAME records to Route 53
# (AWS Console makes this easier with "Create record in Route 53" button)
```

### Step 5: Attach Certificate to ALB

```bash
# Add HTTPS listener to ALB
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/reporunner-alb/abc123 \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/reporunner-frontend/xyz789
```

---

## GCP Cloud DNS Setup

### Prerequisites

- GCP project with Cloud DNS API enabled
- `gcloud` CLI installed
- Domain ownership verified

### Step 1: Create DNS Zone

```bash
# Enable Cloud DNS API
gcloud services enable dns.googleapis.com

# Create managed zone
gcloud dns managed-zones create reporunner-zone \
    --description="Reporunner production DNS" \
    --dns-name=example.com \
    --visibility=public

# Get nameservers
gcloud dns managed-zones describe reporunner-zone \
    --format="value(nameServers)"
```

### Step 2: Update Domain Registrar

Copy the nameservers from the previous command and update your domain registrar:

```
ns-cloud-a1.googledomains.com
ns-cloud-a2.googledomains.com
ns-cloud-a3.googledomains.com
ns-cloud-a4.googledomains.com
```

### Step 3: Create DNS Records

**For Load Balancer**:

```bash
# Get load balancer IP
LB_IP=$(gcloud compute addresses describe reporunner-lb-ip \
    --global \
    --format="value(address)")

# Create A record
gcloud dns record-sets create app.example.com \
    --rrdatas=$LB_IP \
    --type=A \
    --ttl=300 \
    --zone=reporunner-zone
```

**For Multiple Subdomains**:

```bash
# Create subdomain A records
for SUBDOMAIN in app api grafana prometheus kibana; do
  gcloud dns record-sets create ${SUBDOMAIN}.example.com \
      --rrdatas=$LB_IP \
      --type=A \
      --ttl=300 \
      --zone=reporunner-zone
done
```

**For Wildcard**:

```bash
# Wildcard A record
gcloud dns record-sets create "*.example.com" \
    --rrdatas=$LB_IP \
    --type=A \
    --ttl=300 \
    --zone=reporunner-zone
```

### Step 4: SSL Certificate with Google-Managed Certificates

```bash
# Create managed SSL certificate
gcloud compute ssl-certificates create reporunner-cert \
    --domains=app.example.com,api.example.com,grafana.example.com \
    --global

# Or wildcard certificate
gcloud compute ssl-certificates create reporunner-wildcard-cert \
    --domains=example.com,"*.example.com" \
    --global

# Check certificate status
gcloud compute ssl-certificates describe reporunner-cert \
    --global \
    --format="value(managed.status)"
```

### Step 5: Attach Certificate to Load Balancer

```bash
# Update HTTPS proxy with certificate
gcloud compute target-https-proxies update reporunner-https-proxy \
    --ssl-certificates=reporunner-cert \
    --global

# Create forwarding rule for HTTPS
gcloud compute forwarding-rules create reporunner-https-rule \
    --address=reporunner-lb-ip \
    --target-https-proxy=reporunner-https-proxy \
    --global \
    --ports=443
```

---

## Azure DNS Setup

### Prerequisites

- Azure subscription with DNS Zone permissions
- Azure CLI installed (`az`)
- Resource group created

### Step 1: Create DNS Zone

```bash
# Login to Azure
az login

# Create resource group (if not exists)
az group create \
    --name reporunner-rg \
    --location eastus

# Create DNS zone
az network dns zone create \
    --resource-group reporunner-rg \
    --name example.com

# Get nameservers
az network dns zone show \
    --resource-group reporunner-rg \
    --name example.com \
    --query "nameServers" \
    --output tsv
```

### Step 2: Update Domain Registrar

Update your domain's nameservers with Azure DNS servers:

```
ns1-01.azure-dns.com
ns2-01.azure-dns.net
ns3-01.azure-dns.org
ns4-01.azure-dns.info
```

### Step 3: Create DNS Records

**For Application Gateway**:

```bash
# Get Application Gateway public IP
AG_IP=$(az network public-ip show \
    --resource-group reporunner-rg \
    --name reporunner-ag-ip \
    --query "ipAddress" \
    --output tsv)

# Create A record
az network dns record-set a add-record \
    --resource-group reporunner-rg \
    --zone-name example.com \
    --record-set-name app \
    --ipv4-address $AG_IP
```

**For Multiple Subdomains**:

```bash
# Create subdomain A records
for SUBDOMAIN in app api grafana prometheus kibana; do
  az network dns record-set a add-record \
      --resource-group reporunner-rg \
      --zone-name example.com \
      --record-set-name $SUBDOMAIN \
      --ipv4-address $AG_IP
done
```

**For Wildcard**:

```bash
# Wildcard A record
az network dns record-set a add-record \
    --resource-group reporunner-rg \
    --zone-name example.com \
    --record-set-name "*" \
    --ipv4-address $AG_IP
```

### Step 4: SSL Certificate with Azure Key Vault

```bash
# Create Key Vault
az keyvault create \
    --name reporunner-kv \
    --resource-group reporunner-rg \
    --location eastus \
    --enabled-for-deployment \
    --enabled-for-template-deployment

# Import certificate (if you have one)
az keyvault certificate import \
    --vault-name reporunner-kv \
    --name reporunner-cert \
    --file certificate.pfx \
    --password "certificate-password"

# Or request Let's Encrypt certificate
# (Use cert-bot on a VM, then import to Key Vault)

# Get certificate secret ID
CERT_SECRET_ID=$(az keyvault certificate show \
    --vault-name reporunner-kv \
    --name reporunner-cert \
    --query "sid" \
    --output tsv)
```

### Step 5: Attach Certificate to Application Gateway

```bash
# Add SSL certificate to Application Gateway
az network application-gateway ssl-cert create \
    --resource-group reporunner-rg \
    --gateway-name reporunner-ag \
    --name reporunner-ssl-cert \
    --key-vault-secret-id $CERT_SECRET_ID

# Create HTTPS listener
az network application-gateway http-listener create \
    --resource-group reporunner-rg \
    --gateway-name reporunner-ag \
    --name https-listener \
    --frontend-port 443 \
    --ssl-cert reporunner-ssl-cert
```

---

## Cloudflare Setup

### Prerequisites

- Cloudflare account
- Domain added to Cloudflare
- API token with DNS edit permissions

### Step 1: Add Domain to Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Add a Site**
3. Enter your domain: `example.com`
4. Select plan (Free tier works fine)
5. Cloudflare will scan existing DNS records
6. Update your domain registrar's nameservers to Cloudflare's:

```
dana.ns.cloudflare.com
walt.ns.cloudflare.com
```

### Step 2: Create DNS Records via Dashboard

1. Go to **DNS** → **Records**
2. Add A records:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A | app | YOUR_SERVER_IP | Proxied ☁️ |
| A | api | YOUR_SERVER_IP | Proxied ☁️ |
| A | grafana | YOUR_SERVER_IP | DNS only |
| A | prometheus | YOUR_SERVER_IP | DNS only |
| A | kibana | YOUR_SERVER_IP | DNS only |

**Note**:
- ☁️ **Proxied** = Traffic goes through Cloudflare (free SSL, DDoS protection, caching)
- **DNS only** = Direct connection (use for monitoring tools)

### Step 3: Create DNS Records via API

```bash
# Set API token
CLOUDFLARE_API_TOKEN="your-api-token-here"
ZONE_ID="your-zone-id"

# Create A record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "app",
    "content": "203.0.113.1",
    "ttl": 1,
    "proxied": true
  }'

# Create wildcard record
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "*",
    "content": "203.0.113.1",
    "ttl": 1,
    "proxied": true
  }'
```

### Step 4: SSL/TLS Configuration

**Automatic SSL (Recommended)**:

1. Go to **SSL/TLS** → **Overview**
2. Select encryption mode:
   - **Flexible**: Cloudflare ↔ Browser (HTTPS), Cloudflare ↔ Server (HTTP)
   - **Full**: HTTPS everywhere but server can use self-signed cert
   - **Full (strict)**: HTTPS everywhere with valid cert required ✅ **Recommended**

3. Enable **Always Use HTTPS**:
   - Go to **SSL/TLS** → **Edge Certificates**
   - Turn on **Always Use HTTPS**

4. Enable **Automatic HTTPS Rewrites**

### Step 5: Page Rules for Path-Based Routing

If using path-based routing, create page rules:

```
1. app.example.com/grafana/*
   → Forward URL: https://grafana.example.com/$1

2. app.example.com/prometheus/*
   → Forward URL: https://prometheus.example.com/$1
```

### Step 6: Cloudflare Workers (Advanced)

For dynamic routing:

```javascript
// worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  // Route based on path
  if (url.pathname.startsWith('/api/')) {
    return fetch('http://backend:3001' + url.pathname)
  } else if (url.pathname.startsWith('/grafana/')) {
    return fetch('http://grafana:3000' + url.pathname.replace('/grafana', ''))
  }

  // Default to frontend
  return fetch('http://frontend:3000' + url.pathname)
}
```

---

## SSL/TLS Certificates

### Option 1: Let's Encrypt (Free, Automated)

**Using Certbot**:

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Request certificate (with nginx)
sudo certbot --nginx -d app.example.com -d api.example.com

# Or standalone
sudo certbot certonly --standalone -d app.example.com

# Test auto-renewal
sudo certbot renew --dry-run
```

**Using Docker Certbot**:

```yaml
# docker-compose.yml
services:
  certbot:
    image: certbot/certbot
    volumes:
      - ./ssl/certbot/conf:/etc/letsencrypt
      - ./ssl/certbot/www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@example.com --agree-tos --no-eff-email -d app.example.com
```

### Option 2: Cloud Provider Managed Certificates

**AWS Certificate Manager (ACM)**:
- Free for AWS services (ALB, CloudFront)
- Automatic renewal
- DNS or email validation

**GCP Managed Certificates**:
- Free for GCP load balancers
- Automatic provisioning and renewal
- HTTP validation only

**Azure Key Vault Certificates**:
- Paid service
- Supports Let's Encrypt integration
- Central certificate management

### Option 3: Commercial Certificates

**Purchase from**:
- DigiCert
- GlobalSign
- Sectigo
- GoDaddy

**Installation**:
1. Generate CSR:
```bash
openssl req -new -newkey rsa:2048 -nodes \
  -keyout example.com.key \
  -out example.com.csr
```

2. Submit CSR to certificate authority
3. Download certificate bundle
4. Install on nginx:
```nginx
ssl_certificate /etc/nginx/ssl/example.com.crt;
ssl_certificate_key /etc/nginx/ssl/example.com.key;
ssl_trusted_certificate /etc/nginx/ssl/ca-bundle.crt;
```

### Option 4: Wildcard Certificates

**Let's Encrypt Wildcard**:
```bash
sudo certbot certonly --manual \
  --preferred-challenges=dns \
  --email admin@example.com \
  --agree-tos \
  -d example.com \
  -d "*.example.com"
```

**ACM Wildcard**:
```bash
aws acm request-certificate \
    --domain-name example.com \
    --subject-alternative-names "*.example.com" \
    --validation-method DNS
```

---

## Testing and Verification

### DNS Propagation

```bash
# Check A record
dig app.example.com +short

# Check all nameservers
dig app.example.com +trace

# Check from specific DNS server
dig @8.8.8.8 app.example.com

# Online tools
# https://www.whatsmydns.net/
# https://dnschecker.org/
```

### SSL/TLS Certificate

```bash
# Check certificate details
openssl s_client -connect app.example.com:443 -servername app.example.com

# Check certificate expiry
echo | openssl s_client -connect app.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Check SSL rating
# https://www.ssllabs.com/ssltest/
```

### HTTP/HTTPS Connectivity

```bash
# Test HTTP
curl -I http://app.example.com

# Test HTTPS
curl -I https://app.example.com

# Test specific endpoints
curl https://app.example.com/api/health
curl https://app.example.com/health

# Test WebSocket
wscat -c wss://app.example.com/socket.io/?transport=websocket
```

### Load Balancer Health

```bash
# AWS ALB
aws elbv2 describe-target-health \
    --target-group-arn arn:aws:elasticloadbalancing:...

# GCP Load Balancer
gcloud compute backend-services get-health reporunner-backend \
    --global

# Azure Application Gateway
az network application-gateway show-backend-health \
    --resource-group reporunner-rg \
    --name reporunner-ag
```

---

## Troubleshooting

### Issue: DNS Not Resolving

**Symptoms**: `curl: (6) Could not resolve host`

**Diagnosis**:
```bash
# Check if DNS records exist
dig app.example.com

# Check nameserver propagation
dig NS example.com
```

**Solutions**:
1. Wait for DNS propagation (up to 48 hours)
2. Verify nameservers at registrar
3. Check DNS zone configuration
4. Flush local DNS cache: `sudo systemd-resolve --flush-caches`

### Issue: SSL Certificate Not Trusted

**Symptoms**: `SSL certificate problem: unable to get local issuer certificate`

**Diagnosis**:
```bash
# Check certificate chain
openssl s_client -connect app.example.com:443 -showcerts
```

**Solutions**:
1. Include intermediate certificates
2. Verify certificate matches domain
3. Check certificate expiration
4. Use full certificate chain in nginx

### Issue: 502 Bad Gateway with Valid DNS

**Diagnosis**:
```bash
# Check if backend is reachable
curl http://localhost:3001/health

# Check nginx error logs
tail -f /var/log/nginx/error.log

# Check load balancer target health
# (cloud provider specific)
```

**Solutions**:
1. Verify backend containers are running
2. Check security groups/firewalls
3. Verify load balancer target group configuration
4. Check nginx upstream configuration

### Issue: Cloudflare 522 Error

**Symptoms**: "Connection timed out"

**Cause**: Cloudflare can't reach origin server

**Solutions**:
1. Verify origin server is running
2. Check firewall allows Cloudflare IPs
3. Set Cloudflare to "DNS only" temporarily
4. Check origin server SSL configuration

### Issue: Mixed Content Warnings

**Symptoms**: Browser blocks HTTP resources on HTTPS page

**Solutions**:
1. Update all resource URLs to HTTPS
2. Use protocol-relative URLs (`//example.com/asset.js`)
3. Enable "Automatic HTTPS Rewrites" in Cloudflare
4. Add CSP header: `Content-Security-Policy: upgrade-insecure-requests`

---

## Next Steps

- [Nginx Reverse Proxy Guide](./nginx-reverse-proxy.md) - Configure routing
- [AWS Load Balancer Guide](./load-balancers/aws-alb.md) - ALB setup
- [GCP Load Balancer Guide](./load-balancers/gcp-lb.md) - Cloud Load Balancing
- [Azure Load Balancer Guide](./load-balancers/azure-appgw.md) - Application Gateway
- [Kubernetes Ingress](../kubernetes/ingress.md) - K8s ingress controllers

---

**Last Updated**: October 27, 2025
**Maintained By**: Reporunner Development Team
