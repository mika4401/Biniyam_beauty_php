# 📄 Documentation: `schema.sql` — Database Blueprint

## What Does This File Do?

`schema.sql` is the **blueprint** for the entire database. It defines every table, every column, every relationship. Think of it like an architect's drawing of a house — before you build, you need a plan.

---

## Table-by-Table Explanation

### 1. ADMINS Table (Who Can Log In?)

```sql
CREATE TABLE IF NOT EXISTS admins (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    full_name               VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL,
    role                    ENUM('SUPER_ADMIN','ADMIN','CONTENT_MANAGER','FINANCE_MANAGER') DEFAULT 'ADMIN',
    is_active               TINYINT(1) DEFAULT 1,
    failed_login_attempts   INT DEFAULT 0,
    locked_until            DATETIME NULL,
    password_changed_at     DATETIME NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);
```

**Column by column:**

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique number for each admin (auto-generates) | 1, 2, 3... |
| `full_name` | VARCHAR(255) | Admin's full name | "Super Admin" |
| `email` | VARCHAR(255) | Login email (must be unique) | "admin@example.com" |
| `password_hash` | VARCHAR(255) | Scrambled password (never plain text!) | "$2b$10$DYKNn..." |
| `role` | ENUM | What the admin can do | SUPER_ADMIN, ADMIN, etc. |
| `is_active` | TINYINT(1) | Is this admin active? 1=yes, 0=no | 1 |
| `failed_login_attempts` | INT | How many wrong password attempts | 0, 1, 2, 3... |
| `locked_until` | DATETIME | When the lock expires (after 5 wrong tries) | NULL or "2026-08-31 15:00:00" |
| `password_changed_at` | DATETIME | When password was last changed | NULL or "2026-08-31 10:00:00" |
| `created_at` | TIMESTAMP | When this admin was created | Auto-set on creation |
| `updated_at` | TIMESTAMP | When this admin was last updated | Auto-updates |

**Key features:**
- `UNIQUE` on email means no two admins can have the same email.
- `failed_login_attempts` + `locked_until` = **brute force protection**. After 5 wrong passwords, the account is locked for 15 minutes.
- `password_changed_at` is used to invalidate old tokens when a password is changed.

---

### 2. PROGRAMS Table (Courses Offered)

```sql
CREATE TABLE IF NOT EXISTS programs (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    title                   VARCHAR(255) NOT NULL,
    slug                    VARCHAR(255) NOT NULL UNIQUE,
    description             TEXT NOT NULL,
    full_description        TEXT NOT NULL,
    price                   INT NOT NULL COMMENT 'Price in ETB',
    duration                VARCHAR(50) NOT NULL,
    image                   VARCHAR(500) DEFAULT '',
    discount                VARCHAR(100) NULL,
    included                JSON DEFAULT NULL,
    title_am                VARCHAR(255) NULL,
    description_am          TEXT NULL,
    full_description_am     TEXT NULL,
    duration_am             VARCHAR(50) NULL,
    included_am             JSON DEFAULT NULL,
    allows_half_payment     TINYINT(1) DEFAULT 0,
    is_active               TINYINT(1) DEFAULT 1,
    created_by              INT NOT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_active (is_active, created_at),
    FULLTEXT INDEX idx_search (title, description),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
);
```

**Column by column:**

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique course number | 1, 2, 3... |
| `title` | VARCHAR(255) | Course name (English) | "Professional Makeup Artistry" |
| `slug` | VARCHAR(255) | URL-friendly version of title (unique) | "professional-makeup-artistry" |
| `description` | TEXT | Short description | "Master professional makeup..." |
| `full_description` | TEXT | Long detailed description | "This intensive 8-week course..." |
| `price` | INT | Price in Ethiopian Birr (ETB) | 15000 |
| `duration` | VARCHAR(50) | How long the course is | "8 weeks" |
| `image` | VARCHAR(500) | Photo URL | "https://images.unsplash.com/..." |
| `discount` | VARCHAR(100) | Discount info (if any) | "10% off" or NULL |
| `included` | JSON | What's included (as JSON array) | ["Kit", "Certificate"] |
| `title_am` | VARCHAR(255) | Course name (Amharic) | "ፕሮ페ሽናል ማክאפ አርቲስትሪ" |
| `description_am` | TEXT | Short description (Amharic) | Amharic text |
| `full_description_am` | TEXT | Long description (Amharic) | Amharic text |
| `duration_am` | VARCHAR(50) | Duration (Amharic) | "8 ሳምንታት" |
| `included_am` | JSON | Included items (Amharic) | ["ኪት", "ሰርቲፊኬት"] |
| `allows_half_payment` | TINYINT(1) | Can students pay half? 1=yes | 1 (for Braid, Women's Hair, etc.) |
| `is_active` | TINYINT(1) | Is this course visible? 1=yes | 1 |
| `created_by` | INT | Which admin created it (links to admins.id) | 1 |

**Key features:**
- `slug` is the URL-friendly version: "Professional Makeup Artistry" → "professional-makeup-artistry"
- `FULLTEXT INDEX` enables fast text searching (searching by title or description)
- `FOREIGN KEY (created_by) REFERENCES admins(id)` means "this must be a valid admin ID"
- `ON DELETE CASCADE` means "if the admin is deleted, delete their courses too"

---

### 3. STUDENTS Table (Student Information)

```sql
CREATE TABLE IF NOT EXISTS students (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    phone                   VARCHAR(20) NOT NULL,
    national_id_image       VARCHAR(500) NULL,
    education_level         ENUM('Grade 6','Grade 8','Grade 10','Grade 12','Diploma','Degree','Masters','PhD') NULL,
    field_of_study          VARCHAR(255) NULL,
    address                 VARCHAR(500) NULL,
    date_of_birth           DATE NULL,
    notes                   TEXT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_name (last_name, first_name)
);
```

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique student number | 1, 2, 3... |
| `first_name` | VARCHAR(100) | First name | "Abebe" |
| `last_name` | VARCHAR(100) | Last name | "Kebede" |
| `email` | VARCHAR(255) | Email (unique — one per student) | "abebe@gmail.com" |
| `phone` | VARCHAR(20) | Phone number | "0944010239" |
| `national_id_image` | VARCHAR(500) | Photo of their ID card (Cloudinary URL) | "https://res.cloudinary.com/..." |
| `education_level` | ENUM | Highest education completed | "Degree", "Grade 12", etc. |
| `field_of_study` | VARCHAR(255) | What they studied (for Degree+) | "Computer Science" |
| `address` | VARCHAR(500) | Where they live | "Addis Ababa" |
| `date_of_birth` | DATE | Birthday | "2000-05-15" |
| `notes` | TEXT | Any extra notes | "Prefers morning classes" |

---

### 4. REGISTRATIONS Table (Student Enrollments)

```sql
CREATE TABLE IF NOT EXISTS registrations (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    student_id              INT NOT NULL,
    schedule                ENUM('weekday-morning','weekday-afternoon','weekday-midday','weekday-full','weekend') NOT NULL,
    status                  ENUM('Pending','Confirmed','Paid','Cancelled') DEFAULT 'Pending',
    payment_type            ENUM('Full','Half') NULL,
    notes                   TEXT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student (student_id),
    INDEX idx_status (status, created_at),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
```

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique registration number | 1, 2, 3... |
| `student_id` | INT | Which student (links to students.id) | 5 |
| `schedule` | ENUM | When they attend class | "weekend", "weekday-morning" |
| `status` | ENUM | Payment status | "Pending", "Paid", "Cancelled" |
| `payment_type` | ENUM | How they're paying | "Full" or "Half" |

---

### 5. REGISTRATION_PROGRAMS Table (Many-to-Many Link)

```sql
CREATE TABLE IF NOT EXISTS registration_programs (
    registration_id         INT NOT NULL,
    program_id              INT NOT NULL,
    PRIMARY KEY (registration_id, program_id),
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id)      REFERENCES programs(id)     ON DELETE CASCADE
);
```

**What's this?** A student can register for multiple courses, and a course can have multiple students. This "junction table" links them together.

Example data:
| registration_id | program_id | Meaning |
|----------------|-----------|---------|
| 1 | 3 | Registration #1 is for course #3 (Braid) |
| 1 | 5 | Registration #1 is also for course #5 (Men's Hair) |
| 2 | 4 | Registration #2 is for course #4 (Women's Hair) |

---

### 6. PAYMENTS Table (Money Records)

```sql
CREATE TABLE IF NOT EXISTS payments (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    registration_id         INT NOT NULL,
    amount                  INT NOT NULL COMMENT 'Amount in ETB',
    currency                VARCHAR(10) DEFAULT 'ETB',
    method                  ENUM('Cash','Bank Transfer','Mobile Money','Card') NOT NULL,
    status                  ENUM('Pending','Completed','Refunded','Failed') DEFAULT 'Pending',
    payment_type            ENUM('Full','Half') NULL,
    transaction_reference   VARCHAR(255) NULL,
    chapa_reference         VARCHAR(255) NULL,
    chapa_checkout_url      VARCHAR(500) NULL,
    paid_at                 DATETIME NULL,
    notes                   TEXT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_registration (registration_id),
    INDEX idx_status (status, paid_at),
    INDEX idx_tx_ref (transaction_reference),
    INDEX idx_chapa_ref (chapa_reference),
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);
```

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique payment number | 1, 2, 3... |
| `registration_id` | INT | Which registration (links to registrations.id) | 5 |
| `amount` | INT | How much was paid (ETB) | 27000 |
| `currency` | VARCHAR(10) | Currency code | "ETB" |
| `method` | ENUM | How they paid | "Card", "Cash", "Mobile Money" |
| `status` | ENUM | Payment status | "Pending", "Completed", "Failed" |
| `payment_type` | ENUM | Full or half payment | "Full" |
| `transaction_reference` | VARCHAR(255) | Our unique reference (tx_ref) | "beauty-abc123-def456" |
| `chapa_reference` | VARCHAR(255) | Chapa's reference number | "APiwh9srKdIho" |
| `chapa_checkout_url` | VARCHAR(500) | The Chapa payment page URL | "https://checkout.chapa.co/..." |
| `paid_at` | DATETIME | When the payment was completed | "2026-08-31 15:00:00" |
| `notes` | TEXT | Extra notes | "Cash payment recorded by admin" |

---

### 7. GALLERY_ITEMS Table (Photos)

```sql
CREATE TABLE IF NOT EXISTS gallery_items (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    image_url               VARCHAR(500) NOT NULL,
    public_id               VARCHAR(255) NOT NULL,
    caption                 VARCHAR(500) NOT NULL,
    category                VARCHAR(100) NOT NULL,
    created_by              INT NOT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created (created_at),
    FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE
);
```

| Column | Type | What It Stores | Example |
|--------|------|---------------|---------|
| `id` | INT | Unique gallery item number | 1, 2, 3... |
| `image_url` | VARCHAR(500) | Cloudinary image URL | "https://res.cloudinary.com/..." |
| `public_id` | VARCHAR(255) | Cloudinary's internal ID (for deletion) | "beauty-academy/gallery/xyz" |
| `caption` | VARCHAR(500) | Description of the photo | "Students in class" |
| `category` | VARCHAR(100) | Photo category | "Classroom", "Graduation", etc. |
| `created_by` | INT | Which admin uploaded it | 1 |

---

## 🔗 How Tables Connect (Relationships)

```
admins (1) ──── (Many) programs          [created_by]
admins (1) ──── (Many) gallery_items     [created_by]
students (1) ──── (Many) registrations   [student_id]
registrations (Many) ◄──── (Many) programs   [through registration_programs]
registrations (1) ──── (Many) payments    [registration_id]
```

**Translation:**
- One admin can create many courses
- One student can have many registrations
- One registration can include many courses (and vice versa)
- One registration can have many payments (e.g., half now, half later)

---

## 🎯 Summary

This file creates the entire data structure. Every piece of information the website needs is stored in one of these 7 tables:
1. **admins** — Who can log in and manage the site
2. **programs** — What courses are offered
3. **students** — Who the students are
4. **registrations** — Which student signed up for which course
5. **registration_programs** — Links students to courses (many-to-many)
6. **payments** — Money records (Chapa or cash)
7. **gallery_items** — Photos for the gallery page
