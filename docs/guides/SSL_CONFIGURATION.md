# SSL Configuration Guide

> **Consolidated**: This guide supersedes the archived `SSL_SETUP.md` (basic setup).
> **Last Updated**: 2026-02-01

## 🎯 Overview

This guide provides step-by-step instructions for deploying the **zero-downtime SSL renewal system** using Let's Encrypt's webroot authentication method.

**Status**: ✅ Code merged in PR #1548
**Next**: Configure servers and GitHub secrets

---

## 📋 Prerequisites

- [x] PR #1548 merged to development
- [ ] GitHub secrets configured
- [ ] Frontend servers prepared
- [ ] Deployment tested

---

## 🚀 Phase 1: GitHub Secrets Configuration

### Required Secrets Per Environment

Add `DOMAIN_NAME` to each GitHub environment:

| Environment | Secret Name | Secret Value |
|-------------|-------------|--------------|
| **dev-frontend** | `DOMAIN_NAME` | `dev.meatscentral.com` |
| **uat-frontend** | `DOMAIN_NAME` | `uat.meatscentral.com` |
| **prod-frontend** | `DOMAIN_NAME` | `meatscentral.com` |

### Steps to Add Secrets

1. Go to: https://github.com/Meats-Central/ProjectMeats/settings/environments
2. For each environment (dev-frontend, uat-frontend, prod-frontend):
   - Click on the environment name
   - Click "Add secret"
   - Name: `DOMAIN_NAME`
   - Value: (see table above)
   - Click "Add secret"

---

## 🔧 Phase 2: Server Preparation

### Order of Execution

1. **UAT** (URGENT - certificate expired)
2. **DEV** (certificate expires Mar 9, 2026)
3. **PROD** (certificate expires Mar 31, 2026)

---

## 🚨 UAT Server Setup (URGENT)

### Current Status
- ❌ Certificate EXPIRED (Jan 2, 2026)
- 🔴 **Priority**: CRITICAL

### Step 1: Connect to UAT Frontend Server

```bash
ssh root@meatscentral-uat-frontend
```

### Step 2: Create Webroot Directory

```bash
# Create directory for ACME challenges
sudo mkdir -p /var/www/certbot
sudo chmod 755 /var/www/certbot

# Verify
ls -la /var/www/certbot
```

### Step 3: Update Certbot Configuration

```bash
# Backup current config
sudo cp /etc/letsencrypt/renewal/uat.meatscentral.com.conf \
       /etc/letsencrypt/renewal/uat.meatscentral.com.conf.backup

# Edit config
sudo nano /etc/letsencrypt/renewal/uat.meatscentral.com.conf
```

**Make these changes:**

```ini
# Find and change:
authenticator = standalone

# To:
authenticator = webroot

# Add (after the authenticator line):
webroot_path = /var/www/certbot

# Remove these lines if present:
pre_hook = ...
post_hook = ...
```

**Save and exit** (Ctrl+X, Y, Enter)

### Step 4: Verify Firewall

```bash
# Ensure port 443 is open
sudo ufw allow 443/tcp

# Check status
sudo ufw status | grep 443
```

### Step 5: Test Certbot Configuration

```bash
# Dry run test (does NOT issue certificates)
sudo certbot renew --dry-run
```

**Expected output:**
```
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/uat.meatscentral.com/fullchain.pem (success)
```

**If you see errors**, check:
- Webroot directory exists: `ls -la /var/www/certbot`
- Config file correct: `cat /etc/letsencrypt/renewal/uat.meatscentral.com.conf`
- Container is running: `docker ps | grep frontend`

### Step 6: Wait for Deployment

The GitHub Actions workflow will automatically deploy the updated code (~5 minutes).

**Check deployment status:**
https://github.com/Meats-Central/ProjectMeats/actions

### Step 7: Verify After Deployment

```bash
# Check container logs
docker logs pm-frontend | tail -30

# Expected output:
# → Using domain: uat.meatscentral.com
# ✓ SSL certificates found for uat.meatscentral.com

# Test HTTPS
curl -I https://uat.meatscentral.com

# Should return: HTTP/1.1 200 OK

# Check certificate expiry
echo | openssl s_client -servername uat.meatscentral.com \
       -connect localhost:443 2>/dev/null | \
       openssl x509 -noout -dates
```

---

## 💻 DEV Server Setup

### Current Status
- ✅ Certificate valid until Mar 9, 2026
- 🟡 **Priority**: Medium

### Steps

Repeat the same process as UAT:

```bash
# 1. Connect
ssh root@<dev-frontend-ip>

# 2. Create webroot
sudo mkdir -p /var/www/certbot
sudo chmod 755 /var/www/certbot

# 3. Backup and edit config
sudo cp /etc/letsencrypt/renewal/dev.meatscentral.com.conf \
       /etc/letsencrypt/renewal/dev.meatscentral.com.conf.backup

sudo nano /etc/letsencrypt/renewal/dev.meatscentral.com.conf
# Change to webroot, add webroot_path, remove hooks

# 4. Test
sudo certbot renew --dry-run

# 5. Verify after deployment
docker logs pm-frontend | tail -30
curl -I https://dev.meatscentral.com
```

---

## 🏢 PROD Server Setup

### Current Status
- ✅ Certificate valid until Mar 31, 2026
- 🟢 **Priority**: Low (but complete before March)

### Important Notes

- **Test on DEV and UAT first** before configuring PROD
- **Plan maintenance window** (though no downtime is expected)
- **Have rollback plan** ready

### Steps

Same process as DEV/UAT:

```bash
# 1. Connect
ssh root@<prod-frontend-ip>

# 2. Create webroot
sudo mkdir -p /var/www/certbot
sudo chmod 755 /var/www/certbot

# 3. Backup and edit config
sudo cp /etc/letsencrypt/renewal/meatscentral.com.conf \
       /etc/letsencrypt/renewal/meatscentral.com.conf.backup

sudo nano /etc/letsencrypt/renewal/meatscentral.com.conf
# Change to webroot, add webroot_path, remove hooks

# 4. Test
sudo certbot renew --dry-run

# 5. Verify after deployment
docker logs pm-frontend | tail -30
curl -I https://meatscentral.com
```

---

## 🔍 Verification Checklist

### Per Environment

- [ ] GitHub secret `DOMAIN_NAME` added
- [ ] Webroot directory created: `/var/www/certbot`
- [ ] Certbot config updated to use webroot
- [ ] `certbot renew --dry-run` succeeds
- [ ] Firewall allows port 443
- [ ] Deployment completed successfully
- [ ] Container logs show domain and SSL found
- [ ] HTTPS site loads correctly
- [ ] Admin CSS loads (no 404 errors)

---

## 📊 How It Works

### Architecture

```
┌─────────────────────────────────────────────────┐
│ Internet                                        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  HTTPS (Port 443)    │
        │  HTTP (Port 80)      │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Frontend Container  │
        │  (Nginx)             │
        │                      │
        │  Serves:             │
        │  - React app         │
        │  - ACME challenges   │
        │                      │
        │  Proxies:            │
        │  - /api/ → Backend   │
        │  - /admin/ → Backend │
        │  - /static/ → Backend│
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Backend Container   │
        │  (Django + DRF)      │
        └──────────────────────┘
```

### Webroot Flow

```
1. Certbot starts renewal
   ↓
2. Places challenge file:
   /var/www/certbot/.well-known/acme-challenge/TOKEN
   ↓
3. Let's Encrypt requests:
   http://domain/.well-known/acme-challenge/TOKEN
   ↓
4. Nginx serves file from /var/www/certbot
   (Container has volume mount)
   ↓
5. Validation succeeds
   ↓
6. Certificate renewed
   (No container restart needed!)
```

---

## 🐛 Troubleshooting

### Issue: `certbot renew --dry-run` fails with port error

**Error:**
```
Could not bind TCP port 80 because it is already in use
```

**Solution:**
1. Verify config uses `webroot`:
   ```bash
   grep "authenticator" /etc/letsencrypt/renewal/*.conf
   ```
2. Should show: `authenticator = webroot`
3. If shows `standalone`, edit the file again

---

### Issue: Container doesn't detect SSL certificates

**Symptoms:**
- Container logs: `ℹ SSL certificates not found`
- Site uses HTTP only

**Solution:**
1. Check DOMAIN_NAME is set:
   ```bash
   docker exec pm-frontend env | grep DOMAIN_NAME
   ```
2. Check certificates exist:
   ```bash
   docker exec pm-frontend ls -la /etc/letsencrypt/live/${DOMAIN_NAME}/
   ```
3. If missing, verify volume mounts:
   ```bash
   docker inspect pm-frontend | grep -A 10 "Mounts"
   ```

---

### Issue: Admin CSS returns 404

**Error in browser console:**
```
Failed to load resource: the server responded with a status of 404 (Not Found)
base.css:1  Failed to load resource
```

**Solution:**
This should be fixed by the `^~` modifier. Verify nginx config:

```bash
docker exec pm-frontend cat /etc/nginx/conf.d/default.conf | grep -A 3 "location.*static"
```

Should show:
```nginx
location ^~ /static/ {
    proxy_pass http://backend:8000;
```

If missing `^~`, redeploy the container.

---

### Issue: ACME challenge fails

**Error:**
```
Failed authorization procedure. uat.meatscentral.com (http-01):
urn:ietf:params:acme:error:unauthorized :: The client lacks sufficient
authorization :: Invalid response from http://uat.meatscentral.com/.well-known/acme-challenge/TOKEN
```

**Solution:**
1. Test ACME endpoint:
   ```bash
   # Create test file
   echo "test" | sudo tee /var/www/certbot/test.txt

   # Access via HTTP
   curl http://uat.meatscentral.com/.well-known/acme-challenge/test.txt

   # Should return: test
   ```

2. If 404, check container mounts:
   ```bash
   docker exec pm-frontend ls -la /var/www/certbot/
   ```

---

## 📅 Renewal Schedule

Certbot automatically attempts renewal when certificates have **30 days or less** remaining.

| Environment | Current Expiry | Auto-Renewal Window | Status |
|-------------|----------------|---------------------|---------|
| **UAT** | ❌ EXPIRED | **Now** | 🔴 Configure immediately |
| **DEV** | Mar 9, 2026 | Feb 7-9, 2026 | 🟡 Configure within 2 weeks |
| **PROD** | Mar 31, 2026 | Mar 1-3, 2026 | 🟢 Configure within 2 months |

### Manual Renewal (If Needed)

```bash
# Force renewal (not a dry run)
sudo certbot renew --force-renewal

# Check new expiry
sudo certbot certificates
```

---

## ✅ Success Criteria

After completing all phases:

- [ ] All GitHub secrets configured
- [ ] UAT certificate renewed and valid
- [ ] UAT site accessible via HTTPS
- [ ] DEV server configured
- [ ] PROD server configured
- [ ] Admin panel CSS loads correctly
- [ ] All `certbot renew --dry-run` tests pass
- [ ] Container logs show SSL detected
- [ ] Zero downtime during deployments

---

## 📞 Support

If issues persist after following this guide:

1. Check GitHub Actions logs for deployment errors
2. Review container logs: `docker logs pm-frontend`
3. Check certbot logs: `sudo cat /var/log/letsencrypt/letsencrypt.log`
4. Verify DNS points to correct server IP

---

## 📚 Additional Resources

- [Let's Encrypt Webroot Documentation](https://letsencrypt.org/docs/challenge-types/#http-01-challenge)
- [Certbot User Guide](https://eff-certbot.readthedocs.io/)
- [Nginx Location Priority](https://nginx.org/en/docs/http/ngx_http_core_module.html#location)
- [PR #1548 - Implementation Details](https://github.com/Meats-Central/ProjectMeats/pull/1548)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-03
**Status**: Ready for deployment
