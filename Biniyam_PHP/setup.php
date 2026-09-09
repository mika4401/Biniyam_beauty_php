<?php
/**
 * One-time setup script.
 * Run: php setup.php
 *
 * This script:
 * 1. Loads .env
 * 2. Creates the admin user with a proper bcrypt password
 * 3. Verifies the database connection
 */

// Load .env
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        putenv(trim($key) . '=' . trim($value));
    }
}

echo "╔══════════════════════════════════════════╗\n";
echo "║  Biniyam Beauty Academy — PHP Setup      ║\n";
echo "╚══════════════════════════════════════════╝\n\n";

// 1. Check PHP version
$phpVersion = PHP_VERSION;
echo "✓ PHP Version: $phpVersion\n";

// 2. Check required extensions
$required = ['pdo_mysql', 'curl', 'json', 'mbstring', 'openssl'];
foreach ($required as $ext) {
    if (extension_loaded($ext)) {
        echo "✓ Extension: $ext\n";
    } else {
        echo "✗ MISSING: $ext — enable it in php.ini\n";
    }
}

// 3. Generate bcrypt hash
$password = 'StrongPassword123';
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
echo "\n── Admin Password Hash ──\n";
echo "Password: $password\n";
echo "Hash:     $hash\n";
echo "Verify:   " . (password_verify($password, $hash) ? '✓ Valid' : '✗ Invalid') . "\n";

// 4. Try connecting to MySQL
echo "\n── MySQL Connection ──\n";
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbName = getenv('DB_NAME') ?: 'beauty_academy';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';

try {
    $pdo = new PDO("mysql:host=$dbHost;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "✓ Connected to MySQL server\n";

    // Create database if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbName`");
    echo "✓ Database `$dbName` ready\n";

    // Run schema
    $schema = file_get_contents(__DIR__ . '/schema.sql');
    // Remove the CREATE DATABASE and USE statements (already done)
    $schema = preg_replace('/CREATE DATABASE.*?;/s', '', $schema);
    $schema = preg_replace('/USE\s+\w+;/s', '', $schema);
    // Remove comment-only lines (lines starting with --)
    $schema = preg_replace('/^\s*--.*$/m', '', $schema);

    // Split by semicolons and execute each statement
    $statements = array_filter(array_map('trim', explode(';', $schema)));
    $executed = 0;
    foreach ($statements as $stmt) {
        if (empty($stmt)) continue;
        try {
            $pdo->exec($stmt);
            $executed++;
        } catch (PDOException $e) {
            // Skip duplicate table errors
            if (str_contains($e->getMessage(), 'already exists')) continue;
            echo "  ⚠ Schema note: " . $e->getMessage() . "\n";
        }
    }
    echo "✓ Schema applied ($executed statements)\n";

    // Create admin user
    $check = $pdo->query("SELECT COUNT(*) as cnt FROM admins")->fetch();
    if ($check['cnt'] == 0) {
        $stmt = $pdo->prepare("INSERT INTO admins (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)");
        $stmt->execute(['Super Admin', 'admin@example.com', $hash, 'SUPER_ADMIN']);
        echo "✓ Admin user created: admin@example.com / $password\n";
    } else {
        echo "ℹ Admin user(s) already exist — skipping creation\n";
    }

    // Verify admin exists
    $admin = $pdo->query("SELECT id, full_name, email, role FROM admins LIMIT 1")->fetch();
    if ($admin) {
        echo "✓ Admin verified: {$admin['full_name']} ({$admin['email']}) [{$admin['role']}]\n";
    }

} catch (PDOException $e) {
    echo "✗ MySQL connection failed: " . $e->getMessage() . "\n";
    echo "  Make sure MySQL is running and credentials in .env are correct.\n";
}

echo "\n── Done ──\n";
echo "Run the dev server:  php -S localhost:8080\n";
echo "Test the API:       curl http://localhost:8080/api/v1/\n";
