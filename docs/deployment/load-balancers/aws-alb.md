# AWS Application Load Balancer Configuration

## Overview

This guide covers complete setup of AWS Application Load Balancer (ALB) for Reporunner deployment on AWS ECS Fargate or EC2. The ALB routes traffic to multiple services (frontend, backend, monitoring) and provides SSL termination.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Method 1: AWS Console Setup](#method-1-aws-console-setup)
4. [Method 2: AWS CLI Setup](#method-2-aws-cli-setup)
5. [Method 3: Terraform Configuration](#method-3-terraform-configuration)
6. [SSL/TLS with ACM](#ssltls-with-acm)
7. [Path-Based Routing Rules](#path-based-routing-rules)
8. [Health Checks](#health-checks)
9. [Auto Scaling Integration](#auto-scaling-integration)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet
    ↓
Application Load Balancer (Port 80/443)
    ├── Listener: HTTP:80 → Redirect to HTTPS
    └── Listener: HTTPS:443
        ├── Rule: /api/*          → Backend Target Group (ECS:3001)
        ├── Rule: /socket.io/*    → Backend Target Group (ECS:3001)
        ├── Rule: /grafana/*      → Grafana Target Group (ECS:3030)
        ├── Rule: /prometheus/*   → Prometheus Target Group (ECS:9090)
        └── Default Rule: /*      → Frontend Target Group (ECS:3000)
```

**Key Components**:
- **ALB**: Entry point, SSL termination, path-based routing
- **Target Groups**: Groups of ECS tasks or EC2 instances
- **Listener Rules**: Route requests based on path/host patterns
- **Security Groups**: Control inbound/outbound traffic
- **ACM Certificate**: Free SSL/TLS certificates

---

## Prerequisites

- AWS account with VPC and subnets configured
- ECS cluster or EC2 instances running Reporunner services
- Domain registered and Route 53 hosted zone created
- AWS CLI installed and configured
- Terraform (optional, for IaC)

---

## Method 1: AWS Console Setup

### Step 1: Create Target Groups

1. Go to [EC2 Console](https://console.aws.amazon.com/ec2/) → **Target Groups**
2. Click **Create target group**

**Frontend Target Group**:
- Target type: **IP addresses** (for ECS Fargate) or **Instances**
- Target group name: `reporunner-frontend-tg`
- Protocol: **HTTP**
- Port: **3000**
- VPC: Select your VPC
- Health check path: `/`
- Health check interval: **30 seconds**
- Healthy threshold: **2**
- Unhealthy threshold: **3**
- Timeout: **5 seconds**

**Backend Target Group**:
- Target group name: `reporunner-backend-tg`
- Port: **3001**
- Health check path: `/api/health`

**Grafana Target Group**:
- Target group name: `reporunner-grafana-tg`
- Port: **3000** (Grafana internal port)
- Health check path: `/api/health`

**Prometheus Target Group**:
- Target group name: `reporunner-prometheus-tg`
- Port: **9090**
- Health check path: `/-/healthy`

### Step 2: Create Application Load Balancer

1. Go to **Load Balancers** → **Create Load Balancer**
2. Choose **Application Load Balancer**
3. Configure:
   - Name: `reporunner-alb`
   - Scheme: **Internet-facing**
   - IP address type: **IPv4**
   - VPC: Select your VPC
   - Subnets: Select at least 2 subnets in different AZs
   - Security group: Create or select one that allows:
     - Inbound: HTTP (80), HTTPS (443) from 0.0.0.0/0
     - Outbound: All traffic

### Step 3: Create Listeners

**HTTP Listener (Port 80)**:
- Action: **Redirect to HTTPS**
- Port: **443**
- Status code: **301 - Moved Permanently**

**HTTPS Listener (Port 443)**:
- Default action: Forward to `reporunner-frontend-tg`
- Certificate: Select from ACM (see SSL section)

### Step 4: Add Listener Rules

Click on HTTPS:443 listener → **View/edit rules** → **Insert rule**

**Rule 1: API Traffic**
- IF: Path is `/api/*`
- THEN: Forward to `reporunner-backend-tg`
- Priority: 1

**Rule 2: WebSocket Traffic**
- IF: Path is `/socket.io/*`
- THEN: Forward to `reporunner-backend-tg`
- Priority: 2

**Rule 3: Grafana**
- IF: Path is `/grafana/*`
- THEN: Forward to `reporunner-grafana-tg`
- Priority: 3

**Rule 4: Prometheus**
- IF: Path is `/prometheus/*`
- THEN: Forward to `reporunner-prometheus-tg`
- Priority: 4

**Default Rule**:
- Forward to `reporunner-frontend-tg`

---

## Method 2: AWS CLI Setup

### Step 1: Create Target Groups

```bash
# Set variables
VPC_ID="vpc-0123456789abcdef0"
REGION="us-east-1"

# Create frontend target group
aws elbv2 create-target-group \
    --name reporunner-frontend-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path / \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --region $REGION

# Create backend target group
aws elbv2 create-target-group \
    --name reporunner-backend-tg \
    --protocol HTTP \
    --port 3001 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /api/health \
    --region $REGION

# Create Grafana target group
aws elbv2 create-target-group \
    --name reporunner-grafana-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id $VPC_ID \
    --target-type ip \
    --health-check-path /api/health \
    --region $REGION

# Get target group ARNs
FRONTEND_TG_ARN=$(aws elbv2 describe-target-groups \
    --names reporunner-frontend-tg \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)

BACKEND_TG_ARN=$(aws elbv2 describe-target-groups \
    --names reporunner-backend-tg \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)

GRAFANA_TG_ARN=$(aws elbv2 describe-target-groups \
    --names reporunner-grafana-tg \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text)
```

### Step 2: Create Security Group

```bash
# Create security group
SG_ID=$(aws ec2 create-security-group \
    --group-name reporunner-alb-sg \
    --description "Security group for Reporunner ALB" \
    --vpc-id $VPC_ID \
    --output text)

# Allow HTTP
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

# Allow HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0
```

### Step 3: Create Application Load Balancer

```bash
# Get subnet IDs (must be in at least 2 AZs)
SUBNET_IDS="subnet-abc123,subnet-def456"

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
    --name reporunner-alb \
    --type application \
    --scheme internet-facing \
    --ip-address-type ipv4 \
    --subnets $SUBNET_IDS \
    --security-groups $SG_ID \
    --tags Key=Name,Value=reporunner-alb \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text)

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns $ALB_ARN \
    --query "LoadBalancers[0].DNSName" \
    --output text)

echo "ALB DNS: $ALB_DNS"
```

### Step 4: Create Listeners and Rules

```bash
# Assuming you have ACM certificate ARN
CERT_ARN="arn:aws:acm:us-east-1:123456789012:certificate/abc-def-123"

# Create HTTP listener (redirect to HTTPS)
HTTP_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
    --query "Listeners[0].ListenerArn" \
    --output text)

# Create HTTPS listener
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
    --query "Listeners[0].ListenerArn" \
    --output text)

# Create rule for /api/*
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 1 \
    --conditions Field=path-pattern,Values='/api/*' \
    --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN

# Create rule for /socket.io/*
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 2 \
    --conditions Field=path-pattern,Values='/socket.io/*' \
    --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN

# Create rule for /grafana/*
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 3 \
    --conditions Field=path-pattern,Values='/grafana/*' \
    --actions Type=forward,TargetGroupArn=$GRAFANA_TG_ARN
```

---

## Method 3: Terraform Configuration

Create `infrastructure/terraform/aws/modules/alb/main.tf`:

```hcl
# Application Load Balancer
resource "aws_lb" "reporunner" {
  name               = "reporunner-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false
  enable_http2               = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name        = "reporunner-alb"
    Environment = var.environment
  }
}

# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "reporunner-alb-sg"
  description = "Security group for Reporunner ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "reporunner-alb-sg"
  }
}

# Target Groups
resource "aws_lb_target_group" "frontend" {
  name        = "reporunner-frontend-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/"
    matcher             = "200"
  }

  tags = {
    Name = "reporunner-frontend-tg"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "reporunner-backend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
  }

  tags = {
    Name = "reporunner-backend-tg"
  }
}

resource "aws_lb_target_group" "grafana" {
  name        = "reporunner-grafana-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
  }

  tags = {
    Name = "reporunner-grafana-tg"
  }
}

# HTTP Listener (Redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.reporunner.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.reporunner.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener Rules
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 2

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/socket.io/*"]
    }
  }
}

resource "aws_lb_listener_rule" "grafana" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 3

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.grafana.arn
  }

  condition {
    path_pattern {
      values = ["/grafana/*"]
    }
  }
}

# Outputs
output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.reporunner.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.reporunner.zone_id
}

output "frontend_tg_arn" {
  description = "ARN of frontend target group"
  value       = aws_lb_target_group.frontend.arn
}

output "backend_tg_arn" {
  description = "ARN of backend target group"
  value       = aws_lb_target_group.backend.arn
}
```

**Apply Terraform**:

```bash
cd infrastructure/terraform/aws

terraform init
terraform plan -var-file="production.tfvars"
terraform apply -var-file="production.tfvars"
```

---

## SSL/TLS with ACM

### Request Certificate

```bash
# Request certificate with AWS ACM
aws acm request-certificate \
    --domain-name example.com \
    --subject-alternative-names "*.example.com" \
    --validation-method DNS \
    --region us-east-1

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
    --query "CertificateSummaryList[?DomainName=='example.com'].CertificateArn" \
    --output text)

# Get validation records
aws acm describe-certificate \
    --certificate-arn $CERT_ARN \
    --query "Certificate.DomainValidationOptions"
```

### Add Validation Records to Route 53

```bash
# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones \
    --query "HostedZones[?Name=='example.com.'].Id" \
    --output text)

# Create validation CNAME record
# (Use AWS Console "Create record in Route 53" button for easier setup)
```

### Attach to ALB

The certificate is automatically attached when creating the HTTPS listener (see CLI/Terraform examples above).

---

## Path-Based Routing Rules

### Advanced Routing Examples

**Host-Based Routing** (subdomains):

```bash
# Create rule for api.example.com subdomain
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 10 \
    --conditions Field=host-header,Values='api.example.com' \
    --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN
```

**Multiple Conditions** (path + header):

```bash
# Route admin API to separate target group
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 20 \
    --conditions \
        Field=path-pattern,Values='/api/admin/*' \
        Field=http-header,HttpHeaderName=X-Admin-Token,Values='admin-secret' \
    --actions Type=forward,TargetGroupArn=$ADMIN_TG_ARN
```

**IP-Based Routing** (restrict access):

```bash
# Allow only specific IP ranges
aws elbv2 create-rule \
    --listener-arn $HTTPS_LISTENER_ARN \
    --priority 30 \
    --conditions Field=source-ip,Values='203.0.113.0/24','198.51.100.0/24' \
    --actions Type=forward,TargetGroupArn=$INTERNAL_TG_ARN
```

---

## Health Checks

### Configure Health Checks

**Healthy Thresholds**:
- **Interval**: 30 seconds (how often to check)
- **Timeout**: 5 seconds (wait time for response)
- **Healthy threshold**: 2 consecutive successes
- **Unhealthy threshold**: 3 consecutive failures

**Custom Health Check Paths**:
```bash
# Update target group health check
aws elbv2 modify-target-group \
    --target-group-arn $BACKEND_TG_ARN \
    --health-check-path /api/health \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --matcher HttpCode=200
```

### Check Target Health

```bash
# View target health status
aws elbv2 describe-target-health \
    --target-group-arn $BACKEND_TG_ARN

# Example output:
# {
#     "TargetHealthDescriptions": [
#         {
#             "Target": {
#                 "Id": "10.0.1.42",
#                 "Port": 3001
#             },
#             "HealthCheckPort": "3001",
#             "TargetHealth": {
#                 "State": "healthy"
#             }
#         }
#     ]
# }
```

---

## Auto Scaling Integration

### ECS Service Auto Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/reporunner-cluster/backend-service \
    --min-capacity 2 \
    --max-capacity 10

# Create scaling policy (target tracking)
aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/reporunner-cluster/backend-service \
    --policy-name backend-cpu-scaling \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 75.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "ScaleInCooldown": 60,
        "ScaleOutCooldown": 60
    }'
```

---

## Monitoring and Logging

### Enable Access Logs

```bash
# Create S3 bucket for logs
aws s3 mb s3://reporunner-alb-logs-${AWS_ACCOUNT_ID}

# Enable access logs
aws elbv2 modify-load-balancer-attributes \
    --load-balancer-arn $ALB_ARN \
    --attributes \
        Key=access_logs.s3.enabled,Value=true \
        Key=access_logs.s3.bucket,Value=reporunner-alb-logs-${AWS_ACCOUNT_ID}
```

### CloudWatch Metrics

Key metrics to monitor:
- **TargetResponseTime**: Backend latency
- **RequestCount**: Total requests
- **HTTPCode_Target_2XX_Count**: Successful responses
- **HTTPCode_Target_5XX_Count**: Server errors
- **HealthyHostCount**: Number of healthy targets
- **UnHealthyHostCount**: Number of unhealthy targets

**Create CloudWatch Alarm**:

```bash
aws cloudwatch put-metric-alarm \
    --alarm-name reporunner-backend-unhealthy-hosts \
    --alarm-description "Alert when backend has unhealthy hosts" \
    --metric-name UnHealthyHostCount \
    --namespace AWS/ApplicationELB \
    --statistic Average \
    --period 60 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --dimensions Name=LoadBalancer,Value=app/reporunner-alb/abc123 Name=TargetGroup,Value=targetgroup/reporunner-backend-tg/def456 \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:us-east-1:123456789012:reporunner-alerts
```

---

## Troubleshooting

### Issue: 502 Bad Gateway

**Diagnosis**:
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_ARN

# Check security groups allow ALB → targets
aws ec2 describe-security-groups --group-ids <target-sg-id>
```

**Solutions**:
1. Verify targets are registered and healthy
2. Check security group allows traffic from ALB
3. Verify health check path returns 200
4. Check target application logs

### Issue: Sticky Sessions Not Working

**Solution**: Enable sticky sessions on target group:
```bash
aws elbv2 modify-target-group-attributes \
    --target-group-arn $BACKEND_TG_ARN \
    --attributes Key=stickiness.enabled,Value=true \
                 Key=stickiness.type,Value=lb_cookie \
                 Key=stickiness.lb_cookie.duration_seconds,Value=86400
```

### Issue: WebSocket Connections Dropping

**Cause**: Idle timeout too short

**Solution**: Increase idle timeout:
```bash
aws elbv2 modify-load-balancer-attributes \
    --load-balancer-arn $ALB_ARN \
    --attributes Key=idle_timeout.timeout_seconds,Value=3600
```

---

## Cost Optimization

**Estimated Monthly Costs** (us-east-1):

- ALB: $16.20/month (720 hours)
- LCU usage: ~$8/month (varies by traffic)
- Data processing: $0.008/GB
- **Total**: ~$25-50/month for moderate traffic

**Tips**:
1. Use single ALB for multiple services (path-based routing)
2. Enable cross-zone load balancing for better distribution
3. Use target group deregistration delay to reduce waste
4. Delete unused target groups

---

## Next Steps

- [GCP Load Balancer Guide](./gcp-lb.md)
- [Azure Application Gateway Guide](./azure-appgw.md)
- [Domain Management](../domain-management.md)
- [Nginx Reverse Proxy](../nginx-reverse-proxy.md)

---

**Last Updated**: October 27, 2025
**Maintained By**: Reporunner Development Team
