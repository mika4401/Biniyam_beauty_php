# 📄 Documentation: `setup.php` — One-Time Setup Script

## What Does This File Do?

`setup.php` is a script you run **once** when you first set up the project. It:
1. Checks that PHP has all the right extensions
2. Creates the MySQL database
3. Creates all the database tables
4. Creates the default admin user (admin@example.com)

**Run it like this:** `php setup.php`

---

## Line-by-Line Explanation

### Part 1: Loading .env (Lines 1-15)

```php
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // ... same pattern as index.php ...
        putenv(trim($key) . '=' . trim($value));
    }
}
```

**What's happening:** Same as `index.php` — load the secret settings from `.env` so we know the database host, name, user, and password.

---

### Part 2: Check PHP Version (Lines 17-18)

```php
$phpVersion = PHP_VERSION;
echo "✓ PHP Version: $phpVersion\n";
```

**What's happening:** Display the PHP version. We need PHP 8.0 or newer.

---

### Part 3: Check Required Extensions (Lines 20-26)

```php
$required = ['pdo_mysql', 'curl', 'json', 'mbstring', 'openssl'];
foreach ($required as $ext) {
    if (extension_loaded($ext)) {
        echo "✓ Extension: $ext\n";
    } else {
        echo "✗ MISSING: $ext — enable it in php.ini\n";
    }
}
```

**What's happening:**
- We need these PHP extensions to run:
  - `pdo_mysql` — connects to MySQL database
  - `curl` — makes HTTP requests (to Chapa API)
  - `json` — encodes/decodes JSON data
  - `mbstring` — handles multi-byte characters (like Amharic text)
  - `openssl` — encrypts/decrypts data (for JWT tokens)

- For each one, check if it's installed. If yes, show ✓. If no, show ✗ with instructions to enable it.

**Why?** If any extension is missing, the API won't work. It's like checking if you have all the ingredients before cooking.

---

### Part 4: Generate Admin Password Hash (Lines 28-32)

```php
$password = 'StrongPassword123';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
echo "Password: $password\n";
echo "Hash:     $hash\n";
echo "Verify:   " . (password_verify($password, $hash) ? '✓ Valid' : '✗ Invalid') . "\n";
```

**What's happening:**
- We never store plain text passwords! Instead, we store a **hash** — a scrambled version that can't be reversed.

- `password_hash()` takes "StrongPassword123" and turns it into something like `$2b$10$DYKNnlq41Tw4p3OOh1Qwjuug...` (a long random-looking string).

- `PASSWORD_BCRYPT` is the algorithm used (it's very secure).

- `cost => 10` means "how hard to compute" — higher is more secure but slower.

- `password_verify()` checks that the hash matches the original password.

**Why?** If someone steals the database, they see the hash but can't figure out the original password. It's like a one-way lock — you can lock it, but you can't unlock it to get the key back.

---

### Part 5: Connect to MySQL (Lines 34-43)

```php
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'beauty_academy';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$dbHost;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "✓ Connected to MySQL server\n";
```

**What's happening:**
- Read database settings from environment variables (or use defaults).
- Try to connect to MySQL using PDO (PHP's database tool).
- `charset=utf8mb4` means "support all Unicode characters including Emojis and Amharic."
- `ERRMODE_EXCEPTION` means "if something goes wrong, throw an error instead of silently failing."

---

### Part 6: Create Database and Tables (Lines 44-65)

```php
$pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo->exec("USE `$dbName`");

$schema = file_get_contents(__DIR__ . '/schema.sql');
$schema = preg_replace('/CREATE DATABASE.*?;/s', '', $schema);
$schema = preg_replace('/USE\s+\w+;/s', '', $schema);
$schema = preg_replace('/^\s*--.*$/m', '', $schema);

$statements = array_filter(array_map('trim', explode(';', $schema)));
$executed = 0;
foreach ($statements as $stmt) {
    if (empty($stmt)) continue;
    try {
        $pdo->exec($stmt);
        $executed++;
    } catch (PDOException $e) {
        if (str_contains($e->getMessage(), 'already exists')) continue;
        echo "  ⚠ Schema note: " . $e->getMessage() . "\n";
    }
}
echo "✓ Schema applied ($executed statements)\n";
```

**What's happening:**
- **Line 1**: Create the `beauty_academy` database if it doesn't exist yet.
- **Line 2**: Tell MySQL "use this database for the following commands."
- **Lines 4-7**: Read `schema.sql` and clean it up:
  - Remove the `CREATE DATABASE` and `USE` lines (we already did that)
  - Remove comment lines (lines starting with `--`)
- **Lines 9-17**: Split the SQL file by semicolons and execute each statement one by one.
  - If a table already exists, skip it (the "already exists" check).
  - If something else goes wrong, show a warning but don't stop.

---

### Part 7: Create Admin User (Lines 67-75)

```php
$check = $pdo->query("SELECT COUNT(*) as cnt FROM admins")->fetch();
if ($check['cnt'] == 0) {
    $stmt = $pdo->prepare("INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)");
    $stmt->execute(['Super Admin', 'admin@example.com', $hash, 'SUPER_ADMIN']);
    echo "✓ Admin user created: admin@example.com / $password\n";
} else {
    echo "ℹ Admin user(s) already exist — skipping creation\n";
}
```

**What's happening:**
- Check if any admin users already exist.
- If no admins exist (fresh install), create one with:
  - Name: "Super Admin"
  - Email: admin@example.com
  - Password: StrongPassword123 (stored as a hash)
  - Role: SUPER_ADMIN (can do everything)
- If admins already exist, skip this step.

---

## 🎯 Summary

| Step | What It Does | Why |
|------|-------------|-----|
| Check PHP version | Verify PHP is new enough | Old PHP has security issues |
| Check extensions | Verify all tools are installed | Missing extension = broken API |
| Generate password hash | Create secure password storage | Never store plain text passwords |
| Connect to MySQL | Talk to the database | Need a connection to create tables |
| Create database + tables | Set up the data structure | Tables are where we store everything |
| Create admin user | First admin can log in | Need at least one admin to manage the site |
