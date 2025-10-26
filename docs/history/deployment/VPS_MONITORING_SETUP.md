# VPS Monitoring Subdomains Configuration

**Date**: October 25, 2025
**VPS**: 194.140.199.62 (ferdous@194.140.199.62)
**Task**: Configure Nginx for 5 monitoring subdomains
**Status**: Configuration files created, ready for deployment

## Overview

Created production-ready Nginx configurations for 5 monitoring service subdomains on the KlikkFlow VPS to provide secure, authenticated access to monitoring infrastructure.

## Subdomains Configured

### 1. **grafana.klikk.ai** → Port 3030
- **Service**: Grafana Dashboard
- **Authentication**: Optional (can be enabled via uncomment)
- **Features**:
  - WebSocket support for live updates (`/api/live/`)
  - SSL with Let's Encrypt
  - Security headers
  - Gzip compression

### 2. **prometheus.klikk.ai** → Port 9090
- **Service**: Prometheus Metrics Server
- **Authentication**: Basic Auth (REQUIRED)
- **Features**:
  - SSL with Let's Encrypt
  - Security headers
  - Gzip compression
  - Protected metrics access

### 3. **kibana.klikk.ai** → Port 5601
- **Service**: Kibana Logs Dashboard
- **Authentication**: Basic Auth (REQUIRED)
- **Features**:
  - WebSocket support for console proxy (`/api/console/proxy`)
  - Increased timeouts (120s) for heavy operations
  - Larger client body size (100MB)
  - SSL with Let's Encrypt

### 4. **alerts.klikk.ai** → Port 9093
- **Service**: Alertmanager
- **Authentication**: Basic Auth (REQUIRED)
- **Features**:
  - API endpoints support (`/api/`)
  - SSL with Let's Encrypt
  - Security headers
  - Gzip compression

### 5. **cache.klikk.ai** → Port 9081
- **Service**: Redis Commander
- **Authentication**: Basic Auth (REQUIRED)
- **Features**:
  - WebSocket support for Socket.IO (`/socket.io/`)
  - SSL with Let's Encrypt
  - Security headers
  - Gzip compression

## Configuration Details

### Security Features

All configurations include:
- **SSL/TLS**: TLSv1.2 and TLSv1.3 only
- **Security Headers**:
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **HTTP → HTTPS Redirect**: Automatic redirection
- **Gzip Compression**: Enabled for all text-based content
- **Proper Logging**: Separate access and error logs per subdomain

### Basic Authentication

Configuration uses Nginx basic auth with:
- **Password File**: `/etc/nginx/.htpasswd_monitoring`
- **Default Username**: `admin`
- **Password**: To be set during deployment

Services requiring basic auth:
- ✓ prometheus.klikk.ai (metrics protection)
- ✓ kibana.klikk.ai (logs protection)
- ✓ alerts.klikk.ai (alert management protection)
- ✓ cache.klikk.ai (cache access protection)
- ✗ grafana.klikk.ai (optional - has own auth)

## Files Created

### Configuration Files (`/tmp/nginx-configs/`)

1. **grafana.klikk.ai** - Grafana dashboard configuration
2. **prometheus.klikk.ai** - Prometheus metrics server configuration
3. **kibana.klikk.ai** - Kibana logs dashboard configuration
4. **alerts.klikk.ai** - Alertmanager configuration
5. **cache.klikk.ai** - Redis Commander configuration

### Documentation

- **DEPLOYMENT_INSTRUCTIONS.md** - Comprehensive manual deployment guide
- **deploy.sh** - Automated deployment script with interactive prompts

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

```bash
# Run the deployment script
bash /tmp/nginx-configs/deploy.sh
```

The script will:
1. ✓ Upload all 5 configuration files to VPS
2. ✓ Move files to `/etc/nginx/sites-available/`
3. ✓ Setup basic authentication with htpasswd
4. ✓ Enable all 5 sites
5. ✓ Test Nginx configuration
6. ✓ Generate SSL certificates with Let's Encrypt
7. ✓ Reload Nginx

### Method 2: Manual Deployment

Follow the comprehensive guide in `/tmp/nginx-configs/DEPLOYMENT_INSTRUCTIONS.md`:

1. Upload configuration files via SCP
2. Move to `/etc/nginx/sites-available/`
3. Create basic auth password file
4. Enable sites with symlinks
5. Generate SSL certificates
6. Test and reload Nginx

## Prerequisites

### DNS Configuration Required

Before deployment, ensure these DNS A records exist:

```dns
grafana.klikk.ai     A    194.140.199.62
prometheus.klikk.ai  A    194.140.199.62
kibana.klikk.ai      A    194.140.199.62
alerts.klikk.ai      A    194.140.199.62
cache.klikk.ai       A    194.140.199.62
```

### Docker Containers Running

Verified containers with exposed ports:
- ✓ Grafana: 0.0.0.0:3030 → 3000/tcp
- ✓ Prometheus: 0.0.0.0:9090 → 9090/tcp
- ✓ Kibana: 0.0.0.0:5601 → 5601/tcp
- ✓ Alertmanager: 0.0.0.0:9093 → 9093/tcp
- ✓ Redis Commander: 0.0.0.0:9081 → 8081/tcp

### System Requirements

- Nginx installed and running
- Certbot for SSL certificates
- Apache2-utils for htpasswd
- SSH access with sudo privileges

## Implementation Notes

### Challenge: Sudo Password Requirement

Initial automated deployment via SSH encountered sudo password requirement:
```
sudo: a terminal is required to read the password
```

**Solution**: Created two deployment methods:
1. Interactive script that prompts for password when needed
2. Manual deployment guide for step-by-step execution

### Configuration Pattern

All configurations follow a consistent pattern based on existing `klikkflow` configuration:
- HTTP redirect server block
- HTTPS server block with SSL
- Proxy pass to localhost:PORT
- Security headers and compression
- Separate logging per subdomain

### WebSocket Support

Services requiring WebSocket support:
- ✓ **Grafana**: `/api/live/` for live dashboard updates
- ✓ **Kibana**: `/api/console/proxy` for Dev Tools console
- ✓ **Redis Commander**: `/socket.io/` for real-time UI updates

## Post-Deployment Verification

### Testing Checklist

1. **Access Each Subdomain**:
   - [ ] https://grafana.klikk.ai (should load Grafana)
   - [ ] https://prometheus.klikk.ai (should prompt for auth)
   - [ ] https://kibana.klikk.ai (should prompt for auth)
   - [ ] https://alerts.klikk.ai (should prompt for auth)
   - [ ] https://cache.klikk.ai (should prompt for auth)

2. **Verify SSL Certificates**:
   - [ ] All sites use HTTPS
   - [ ] Certificates are valid
   - [ ] HTTP redirects to HTTPS

3. **Check Logs**:
   ```bash
   sudo tail -f /var/log/nginx/grafana.klikk.ai.access.log
   sudo tail -f /var/log/nginx/grafana.klikk.ai.error.log
   ```

4. **Monitor Container Logs**:
   ```bash
   docker logs -f klikkflow-grafana-1
   docker logs -f klikkflow-prometheus-1
   ```

## Maintenance

### SSL Certificate Renewal

Certbot auto-renewal is configured. Test with:
```bash
sudo certbot renew --dry-run
```

### Update Basic Auth Password

```bash
# Update password for existing user
sudo htpasswd /etc/nginx/.htpasswd_monitoring admin

# Add new user
sudo htpasswd /etc/nginx/.htpasswd_monitoring newuser
```

### Reload Nginx Configuration

```bash
# Test configuration first
sudo nginx -t

# If test passes, reload
sudo systemctl reload nginx
```

## Architecture Impact

### Before This Configuration

- ✓ app.klikk.ai (Frontend)
- ✓ api.klikk.ai (Backend API)
- ✗ Monitoring services not publicly accessible

### After This Configuration

- ✓ app.klikk.ai (Frontend)
- ✓ api.klikk.ai (Backend API)
- ✓ grafana.klikk.ai (Monitoring Dashboard)
- ✓ prometheus.klikk.ai (Metrics Server)
- ✓ kibana.klikk.ai (Logs Dashboard)
- ✓ alerts.klikk.ai (Alert Management)
- ✓ cache.klikk.ai (Redis Management)

**Total Subdomains**: 7 (2 existing + 5 new monitoring)

## Security Considerations

### Implemented Security Measures

1. **Basic Authentication**: Protects sensitive monitoring interfaces
2. **SSL/TLS Encryption**: All traffic encrypted
3. **Security Headers**: Prevent common web vulnerabilities
4. **HTTPS-Only**: HTTP automatically redirects to HTTPS
5. **Strong TLS Configuration**: Only TLSv1.2 and TLSv1.3 supported

### Recommendations

1. **Strong Passwords**: Use complex passwords for basic auth
2. **IP Whitelisting**: Consider restricting access to known IPs
3. **Rate Limiting**: Add rate limiting for sensitive endpoints
4. **Regular Updates**: Keep Nginx and Certbot updated
5. **Log Monitoring**: Regularly review access logs

## Related Documentation

- [VPS Production Deployment (2025-10-24)](./VPS_PRODUCTION_DEPLOYMENT_2025-10-24.md)
- [Docker Configuration](../../deployment/docker/)
- [Nginx Configuration Guide](../../operations/nginx.md)

## Summary

Successfully created production-ready Nginx configurations for 5 monitoring subdomains with:
- ✅ SSL/TLS encryption via Let's Encrypt
- ✅ Basic authentication for sensitive services
- ✅ WebSocket support for real-time features
- ✅ Security headers and best practices
- ✅ Comprehensive logging
- ✅ Automated and manual deployment options

**Status**: Ready for deployment
**Next Steps**: Execute deployment script or follow manual deployment guide

---

**Generated**: October 25, 2025
**Author**: Claude Code
**Category**: Deployment / Infrastructure Configuration
