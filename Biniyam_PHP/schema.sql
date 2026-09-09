-- =====================================================
-- Biniyam Beauty Academy — MySQL Schema
-- Database: beauty_academy
-- =====================================================

CREATE DATABASE IF NOT EXISTS beauty_academy
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE beauty_academy;

-- ──────────────────────────────────────────────────
-- 1. ADMINS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 2. PROGRAMS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 3. STUDENTS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 4. REGISTRATIONS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 5. REGISTRATION_PROGRAMS (Many-to-Many)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registration_programs (
    registration_id         INT NOT NULL,
    program_id              INT NOT NULL,
    PRIMARY KEY (registration_id, program_id),
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (program_id)      REFERENCES programs(id)     ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 6. PAYMENTS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 7. GALLERY_ITEMS
-- ──────────────────────────────────────────────────
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
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────
-- 8. Seed Data — Default Admin
-- Password: StrongPassword123 (bcrypt cost=10)
-- ──────────────────────────────────────────────────
INSERT INTO admins (full_name, email, password_hash, role) VALUES
('Super Admin', 'admin@example.com', '$2b$10$DYKNnlq41Tw4p3OOh1QwjuugXxSS3QYwTlYt8hDB1ZEt780PgPkyu', 'SUPER_ADMIN')
ON DUPLICATE KEY UPDATE email = email;
