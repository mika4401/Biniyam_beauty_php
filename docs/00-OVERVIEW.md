# 🏫 Biniyam Beauty Academy — PHP Backend Overview

## What Is This?

This is the **backend** (the brain) of the Biniyam Beauty Academy website. It's a PHP API that handles everything behind the scenes: admin login, course management, student registrations, and payments.

Think of it like a restaurant kitchen — customers (the frontend website) place orders (API requests), and this backend cooks them up and sends back the food (JSON responses).

---

## 📁 File Structure

```
Biniyam_PHP/
├── index.php              ← 🚪 Front door — every request enters here
├── router.php             ← 🛣️ Helps PHP's dev server find the front door
├── setup.php              ← 🔧 One-time setup (creates database + admin user)
├── schema.sql             ← 📋 Blueprint for all database tables
├── .env                   ← 🔑 Secret passwords and API keys (never share!)
├── .htaccess              ← 🔄 URL rewriting rules for Apache
│
├── api/                   ← 🎯 All API route handlers (one file per feature)
│   ├── auth.php           ← 🔐 Admin login, logout, password change
│   ├── admin.php          ← 👤 Admin profile, create new admins
│   ├── programs.php       ← 📚 Course management (add, edit, delete courses)
│   ├── students.php       ← 🎓 Student records
│   ├── registrations.php  ← 📝 Student enrollment into courses (biggest file!)
│   ├── payments.php       ← 💰 Payment records
│   ├── chapa.php          ← 💳 Chapa payment gateway integration
│   ├── gallery.php        ← 🖼️ Photo gallery management
│   └── cloudinary.php     ← ☁️ Cloudinary image upload config
│
├── config/                ← ⚙️ Configuration settings
│   ├── database.php       ← 🗄️ Database connection (MySQL)
│   ├── jwt.php            ← 🔑 JWT token settings (secret, expiry times)
│   ├── chapa.php          ← 💳 Chapa API key settings
│   └── cloudinary.php     ← ☁️ Cloudinary account settings
│
├── helpers/               ← 🧰 Utility tools (used by all files)
│   ├── response.php       ← 📤 Send JSON responses back to the frontend
│   ├── jwt.php            ← 🎫 Create and verify JWT tokens
│   └── validation.php     ← ✅ Check if inputs are valid (email, phone, etc.)
│
├── middleware/             ← 🛡️ Security guards
│   └── AuthMiddleware.php ← 🔒 Check if admin is logged in
│
└── docs/                  ← 📖 This documentation!
```

---

## 🔄 How a Request Flows (Step by Step)

Here's what happens when someone (like the admin) makes a request:

```
1. Browser/App sends a request
   e.g. GET http://localhost/Biniyam_PHP/api/v1/programs
                    ↓
2. Apache/Nginx routes it to index.php (via .htaccess)
                    ↓
3. index.php loads the .env file (secret keys)
                    ↓
4. index.php sets CORS headers (allows frontend to talk to backend)
                    ↓
5. index.php loads all helper files (response, JWT, validation, etc.)
                    ↓
6. index.php looks at the URL: "programs" is the first word
                    ↓
7. index.php uses a switch statement:
   case 'programs': require __DIR__ . '/api/programs.php';
                    ↓
8. programs.php receives the request and decides what to do:
   - GET /programs → list all courses
   - POST /programs → create a new course
   - PUT /programs/123 → edit course #123
                    ↓
9. programs.php asks the database for data
                    ↓
10. programs.php sends back a JSON response
    {"success": true, "data": [...courses...]}
                    ↓
11. Frontend receives the data and displays it on screen
```

---

## 🗄️ Database Tables

The MySQL database (`beauty_academy`) has these tables:

| Table | What It Stores | Example |
|-------|---------------|---------|
| `admins` | Admin user accounts | email, password, role |
| `programs` | Courses offered | title, price, duration, image |
| `students` | Student information | name, email, phone, national ID |
| `registrations` | Links students to courses | which course, which schedule, payment status |
| `registration_programs` | Many-to-many link | "Student 5 enrolled in Course 3" |
| `payments` | Payment records | amount, method (Card/Cash), Chapa reference |
| `gallery_items` | Gallery photos | image URL, caption, category |

### How They Connect:

```
admins ──────────────┐
                     │ (created_by)
programs ◄───────────┤
     │               │
     │ (program_id)  │
     ▼               │
registration_programs │ (junction table)
     │               │
     │ (registration_id)
     ▼               │
registrations ◄──────┘ (student_id)
     │
     │ (registration_id)
     ▼
payments
```

---

## 🔐 Authentication Flow

1. **Admin logs in** → sends email + password to `POST /auth/login`
2. **Backend checks** → looks up admin in database, verifies bcrypt password hash
3. **Backend generates** → two JWT tokens:
   - **Access token** (expires in 15 minutes) — used for API requests
   - **Refresh token** (expires in 7 days) — used to get a new access token
4. **Frontend stores** → tokens in localStorage
5. **Every API request** → frontend sends `Authorization: Bearer <access_token>` header
6. **AuthMiddleware** → checks the token is valid, not expired, and admin is active
7. **If token expired** → frontend sends refresh token to `POST /auth/refresh` to get a new one

---

## 💳 Payment Flow (Chapa)

1. **Student registers** → `POST /registrations` creates a registration
2. **Frontend initializes payment** → `POST /chapa/initialize` with the registration ID
3. **Backend calls Chapa API** → sends student info, amount, and callback URL
4. **Chapa returns** → a checkout URL where the student pays
5. **Frontend opens** → the Chapa checkout page in a new browser tab
6. **Student pays** → enters their card/mobile money details on Chapa
7. **Chapa sends callback** → notifies our backend via `POST /chapa/callback`
8. **Backend verifies** → calls `GET /chapa/verify/:txRef` to confirm payment
9. **Backend updates** → marks payment as "Completed" and registration as "Paid"

---

## 🔑 Environment Variables (.env)

```
# Database
DB_HOST=localhost
DB_NAME=beauty_academy
DB_USER=root
DB_PASS=

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_ACCESS_EXPIRY=900
JWT_REFRESH_EXPIRY=604800

# Chapa (payment)
CHAPA_SECRET_KEY=CHAPUBK_TEST-xxxxx
CHAPA_SANDBOX=true

# Cloudinary (images)
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
CLOUDINARY_UPLOAD_PRESET=B_Beauty_Academy

# API URL
API_BASE_URL=http://localhost/Biniyam_PHP/api/v1
```

---

## 🚀 How to Run

```bash
# 1. Start XAMPP (Apache + MySQL)
# 2. Run setup (only once):
php setup.php

# 3. Open in browser:
http://localhost/Biniyam_PHP/api/v1/

# Or with PHP built-in server:
php -S localhost:8080 router.php
```

---

## 📚 Documentation Files

Each PHP file has its own detailed documentation:

| # | File | Documentation |
|---|------|---------------|
| 01 | `index.php` | [01-index-php.md](./01-index-php.md) |
| 02 | `router.php` | [02-router-php.md](./02-router-php.md) |
| 03 | `setup.php` | [03-setup-php.md](./03-setup-php.md) |
| 04 | `schema.sql` | [04-schema-sql.md](./04-schema-sql.md) |
| 05 | `config/database.php` | [05-config.md](./05-config.md) |
| 06 | `config/jwt.php` | [05-config.md](./05-config.md) |
| 07 | `config/chapa.php` | [05-config.md](./05-config.md) |
| 08 | `config/cloudinary.php` | [05-config.md](./05-config.md) |
| 09 | `helpers/response.php` | [06-helpers.md](./06-helpers.md) |
| 10 | `helpers/jwt.php` | [06-helpers.md](./06-helpers.md) |
| 11 | `helpers/validation.php` | [06-helpers.md](./06-helpers.md) |
| 12 | `middleware/AuthMiddleware.php` | [07-middleware.md](./07-middleware.md) |
| 13 | `api/auth.php` | [08-api-auth.md](./08-api-auth.md) |
| 14 | `api/admin.php` | [09-api-admin.md](./09-api-admin.md) |
| 15 | `api/programs.php` | [10-api-programs.md](./10-api-programs.md) |
| 16 | `api/students.php` | [11-api-students.md](./11-api-students.md) |
| 17 | `api/registrations.php` | [12-api-registrations.md](./12-api-registrations.md) |
| 18 | `api/payments.php` | [13-api-payments.md](./13-api-payments.md) |
| 19 | `api/chapa.php` | [14-api-chapa.md](./14-api-chapa.md) |
| 20 | `api/gallery.php` | [15-api-gallery.md](./15-api-gallery.md) |
| 21 | `api/cloudinary.php` | [16-api-cloudinary.md](./16-api-cloudinary.md) |
