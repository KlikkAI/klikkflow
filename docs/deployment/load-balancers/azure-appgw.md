# Azure Application Gateway Configuration

## Overview

This guide covers complete setup of Azure Application Gateway for Reporunner deployment on AKS (Azure Kubernetes Service) or Virtual Machines. Application Gateway provides layer 7 load balancing, SSL termination, WAF protection, and autoscaling capabilities.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: Azure CLI Setup](#method-1-azure-cli-setup)
4. [Method 2: Terraform Configuration](#method-2-terraform-configuration)
5. [SSL/TLS with Key Vault](#ssltls-with-key-vault)
6. [Path-Based Routing](#path-based-routing)
7. [Backend Pools and Health Probes](#backend-pools-and-health-probes)
8. [Web Application Firewall (WAF)](#web-application-firewall-waf)
9. [Auto Scaling](#auto-scaling)
10. [Monitoring and Diagnostics](#monitoring-and-diagnostics)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
    ↓
Application Gateway (Public IP)
    ↓
HTTP Listener (Port 80/443)
    ├── Request Routing Rule: /api/*          → Backend Pool: Backend (AKS/VM)
    ├── Request Routing Rule: /socket.io/*    → Backend Pool: Backend
    ├── Request Routing Rule: /grafana/*      → Backend Pool: Grafana
    ├── Request Routing Rule: /prometheus/*   → Backend Pool: Prometheus
    └── Default Rule: /*                       → Backend Pool: Frontend
```

**Key Components**:
- **Application Gateway**: Layer 7 load balancer with SSL termination
- **Frontend IP**: Public IP address for incoming traffic
- **Listeners**: HTTP/HTTPS listeners for ports 80 and 443
- **Backend Pools**: Groups of VMs, VMSS, or AKS pods
- **HTTP Settings**: Backend protocol, port, and cookie-based affinity
- **Request Routing Rules**: Path-based or host-based routing
- **Health Probes**: Custom health checks for backend pools
- **WAF**: Web Application Firewall with OWASP rules

---

## Prerequisites

- Azure subscription with Resource Group
- Azure CLI installed (`az`)
- Virtual Network with subnet for Application Gateway (minimum /24)
- AKS cluster or Virtual Machines running Reporunner
- Azure Key Vault for SSL certificates
- Domain with DNS access (Azure DNS recommended)

---

## Method 1: Azure CLI Setup

### Step 1: Create Resource Group and Network

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="reporunner-rg"
LOCATION="eastus"
VNET_NAME="reporunner-vnet"
APPGW_SUBNET="appgw-subnet"
AKS_SUBNET="aks-subnet"

# Create resource group
az group create \
    --name $RESOURCE_GROUP \
    --location $LOCATION

# Create virtual network
az network vnet create \
    --resource-group $RESOURCE_GROUP \
    --name $VNET_NAME \
    --address-prefix 10.0.0.0/16 \
    --subnet-name $APPGW_SUBNET \
    --subnet-prefix 10.0.1.0/24

# Create subnet for AKS (if needed)
az network vnet subnet create \
    --resource-group $RESOURCE_GROUP \
    --vnet-name $VNET_NAME \
    --name $AKS_SUBNET \
    --address-prefix 10.0.2.0/24
```

### Step 2: Create Public IP

```bash
# Create static public IP
az network public-ip create \
    --resource-group $RESOURCE_GROUP \
    --name reporunner-appgw-ip \
    --sku Standard \
    --allocation-method Static \
    --location $LOCATION

# Get the IP address
APPGW_IP=$(az network public-ip show \
    --resource-group $RESOURCE_GROUP \
    --name reporunner-appgw-ip \
    --query ipAddress \
    --output tsv)

echo "Application Gateway IP: $APPGW_IP"
```

### Step 3: Create Application Gateway

```bash
# Create Application Gateway
az network application-gateway create \
    --name reporunner-appgw \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --vnet-name $VNET_NAME \
    --subnet $APPGW_SUBNET \
    --capacity 2 \
    --sku Standard_v2 \
    --http-settings-cookie-based-affinity Disabled \
    --frontend-port 80 \
    --http-settings-port 3000 \
    --http-settings-protocol Http \
    --public-ip-address reporunner-appgw-ip \
    --priority 100
```

This creates basic Application Gateway with:
- Frontend port: 80
- Default backend pool (empty)
- Default HTTP settings
- Default routing rule

### Step 4: Create Backend Pools

```bash
# Create backend pool for frontend
az network application-gateway address-pool create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name frontend-pool

# Create backend pool for backend API
az network application-gateway address-pool create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-pool

# Create backend pool for Grafana
az network application-gateway address-pool create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name grafana-pool

# Add servers to backend pool (for VMs)
az network application-gateway address-pool update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-pool \
    --servers 10.0.2.10 10.0.2.11

# For AKS, use service internal IPs or integrate with ingress controller
```

### Step 5: Create HTTP Settings

```bash
# HTTP settings for frontend (port 3000)
az network application-gateway http-settings create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name frontend-http-settings \
    --port 3000 \
    --protocol Http \
    --cookie-based-affinity Disabled \
    --timeout 30

# HTTP settings for backend API (port 3001)
az network application-gateway http-settings create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-http-settings \
    --port 3001 \
    --protocol Http \
    --cookie-based-affinity Disabled \
    --timeout 300

# HTTP settings for Grafana (port 3000)
az network application-gateway http-settings create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name grafana-http-settings \
    --port 3000 \
    --protocol Http \
    --cookie-based-affinity Enabled \
    --timeout 30
```

### Step 6: Create Health Probes

```bash
# Health probe for frontend
az network application-gateway probe create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name frontend-probe \
    --protocol Http \
    --host-name-from-http-settings true \
    --path / \
    --interval 30 \
    --timeout 30 \
    --threshold 3

# Health probe for backend
az network application-gateway probe create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-probe \
    --protocol Http \
    --host-name-from-http-settings true \
    --path /api/health \
    --interval 30 \
    --timeout 30 \
    --threshold 3

# Update HTTP settings to use probes
az network application-gateway http-settings update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name frontend-http-settings \
    --probe frontend-probe

az network application-gateway http-settings update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-http-settings \
    --probe backend-probe
```

### Step 7: Create Path-Based Routing Rules

```bash
# Create URL path map
az network application-gateway url-path-map create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name reporunner-path-map \
    --paths /* \
    --address-pool frontend-pool \
    --http-settings frontend-http-settings \
    --default-address-pool frontend-pool \
    --default-http-settings frontend-http-settings

# Add path rules
az network application-gateway url-path-map rule create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --path-map-name reporunner-path-map \
    --name api-rule \
    --paths "/api/*" \
    --address-pool backend-pool \
    --http-settings backend-http-settings

az network application-gateway url-path-map rule create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --path-map-name reporunner-path-map \
    --name websocket-rule \
    --paths "/socket.io/*" \
    --address-pool backend-pool \
    --http-settings backend-http-settings

az network application-gateway url-path-map rule create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --path-map-name reporunner-path-map \
    --name grafana-rule \
    --paths "/grafana/*" \
    --address-pool grafana-pool \
    --http-settings grafana-http-settings
```

### Step 8: Create Routing Rule

```bash
# Create routing rule
az network application-gateway rule create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name path-based-rule \
    --http-listener appGatewayHttpListener \
    --rule-type PathBasedRouting \
    --url-path-map reporunner-path-map \
    --priority 100
```

### Step 9: Add HTTPS Support

```bash
# Get certificate from Key Vault (see SSL section)
CERT_SECRET_ID="https://reporunner-kv.vault.azure.net/secrets/reporunner-cert/abc123"

# Create frontend port for HTTPS
az network application-gateway frontend-port create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name https-port \
    --port 443

# Add SSL certificate
az network application-gateway ssl-cert create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name reporunner-cert \
    --key-vault-secret-id $CERT_SECRET_ID

# Create HTTPS listener
az network application-gateway http-listener create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name https-listener \
    --frontend-port https-port \
    --ssl-cert reporunner-cert

# Update rule to use HTTPS listener
az network application-gateway rule update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name path-based-rule \
    --http-listener https-listener
```

---

## Method 2: Terraform Configuration

Create `infrastructure/terraform/azure/modules/application-gateway/main.tf`:

```hcl
# Public IP for Application Gateway
resource "azurerm_public_ip" "appgw" {
  name                = "reporunner-appgw-ip"
  resource_group_name = var.resource_group_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = {
    Environment = var.environment
  }
}

# Application Gateway
resource "azurerm_application_gateway" "reporunner" {
  name                = "reporunner-appgw"
  resource_group_name = var.resource_group_name
  location            = var.location

  sku {
    name     = "Standard_v2"
    tier     = "Standard_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "appgw-ip-config"
    subnet_id = var.appgw_subnet_id
  }

  frontend_port {
    name = "http-port"
    port = 80
  }

  frontend_port {
    name = "https-port"
    port = 443
  }

  frontend_ip_configuration {
    name                 = "appgw-frontend-ip"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  # Backend Pools
  backend_address_pool {
    name = "frontend-pool"
  }

  backend_address_pool {
    name = "backend-pool"
  }

  backend_address_pool {
    name = "grafana-pool"
  }

  # Backend HTTP Settings
  backend_http_settings {
    name                  = "frontend-http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 3000
    protocol              = "Http"
    request_timeout       = 30
    probe_name            = "frontend-probe"
  }

  backend_http_settings {
    name                  = "backend-http-settings"
    cookie_based_affinity = "Disabled"
    port                  = 3001
    protocol              = "Http"
    request_timeout       = 300
    probe_name            = "backend-probe"
  }

  backend_http_settings {
    name                  = "grafana-http-settings"
    cookie_based_affinity = "Enabled"
    port                  = 3000
    protocol              = "Http"
    request_timeout       = 30
    probe_name            = "grafana-probe"
  }

  # Health Probes
  probe {
    name                = "frontend-probe"
    protocol            = "Http"
    path                = "/"
    host                = "127.0.0.1"
    interval            = 30
    timeout             = 30
    unhealthy_threshold = 3

    match {
      status_code = ["200-399"]
    }
  }

  probe {
    name                = "backend-probe"
    protocol            = "Http"
    path                = "/api/health"
    host                = "127.0.0.1"
    interval            = 30
    timeout             = 30
    unhealthy_threshold = 3

    match {
      status_code = ["200"]
    }
  }

  probe {
    name                = "grafana-probe"
    protocol            = "Http"
    path                = "/api/health"
    host                = "127.0.0.1"
    interval            = 30
    timeout             = 30
    unhealthy_threshold = 3

    match {
      status_code = ["200"]
    }
  }

  # HTTP Listener
  http_listener {
    name                           = "http-listener"
    frontend_ip_configuration_name = "appgw-frontend-ip"
    frontend_port_name             = "http-port"
    protocol                       = "Http"
  }

  # HTTPS Listener
  http_listener {
    name                           = "https-listener"
    frontend_ip_configuration_name = "appgw-frontend-ip"
    frontend_port_name             = "https-port"
    protocol                       = "Https"
    ssl_certificate_name           = "reporunner-cert"
  }

  # SSL Certificate from Key Vault
  ssl_certificate {
    name                = "reporunner-cert"
    key_vault_secret_id = var.ssl_certificate_secret_id
  }

  # URL Path Map
  url_path_map {
    name                               = "reporunner-path-map"
    default_backend_address_pool_name  = "frontend-pool"
    default_backend_http_settings_name = "frontend-http-settings"

    path_rule {
      name                       = "api-rule"
      paths                      = ["/api/*"]
      backend_address_pool_name  = "backend-pool"
      backend_http_settings_name = "backend-http-settings"
    }

    path_rule {
      name                       = "websocket-rule"
      paths                      = ["/socket.io/*"]
      backend_address_pool_name  = "backend-pool"
      backend_http_settings_name = "backend-http-settings"
    }

    path_rule {
      name                       = "grafana-rule"
      paths                      = ["/grafana/*"]
      backend_address_pool_name  = "grafana-pool"
      backend_http_settings_name = "grafana-http-settings"
    }
  }

  # Routing Rules
  request_routing_rule {
    name                       = "http-redirect-rule"
    rule_type                  = "Basic"
    http_listener_name         = "http-listener"
    redirect_configuration_name = "http-to-https"
    priority                   = 100
  }

  request_routing_rule {
    name               = "https-path-rule"
    rule_type          = "PathBasedRouting"
    http_listener_name = "https-listener"
    url_path_map_name  = "reporunner-path-map"
    priority           = 200
  }

  # HTTP to HTTPS Redirect
  redirect_configuration {
    name                 = "http-to-https"
    redirect_type        = "Permanent"
    target_listener_name = "https-listener"
    include_path         = true
    include_query_string = true
  }

  # Enable WAF
  waf_configuration {
    enabled          = true
    firewall_mode    = "Prevention"
    rule_set_type    = "OWASP"
    rule_set_version = "3.2"

    disabled_rule_group {
      rule_group_name = "REQUEST-920-PROTOCOL-ENFORCEMENT"
      rules           = []
    }
  }

  # Autoscaling
  autoscale_configuration {
    min_capacity = 2
    max_capacity = 10
  }

  # Identity for Key Vault access
  identity {
    type         = "UserAssigned"
    identity_ids = [var.managed_identity_id]
  }

  tags = {
    Environment = var.environment
  }
}

# Outputs
output "public_ip" {
  description = "Public IP of Application Gateway"
  value       = azurerm_public_ip.appgw.ip_address
}

output "id" {
  description = "ID of Application Gateway"
  value       = azurerm_application_gateway.reporunner.id
}

output "backend_address_pool_ids" {
  description = "IDs of backend address pools"
  value = {
    frontend = azurerm_application_gateway.reporunner.backend_address_pool[0].id
    backend  = azurerm_application_gateway.reporunner.backend_address_pool[1].id
    grafana  = azurerm_application_gateway.reporunner.backend_address_pool[2].id
  }
}
```

**Apply Terraform**:

```bash
cd infrastructure/terraform/azure

terraform init
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
```

---

## SSL/TLS with Key Vault

### Step 1: Create Key Vault

```bash
# Create Key Vault
az keyvault create \
    --name reporunner-kv \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --enabled-for-deployment \
    --enabled-for-template-deployment
```

### Step 2: Upload Certificate

**Option 1: Import existing certificate**:

```bash
# Convert to PFX format (if needed)
openssl pkcs12 -export \
    -out certificate.pfx \
    -inkey private.key \
    -in certificate.crt \
    -password pass:SecurePassword123

# Import to Key Vault
az keyvault certificate import \
    --vault-name reporunner-kv \
    --name reporunner-cert \
    --file certificate.pfx \
    --password SecurePassword123
```

**Option 2: Generate self-signed certificate**:

```bash
# Create certificate policy
cat > policy.json <<EOF
{
  "issuerParameters": {
    "name": "Self"
  },
  "keyProperties": {
    "exportable": true,
    "keySize": 2048,
    "keyType": "RSA",
    "reuseKey": false
  },
  "secretProperties": {
    "contentType": "application/x-pkcs12"
  },
  "x509CertificateProperties": {
    "subject": "CN=app.example.com",
    "subjectAlternativeNames": {
      "dnsNames": [
        "app.example.com",
        "api.example.com"
      ]
    },
    "validityInMonths": 12
  }
}
EOF

# Create certificate
az keyvault certificate create \
    --vault-name reporunner-kv \
    --name reporunner-cert \
    --policy @policy.json
```

### Step 3: Grant Application Gateway Access

```bash
# Create managed identity
az identity create \
    --name reporunner-appgw-identity \
    --resource-group $RESOURCE_GROUP

# Get identity details
IDENTITY_ID=$(az identity show \
    --name reporunner-appgw-identity \
    --resource-group $RESOURCE_GROUP \
    --query principalId \
    --output tsv)

# Grant access to Key Vault
az keyvault set-policy \
    --name reporunner-kv \
    --object-id $IDENTITY_ID \
    --secret-permissions get list \
    --certificate-permissions get list

# Get certificate secret ID
CERT_SECRET_ID=$(az keyvault certificate show \
    --vault-name reporunner-kv \
    --name reporunner-cert \
    --query sid \
    --output tsv)

echo "Certificate Secret ID: $CERT_SECRET_ID"
```

---

## Path-Based Routing

### Create Complex Routing Rules

```bash
# Multi-site configuration (host-based routing)
az network application-gateway http-listener create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name api-listener \
    --frontend-port https-port \
    --ssl-cert reporunner-cert \
    --host-name api.example.com

az network application-gateway rule create \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name api-host-rule \
    --http-listener api-listener \
    --rule-type Basic \
    --address-pool backend-pool \
    --http-settings backend-http-settings \
    --priority 150
```

---

## Backend Pools and Health Probes

### Add Backends to Pool

**For VMs**:

```bash
# Add VMs by IP or FQDN
az network application-gateway address-pool update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-pool \
    --servers 10.0.2.10 10.0.2.11 10.0.2.12
```

**For VMSS**:

```bash
# Link VMSS
az network application-gateway address-pool update \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --name backend-pool \
    --servers $(az vmss list-instance-public-ips \
        --resource-group $RESOURCE_GROUP \
        --name reporunner-vmss \
        --query "[].ipAddress" \
        --output tsv)
```

---

## Web Application Firewall (WAF)

### Enable WAF

```bash
# Update to WAF_v2 SKU
az network application-gateway update \
    --resource-group $RESOURCE_GROUP \
    --name reporunner-appgw \
    --set sku.name=WAF_v2 sku.tier=WAF_v2

# Configure WAF
az network application-gateway waf-config set \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --enabled true \
    --firewall-mode Prevention \
    --rule-set-type OWASP \
    --rule-set-version 3.2
```

### Custom WAF Rules

```bash
# Disable specific rules
az network application-gateway waf-config set \
    --resource-group $RESOURCE_GROUP \
    --gateway-name reporunner-appgw \
    --enabled true \
    --firewall-mode Prevention \
    --rule-set-type OWASP \
    --rule-set-version 3.2 \
    --disabled-rule-groups '[{"ruleGroupName":"REQUEST-920-PROTOCOL-ENFORCEMENT","rules":[920300,920330]}]'
```

---

## Auto Scaling

```bash
# Enable autoscaling
az network application-gateway update \
    --resource-group $RESOURCE_GROUP \
    --name reporunner-appgw \
    --min-capacity 2 \
    --max-capacity 10
```

---

## Monitoring and Diagnostics

### Enable Diagnostics

```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
    --resource-group $RESOURCE_GROUP \
    --workspace-name reporunner-logs

WORKSPACE_ID=$(az monitor log-analytics workspace show \
    --resource-group $RESOURCE_GROUP \
    --workspace-name reporunner-logs \
    --query id \
    --output tsv)

# Enable diagnostic settings
az monitor diagnostic-settings create \
    --resource $(az network application-gateway show \
        --resource-group $RESOURCE_GROUP \
        --name reporunner-appgw \
        --query id \
        --output tsv) \
    --name appgw-diagnostics \
    --workspace $WORKSPACE_ID \
    --logs '[{"category":"ApplicationGatewayAccessLog","enabled":true},{"category":"ApplicationGatewayPerformanceLog","enabled":true},{"category":"ApplicationGatewayFirewallLog","enabled":true}]' \
    --metrics '[{"category":"AllMetrics","enabled":true}]'
```

### View Metrics

Key metrics in Azure Monitor:
- **Throughput**: Total bytes processed
- **Unhealthy Host Count**: Number of unhealthy backend hosts
- **Response Status**: HTTP 2xx, 4xx, 5xx counts
- **Total Requests**: Request count
- **Failed Requests**: Failed request count

---

## Troubleshooting

### Issue: Backend Health Shows Unhealthy

**Check backend health**:
```bash
az network application-gateway show-backend-health \
    --resource-group $RESOURCE_GROUP \
    --name reporunner-appgw
```

**Solutions**:
1. Verify NSG allows traffic from Application Gateway subnet
2. Check health probe path returns 200
3. Verify backend is listening on correct port

### Issue: 502 Bad Gateway

**Check logs**:
```bash
az monitor diagnostic-settings show \
    --resource $(az network application-gateway show \
        --resource-group $RESOURCE_GROUP \
        --name reporunner-appgw \
        --query id \
        --output tsv) \
    --name appgw-diagnostics
```

---

## Cost Optimization

**Estimated Monthly Costs**:
- Standard_v2: ~$220/month (2 units × $0.152/hour × 730 hours)
- Data processing: $0.008/GB
- WAF_v2 (if enabled): Additional $14.60/month per unit
- **Total**: ~$250-300/month

**Tips**:
1. Use autoscaling to reduce costs during low traffic
2. Place in same region as backends
3. Use private endpoints where possible

---

## Next Steps

- [AWS Load Balancer Guide](./aws-alb.md)
- [GCP Load Balancer Guide](./gcp-lb.md)
- [Domain Management](../domain-management.md)
- [Nginx Reverse Proxy](../nginx-reverse-proxy.md)

---

**Last Updated**: October 27, 2025
**Maintained By**: Reporunner Development Team
