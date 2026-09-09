# Local Testing Guide — PHP Backend

> **Last updated:** August 30, 2026  
> **Covers:** All fixes from the XAMPP deployment session (routing, camelCase conversion, validation, Chapa integration)

---

## Prerequisites — What to Install

### XAMPP (Required)

XAMPP bundles Apache, PHP, and MySQL — all needed for the PHP backend.

1. **Download** from https://www.apachefriends.org → choose **PHP 8.3** for Windows
2. **Install** to `C:\xampp` (default)
3. **Open XAMPP Control Panel** → click **Start** next to **Apache** and **MySQL**
4. **Verify** Apache: open browser → `http://localhost` (should show XAMPP welcome page)
5. **Verify** MySQL: open browser → `http://localhost/phpmyadmin` (should show phpMyAdmin)

### PHP Extensions (included in XAMPP)

All required extensions are enabled by default:
- `pdo_mysql` — MySQL connection
- `curl` — Chapa API calls
- `json` — JSON encoding
- `mbstring` — multibyte strings
- `openssl` — HTTPS

To verify: open `http://localhost/dashboard/phpinfo.php` and search for these.

---

## Step-by-Step Setup

### Step 1: Copy PHP Backend to XAMPP

```powershell
# Option A: xcopy
xcopy /E /I "C:\Users\damte\OneDrive\Desktop\Biniyam_PHP" "C:\xampp\htdocs\Biniyam_PHP"

# Option B: drag and drop
# Drag the Biniyam_PHP folder into C:\xampp\htdocs\
```

### Step 2: Configure `.env`

Edit `C:\xampp\htdocs\Biniyam_PHP\.env`:

```env
# ─── Database ───────────────────────────────────
DB_HOST=localhost
DB_NAME=beauty_academy
DB_USER=root
DB_PASS=

# ─── JWT ────────────────────────────────────────
JWT_SECRET=biniyam-beauty-academy-jwt-secret-2026-change-me

# ─── Chapa ──────────────────────────────────────
CHAPA_SECRET_KEY=CHAPUBK_TEST-your-test-key-here
CHAPA_SANDBOX=true

# ─── Cloudinary ─────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# ─── App URLs ───────────────────────────────────
API_BASE_URL=http://localhost/Biniyam_PHP/api/v1
```

> **XAMPP default:** `root` user with **no password**. If you set a password during install, update `DB_PASS`.

### Step 3: Create Database + Admin User

```powershell
cd C:\xampp\htdocs\Biniyam_PHP
php setup.php
```

Expected output:
```
✓ PHP Version: 8.3.x
✓ Extension: pdo_mysql
✓ Extension: curl
✓ Connected to MySQL server
✓ Database `beauty_academy` ready
✓ Schema applied (8 statements)
✓ Admin user created: admin@example.com / StrongPassword123
```

### Step 4: Seed Test Programs

```powershell
# Login to get a token
curl -X POST http://localhost/Biniyam_PHP/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"StrongPassword123\"}"
```

Copy the `accessToken` from the response, then create programs:

```powershell
# Replace YOUR_TOKEN with the accessToken above
set TOKEN=YOUR_TOKEN

# Create Men's Special Class (half payment)
curl -X POST http://localhost/Biniyam_PHP/api/v1/programs -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"title\":\"Men's Special Class\",\"description\":\"Professional men's grooming and styling course\",\"fullDescription\":\"Complete men's grooming course covering beard shaping, haircuts, and styling techniques.\",\"price\":25000,\"duration\":\"6 weeks\",\"image\":\"https://images.unsplash.com/photo-1503951914875-452162b0f3f1\",\"included\":[\"Professional tools kit\",\"Certificate of completion\"],\"allowsHalfPayment\":true}"

# Create Braid (half payment)
curl -X POST http://localhost/Biniyam_PHP/api/v1/programs -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"title\":\"Braid\",\"description\":\"Professional braiding techniques course\",\"fullDescription\":\"Learn box braids, cornrows, twists, crochet braids, and protective styling.\",\"price\":18000,\"duration\":\"6 weeks\",\"image\":\"https://images.unsplash.com/photo-1522337360788-8b13dee7a37e\",\"included\":[\"Braiding hair samples\",\"Practice sessions\",\"Certificate\"],\"allowsHalfPayment\":true}"

# Create Advanced Hair Styling (full payment only)
curl -X POST http://localhost/Biniyam_PHP/api/v1/programs -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"title\":\"Advanced Hair Styling\",\"description\":\"Master cuts, colour theory, styling, and salon finishing\",\"fullDescription\":\"Develop the technical control and creative judgement required for modern salon work.\",\"price\":21000,\"duration\":\"14 weeks\",\"image\":\"https://images.unsplash.com/photo-1560066984-138dadb4c035\",\"included\":[\"Mannequin practice sessions\",\"Colour theory workbook\",\"Certificate\"],\"allowsHalfPayment\":false}"
```

### Step 5: Test the Health Check

Open browser → `http://localhost/Biniyam_PHP/api/v1/`

Expected:
```json
{"success":true,"message":"Biniyam Beauty Academy API is running","status":"ok","version":"1.0.0-php"}
```

---

## API Endpoint Tests

Run these in PowerShell. **Save your token after Step 2.**

### Auth

**1. Login**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/auth/login -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"StrongPassword123\"}"
```

**2. Save the token** (copy `accessToken` from response):
```powershell
set TOKEN=PASTE_TOKEN_HERE
```

**3. Admin Profile**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/admin/profile -H "Authorization: Bearer %TOKEN%"
```

**4. Change Password**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/auth/change-password -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"currentPassword\":\"StrongPassword123\",\"newPassword\":\"NewPass123!\",\"confirmNewPassword\":\"NewPass123!\"}"
```

> **Note:** After changing password, you must login again with the new password to get a fresh token.

**5. Refresh Token**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/auth/refresh -H "Content-Type: application/json" -d "{\"refreshToken\":\"PASTE_REFRESH_TOKEN_HERE\"}"
```

### Programs (Public)

**6. List Programs**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/programs
```

**7. Get Program by Slug**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/programs/braid
```

### Programs (Admin)

**8. Create Program**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/programs -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"title\":\"Nail Art & Manicure\",\"description\":\"Professional nail art and manicure techniques\",\"fullDescription\":\"Complete nail course covering gel nails, acrylics, nail art designs, and spa manicure.\",\"price\":12000,\"duration\":\"4 weeks\",\"image\":\"https://images.unsplash.com/photo-1604654894610-df63bc536371\",\"included\":[\"Nail kit\",\"Certificate\"],\"allowsHalfPayment\":false}"
```

**9. Update Program**
```powershell
curl -X PUT http://localhost/Biniyam_PHP/api/v1/programs/3 -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"price\":22000,\"description\":\"Updated description\"}"
```

**10. Delete Program (soft-delete)**
```powershell
curl -X DELETE http://localhost/Biniyam_PHP/api/v1/programs/1 -H "Authorization: Bearer %TOKEN%"
```

### Registrations

**11. Validate Cart**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/registrations/validate-cart -H "Content-Type: application/json" -d "{\"programs\":[\"braid\",\"advanced-hair-styling\"]}"
```

**12. Create Registration (Full Payment)**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/registrations/bulk-create -H "Content-Type: application/json" -d "{\"student\":{\"firstName\":\"Abebe\",\"lastName\":\"Kebede\",\"email\":\"abebe.test@gmail.com\",\"phone\":\"+251911223344\",\"educationLevel\":\"Grade 12\"},\"programs\":[\"mens-hair-normal-class\",\"braid\"],\"schedule\":\"weekend\",\"paymentType\":\"Full\"}"
```

**13. Create Registration (Half Payment)**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/registrations/bulk-create -H "Content-Type: application/json" -d "{\"student\":{\"firstName\":\"Sara\",\"lastName\":\"Ahmed\",\"email\":\"sara.test@gmail.com\",\"phone\":\"+251923456789\",\"educationLevel\":\"Diploma\"},\"programs\":[\"braid\"],\"schedule\":\"weekend\",\"paymentType\":\"Half\"}"
```

> **Note:** Half payment is only allowed when ALL selected programs support it.

**14. List Registrations (Admin)**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/registrations -H "Authorization: Bearer %TOKEN%"
```

**15. Registration Stats (Admin)**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/registrations/stats/summary -H "Authorization: Bearer %TOKEN%"
```

**16. Record Manual Payment**
```powershell
curl -X PATCH http://localhost/Biniyam_PHP/api/v1/registrations/2/payment -H "Content-Type: application/json" -H "Authorization: Bearer %TOKEN%" -d "{\"amount\":9000}"
```

### Chapa Payment

**17. Initialize Payment**
```powershell
curl -X POST http://localhost/Biniyam_PHP/api/v1/chapa/initialize -H "Content-Type: application/json" -d "{\"registrationId\":2}"
```

> **Note:** Requires a valid Chapa test key. If you get "Invalid API Key", refresh your key at https://test.chapa.co

**18. Verify Payment**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/chapa/verify/YOUR_TX_REF
```

### Other Endpoints

**19. Gallery List**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/gallery
```

**20. Gallery Usage (Admin)**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/gallery/usage -H "Authorization: Bearer %TOKEN%"
```

**21. Cloudinary Config**
```powershell
curl http://localhost/Biniyam_PHP/api/v1/cloudinary/config
```

---

## Connecting React Frontend to PHP API

### Frontend (http://localhost:5173)

1. Edit `frontend/src/constants.ts`:
   ```typescript
   export const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'
   ```

2. Edit `frontend/src/utils/CloudinaryUploadWidget.tsx` (line 44):
   ```typescript
   const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'
   ```

3. Start the frontend:
   ```powershell
   cd C:\Users\damte\OneDrive\Desktop\b_beauty_academy\frontend
   npm run dev
   ```

4. Open `http://localhost:5173`

### Admin (http://localhost:5174)

1. Edit `admin/src/utils/api.ts` (line 1):
   ```typescript
   const API_BASE = 'http://localhost/Biniyam_PHP/api/v1'
   ```

2. Start the admin:
   ```powershell
   cd C:\Users\damte\OneDrive\Desktop\b_beauty_academy\admin
   npm run dev
   ```

3. Open `http://localhost:5174/login`
   - Email: `admin@example.com`
   - Password: `StrongPassword123`

---

## Response Format

All API responses use **camelCase** keys (automatically converted from MySQL's snake_case):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Braid",
    "fullDescription": "Learn box braids...",
    "price": 18000,
    "allowsHalfPayment": true,
    "isActive": true,
    "createdAt": "2026-08-30 20:06:36"
  }
}
```

---

## Half Payment Rules

| Scenario | Allowed? |
|----------|----------|
| All programs support half payment | ✅ Yes |
| Any program does NOT support half payment | ❌ Full only |
| Mixed: some allow half, some don't | ❌ Full only |
| Remaining balance after half payment | Admin records via `PATCH /registrations/:id/payment` |

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `404 Not Found` | Wrong URL path | Use `http://localhost/Biniyam_PHP/api/v1/...` |
| `Route not found` | `.htaccess` not loaded | Ensure Apache `AllowOverride All` is set |
| `Undefined constant VALID_SCHEDULES` | File scope issue | Already fixed — use latest code |
| `HTML entities in titles` (&#039;) | `htmlspecialchars()` in sanitizeString | Already fixed — use latest code |
| `Invalid API Key` (Chapa) | Expired test key | Get fresh key at https://test.chapa.co |
| `Session expired due to password change` | Old token after password change | Login again with new password to get fresh token |
| CORS errors | Origin not in allowed list | Update `index.php` CORS origins |
| `could not find driver` | Missing PHP extension | XAMPP includes all needed — check phpinfo.php |
| `Access denied for user 'root'` | MySQL password mismatch | Update `DB_PASS` in `.env` |

---

## Database Reset

To start fresh:

```sql
-- In phpMyAdmin or MySQL CLI:
DROP DATABASE beauty_academy;
```

Then re-run `php setup.php`.

---

## Quick Test Script

Save as `test_all.ps1` (PowerShell):

```powershell
$BASE = "http://localhost/Biniyam_PHP/api/v1"

Write-Host "=== 1. Health Check ===" -ForegroundColor Green
curl "$BASE/"
Write-Host ""

Write-Host "=== 2. Login ===" -ForegroundColor Green
$login = curl -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"StrongPassword123"}'
Write-Host $login
Write-Host ""

Write-Host "=== 3. Programs ===" -ForegroundColor Green
curl "$BASE/programs"
Write-Host ""

Write-Host "=== 4. Gallery ===" -ForegroundColor Green
curl "$BASE/gallery"
Write-Host ""

Write-Host "=== 5. Cloudinary Config ===" -ForegroundColor Green
curl "$BASE/cloudinary/config"
Write-Host ""

Write-Host "=== ALL TESTS COMPLETE ===" -ForegroundColor Green
```

Run with:
```powershell
cd C:\xampp\htdocs\Biniyam_PHP
powershell -File test_all.ps1
```
