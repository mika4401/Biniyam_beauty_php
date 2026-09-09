# Production Deployment Guide — Ethio Telecom Linux Hosting

## Overview

This guide walks you through deploying the Biniyam Beauty Academy website on **Ethio Telecom Linux Web Hosting (Silver Plan)** using the Plesk Control Panel.

**What we're deploying:**
- React frontend (static files — `dist/` folder)
- React admin app (static files — `dist/` folder)
- PHP backend API (all files in `Biniyam_PHP/`)
- MySQL database (hosted on Ethio Telecom's server)
- Chapa payment integration (API key switch from test → live)
- Cloudinary image hosting (same — no changes needed)

**Your hosting plan:**
- Linux Silver — ETB 2,000/year
- 20GB storage, 250GB bandwidth
- 3 MySQL databases
- Plesk Control Panel
- Free SSL via Let's Encrypt

---

## Phase 1: Domain and Hosting Setup

### Step 1: Log into Ethio Telecom Plesk

1. Go to https://myportal.ethiotelecom.et
2. Log in with your credentials
3. Navigate to **My Services** → **Linux Web Hosting**
4. Click **Log in to Plesk** (or go to `https://your-server-ip:8443`)

### Step 2: Set Up the Domain

In Plesk:

1. Go to **Domains** → **Add Domain**
2. Enter your domain: `biniyambeautytraining.com.et`
3. Set the document root to: `/httpdocs`
4. Click **Add Domain**

> **Note:** If you have subdomains (`admin.`, `api.`), you can either:
> - **Option A:** Create subdomains in Plesk (recommended) — each gets its own directory
> - **Option B:** Use one domain with path-based routing (simpler)

**Recommended — Option A (Subdomains):**
1. Add `biniyambeautytraining.com.et` → document root `/httpdocs`
2. Add `admin.biniyambeautytraining.com.et` → document root `/httpdocs/admin`
3. Add `api.biniyambeautytraining.com.et` → document root `/httpdocs/api`

### Step 3: Set Up MySQL Database

In Plesk:

1. Go to **Databases** → **Add Database**
2. Database name: `beauty_academy`
3. Create a database user: `beauty_user`
4. Set a strong password — **save this!**
5. Click **Add**

Save these credentials:
```
DB_HOST=localhost (or your server's internal address)
DB_NAME=beauty_academy
DB_USER=beauty_user
DB_PASS=YOUR_STRONG_PASSWORD
```

### Step 4: Upload the PHP Backend

**Method 1 — Plesk File Manager:**
1. Go to **Files** in Plesk
2. Navigate to `httpdocs/`
3. Upload all files from `Biniyam_PHP/` folder (except `setup.php`, `router.php`, `.env`, `LOCAL_TESTING_GUIDE.md`, `PRODUCTION_DEPLOYMENT_GUIDE.md`)

**Method 2 — FTP/SFTP (recommended for large uploads):**
1. Use FileZilla or WinSCP
2. Connect to your server via SFTP
3. Upload `Biniyam_PHP/` contents to `/httpdocs/`

**Files to upload:**
```
/httpdocs/
├── .htaccess
├── index.php
├── config/
│   ├── database.php
│   ├── chapa.php
│   ├── cloudinary.php
│   └── jwt.php
├── helpers/
│   ├── response.php
│   ├── jwt.php
│   └── validation.php
├── middleware/
│   └── AuthMiddleware.php
└── api/
    ├── auth.php
    ├── admin.php
    ├── programs.php
    ├── students.php
    ├── registrations.php
    ├── payments.php
    ├── chapa.php
    ├── cloudinary.php
    └── gallery.php
```

**Files NOT to upload:**
- `setup.php` — local setup script only
- `router.php` — PHP dev server only
- `.env` — create this manually on the server (see Step 5)
- `schema.sql` — run manually via phpMyAdmin (see Step 6)
- Documentation files

### Step 5: Create Production .env

Via Plesk File Manager or SSH, create `/httpdocs/.env`:

```ini
# ─── Database ───────────────────────────────────
DB_HOST=localhost
DB_NAME=beauty_academy
DB_USER=beauty_user
DB_PASS=YOUR_STRONG_PASSWORD_HERE

# ─── JWT ────────────────────────────────────────
JWT_SECRET=GENERATE_A_RANDOM_64_CHARACTER_STRING_HERE

# ─── Chapa (LIVE MODE) ─────────────────────────
CHAPA_SECRET_KEY=CHAPUBK-xxxxxxxxxxxxxxxxxxxxx
CHAPA_SANDBOX=false

# ─── Cloudinary ─────────────────────────────────
CLOUDINARY_CLOUD_NAME=djzmclbg0
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# ─── App URLs (Production) ──────────────────────
API_BASE_URL=https://api.biniyambeautytraining.com.et/api/v1
```

> **Generate a secure JWT secret:**
> ```bash
> openssl rand -hex 32
> ```
> Copy the output into `JWT_SECRET`.

### Step 6: Create MySQL Tables

**Option A — phpMyAdmin (easiest):**
1. In Plesk, go to **Databases** → click **phpMyAdmin** next to `beauty_academy`
2. Click the **SQL** tab
3. Paste the contents of `schema.sql` (but remove the `CREATE DATABASE` and `USE` lines at the top)
4. Click **Go**

**Option B — SSH:**
```bash
mysql -u beauty_user -p beauty_academy < schema.sql
```

**Option C — Run setup.php via SSH (if available):**
```bash
cd /httpdocs
php setup.php
```

### Step 7: Create the Admin User

If you used Option A or B above, the admin user is already seeded in the schema.

If not, create it manually via phpMyAdmin SQL tab:

```sql
-- First generate a hash: run this on your local machine
-- php -r "echo password_hash('StrongPassword123', PASSWORD_BCRYPT, ['cost' => 10]);"

INSERT INTO admins (full_name, email, password_hash, role)
VALUES ('Super Admin', 'admin@example.com', '$2y$10$YOUR_GENERATED_HASH_HERE', 'SUPER_ADMIN');
```

**Test the API:**
```
https://api.biniyambeautytraining.com.et/api/v1/
```

Should return:
```json
{"success":true,"message":"Biniyam Beauty Academy API is running","status":"ok","version":"1.0.0-php"}
```

---

## Phase 2: Build and Deploy the React Frontend

### Step 1: Build the Frontend

On your **local machine** (where the code is):

```powershell
cd C:\Users\damte\OneDrive\Desktop\b_beauty_academy\frontend
```

Update the API URL in `src/constants.ts`:
```typescript
export const API_BASE = 'https://api.biniyambeautytraining.com.et/api/v1'
```

Build:
```powershell
npm run build
```

This creates a `dist/` folder with all the static files.

### Step 2: Upload Frontend to Hosting

Upload the **contents** of the `dist/` folder to:
```
/httpdocs/
```

> **Important:** Upload the FILES inside `dist/`, not the `dist/` folder itself.

Your `/httpdocs/` should now look like:
```
/httpdocs/
├── .htaccess          ← from PHP API
├── index.php          ← from PHP API
├── index.html         ← from React build (frontend)
├── assets/            ← from React build
├── Bini_icon.svg      ← from React build (if in public/)
├── config/            ← PHP API
├── helpers/           ← PHP API
├── middleware/         ← PHP API
└── api/               ← PHP API
```

**Wait — there's a conflict!** The React `index.html` and PHP `index.php` are both at the root. We need to handle this.

### Step 3: Resolve the Routing Conflict

**The issue:** Both React and PHP want to serve files from `/httpdocs/`.

**Solution:** Since the API is on a **subdomain** (`api.biniyambeautytraining.com.et`), we put the API files in a separate directory:

**Revised file structure:**
```
/httpdocs/                    ← Frontend (React)
├── index.html
├── .htaccess
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
├── Bini_icon.svg
└── api/                      ← PHP API (subfolder)
    ├── index.php
    ├── config/
    ├── helpers/
    ├── middleware/
    └── api/

/httpdocs/admin/              ← Admin app (React)
├── index.html
├── .htaccess
└── assets/
```

**Update the frontend `.htaccess`** (create in `/httpdocs/`):
```apache
RewriteEngine On

# Serve API from /api/ subfolder
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ /api/index.php [L,QSA]

# Serve admin from /admin/
RewriteCond %{REQUEST_URI} ^/admin/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^admin/(.*)$ /admin/index.html [L,QSA]

# Serve static files directly
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Everything else → frontend SPA
RewriteRule ^ /index.html [L,QSA]
```

**Update `api/index.php`** — change the CORS origins:
```php
$allowedOrigins = [
    'https://biniyambeautytraining.com.et',
    'https://www.biniyambeautytraining.com.et',
    'https://admin.biniyambeautytraining.com.et',
    'http://localhost:5173',  // Keep for local dev
    'http://localhost:5174',
];
```

**Update `api/.htaccess`** (create in `/httpdocs/api/`):
```apache
RewriteEngine On
RewriteRule ^(.*)$ index.php [L,QSA]
```

---

## Phase 3: Build and Deploy the Admin App

### Step 1: Build the Admin

On your **local machine**:

```powershell
cd C:\Users\damte\OneDrive\Desktop\b_beauty_academy\admin
```

Update the API URL in `src/utils/api.ts`:
```typescript
const API_BASE = 'https://api.biniyambeautytraining.com.et/api/v1'
```

Build:
```powershell
npm run build
```

### Step 2: Upload Admin to Hosting

Upload the **contents** of `admin/dist/` to:
```
/httpdocs/admin/
```

---

## Phase 4: SSL Certificate

### Option A — Let's Encrypt (Free, via Plesk)

In Plesk:

1. Go to **SSL/TLS Certificates**
2. Click **Let's Encrypt**
3. Select your domain: `biniyambeautytraining.com.et`
4. Also select subdomains if you created them
5. Click **Get it free**

The certificate auto-renews every 90 days.

### Option B — Wildcard Certificate

If you have subdomains, get a wildcard certificate:
1. In Plesk → **SSL/TLS Certificates** → **Let's Encrypt**
2. Check **Issue a wildcard certificate**
3. Follow the DNS validation steps

---

## Phase 5: DNS Configuration

### Step 1: Point Your Domain to Ethio Telecom's Server

In your domain registrar (Ethio Telecom domain management):

| Record Type | Name | Value | TTL |
|-------------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 3600 |
| A | www | YOUR_SERVER_IP | 3600 |
| A | api | YOUR_SERVER_IP | 3600 |
| A | admin | YOUR_SERVER_IP | 3600 |

> **Find your server IP:** In Plesk, go to **Server** → **Server Information** or check the hosting details.

### Step 2: Wait for DNS Propagation

DNS changes can take 24-48 hours to propagate worldwide. You can check:
```
nslookup biniyambeautytraining.com.et
```

---

## Phase 6: Chapa Production Setup

### Step 1: Get Live API Key

1. Log into Chapa Dashboard: https://dashboard.chapa.co
2. Go to **Settings** → **API Keys**
3. Copy your **Live Secret Key** (starts with `CHAPUBK-`)
4. Update `.env` on the server:
   ```
   CHAPA_SECRET_KEY=CHAPUBK-your_live_key_here
   CHAPA_SANDBOX=false
   ```

### Step 2: Configure Callback URL

In Chapa Dashboard:

1. Go to **Settings** → **Webhooks**
2. Set **Callback URL**: `https://api.biniyambeautytraining.com.et/api/v1/chapa/callback`
3. Set **Webhook URL**: `https://api.biniyambeautytraining.com.et/api/v1/chapa/webhook`
4. Set a **Webhook Secret** (remember this — you'll need it for signature verification)
5. Tick both checkboxes:
   - ☑️ Receive Webhook
   - ☑️ Receive Webhook for failed Payments

### Step 3: Update Chapa Config

Update `/httpdocs/api/config/chapa.php`:
```php
return [
    'secret_key' => getenv('CHAPA_SECRET_KEY') ?: 'CHAPUBK-your-live-key',
    'api_base'   => 'https://api.chapa.co/v1',
    'sandbox'    => (getenv('CHAPA_SANDBOX') ?: 'false') === 'true',
];
```

### Step 4: Test Live Payment

1. Register for a course on the live site
2. Click Pay Now → opens Chapa payment page
3. Complete payment with real money (small amount for testing)
4. Verify the payment shows in Chapa dashboard
5. Verify the registration status updates in admin

---

## Phase 7: Cloudinary Setup (Same as Development)

Cloudinary works the same in production — just make sure your `.env` has the correct values:

```ini
CLOUDINARY_CLOUD_NAME=djzmclbg0
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

If you need to create a new Cloudinary account for production:
1. Go to https://cloudinary.com
2. Sign up (free tier: 25GB storage, 25GB bandwidth/month)
3. Get your credentials from the Dashboard → **Settings** → **Access Keys**

---

## Phase 8: Security Hardening

### Step 1: Protect .env File

Add to `/httpdocs/api/.htaccess`:
```apache
# Block access to .env
<Files ".env">
    Require all denied
</Files>
```

Or in the Plesk File Manager, set `.env` permissions to `600` (owner read/write only).

### Step 2: Enable HTTPS Redirect

In Plesk:
1. Go to **Domains** → your domain → **Hosting Settings**
2. Check **SSL/TLS support**
3. Check **Permanent SEO-safe 301 redirect from HTTP to HTTPS**

### Step 3: Set Security Headers

Already in `.htaccess`:
```apache
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set X-XSS-Protection "1; mode=block"
Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

### Step 4: Disable Directory Listing

Add to `/httpdocs/.htaccess`:
```apache
Options -Indexes
```

---

## Phase 9: Verification Checklist

After deployment, verify every feature:

| # | Test | URL | Expected |
|---|------|-----|----------|
| 1 | Frontend loads | `https://biniyambeautytraining.com.et` | Homepage with courses |
| 2 | Language toggle | Click 🌐 in navbar | Switches between EN/AM |
| 3 | Course list | Scroll to courses | All active programs show |
| 4 | Course detail | Click "Detail" on a course | Full description page |
| 5 | Add to cart | Click "Add to Cart" | Cart badge shows count |
| 6 | Checkout page | Click "Checkout" in navbar | Form + cart summary |
| 7 | Upload National ID | Click upload button on checkout | Cloudinary widget opens |
| 8 | Submit registration | Fill form → Submit | Creates registration + payment |
| 9 | Chapa payment | Opens in new tab | Chapa checkout page loads |
| 10 | Payment receipt | Complete payment | Receipt page shows details |
| 11 | Admin login | `https://admin.biniyambeautytraining.com.et/login` | Login form loads |
| 12 | Admin dashboard | Login with admin credentials | Stats cards show real data |
| 13 | Admin registrations | Click "Registrations" | List of all registrations |
| 14 | Admin programs | Click "Programs" | List of all programs |
| 15 | Admin edit program | Edit a program → Save | Changes reflect on frontend |
| 16 | API health check | `https://api.biniyambeautytraining.com.et/api/v1/` | JSON health response |
| 17 | Gallery | Scroll to gallery section | Images load from Cloudinary |
| 18 | SSL | Check browser address bar | 🔒 padlock shows |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Frontend shows "Network Error" | Check API_BASE URL in `constants.ts` matches the live API URL |
| CORS error in browser | Update `$allowedOrigins` in `api/index.php` to include your production domain |
| Chapa "Invalid API Key" | Make sure you're using the **live** key, not the test key |
| 500 Internal Server Error | Check PHP error log in Plesk → **Logs** → **Error Log** |
| Images not loading | Verify Cloudinary credentials in `.env` |
| Admin can't log in | Verify admin user exists in MySQL via phpMyAdmin |
| Payment not updating | Check Chapa webhook URL is correct and accessible from internet |
| SSL certificate error | Re-issue Let's Encrypt certificate in Plesk |
| Slow loading | Check bandwidth usage in Plesk — Silver plan has 250GB/month |

---

## File Structure Summary (Production)

```
/httpdocs/                              ← Frontend (React)
├── index.html
├── .htaccess
├── Bini_icon.svg
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
│
├── .env                                ← Environment variables (PROTECT THIS)
│
├── api/                                ← PHP API entry point
│   ├── index.php
│   ├── .htaccess
│   ├── config/
│   │   ├── database.php
│   │   ├── chapa.php
│   │   ├── cloudinary.php
│   │   └── jwt.php
│   ├── helpers/
│   │   ├── response.php
│   │   ├── jwt.php
│   │   └── validation.php
│   ├── middleware/
│   │   └── AuthMiddleware.php
│   └── api/
│       ├── auth.php
│       ├── admin.php
│       ├── programs.php
│       ├── students.php
│       ├── registrations.php
│       ├── payments.php
│       ├── chapa.php
│       ├── cloudinary.php
│       └── gallery.php
│
└── admin/                              ← Admin app (React)
    ├── index.html
    ├── .htaccess
    └── assets/
        ├── index-[hash].js
        └── index-[hash].css
```

---

## Cost Summary

| Item | Cost | Notes |
|------|------|-------|
| Domain (.com.et) | ~ETB 500/year | One-time registration |
| Linux Silver Hosting | ETB 2,000/year | 20GB storage, 250GB bandwidth |
| MongoDB Atlas | Free tier | Or remove if using MySQL only |
| Cloudinary | Free tier | 25GB storage, 25GB bandwidth |
| Chapa | 2.5% per transaction | No monthly fee |
| SSL Certificate | Free | Let's Encrypt via Plesk |
| **Total Year 1** | **~ETB 2,500 + Chapa fees** | |

---

## Rollback Plan

If something goes wrong:

1. **Revert code:** Upload the previous `dist/` and PHP files
2. **Revert database:** Restore from phpMyAdmin backup
3. **Switch Chapa back to test:** Update `.env` → `CHAPA_SANDBOX=true`
4. **Check logs:** Plesk → Logs → Error Log for PHP errors

---

## After Deployment — Ongoing Tasks

| Task | Frequency | How |
|------|-----------|-----|
| Monitor Chapa payments | Daily | Chapa Dashboard |
| Check PHP error logs | Weekly | Plesk → Logs |
| Update SSL certificate | Auto (90 days) | Let's Encrypt auto-renewal |
| Backup database | Weekly | phpMyAdmin → Export |
| Monitor Cloudinary usage | Monthly | Cloudinary Dashboard |
| Check bandwidth | Monthly | Plesk → Statistics |
