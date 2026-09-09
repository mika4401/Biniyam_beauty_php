<?php
/**
 * Biniyam Beauty Academy — PHP API Entry Point.
 *
 * All requests (except static files) are routed through this file.
 * Uses a simple switch/case router — no framework required.
 */

// ─── Load environment variables ──────────────────────────────
// Simple .env loader (no vlucas/phpdotenv needed)
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key]     = $value;
            putenv("$key=$value");
        }
    }
}

// ─── CORS Headers ────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
// Allow only known origins — production domains + localhost for local development
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOriginPatterns = [
    // Production (Ethio Telecom hosting)
    '#^https://biniyambeautytraining\.com\.et$#',
    '#^https://www\.biniyambeautytraining\.com\.et$#',
    '#^https://admin\.biniyambeautytraining\.com\.et$#',
    // Local development (Vite dev servers)
    '#^https?://(localhost|127\.0\.0\.1|\[::1\]):(5173|5174)$#',
];
foreach ($allowedOriginPatterns as $pattern) {
    if (preg_match($pattern, $origin)) {
        header("Access-Control-Allow-Origin: $origin");
        break;
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, Pragma');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── Load core helpers ───────────────────────────────────────
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/jwt.php';
require_once __DIR__ . '/helpers/validation.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/AuthMiddleware.php';

// ─── Parse the request URI ───────────────────────────────────
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// ─── Handle both /api/v1/* routes and direct access ──────
// When accessed via .htaccess, URI may not have /api/v1 prefix.
if (preg_match('#^.*/api/v1(.*)$#', $uri, $m)) {
    // API route: /Biniyam_PHP/api/v1/programs → /programs
    $uri = $m[1];
} else {
    // Direct access: /Biniyam_PHP/ → root, /Biniyam_PHP/programs → skip
    $uri = preg_replace('#^/[^/]+/?#', '/', $uri);
}
$uri = rtrim($uri, '/') ?: '/';

// Extract the resource (first segment)
$parts    = explode('/', ltrim($uri, '/'));
$resource = $parts[0] ?? '';

// Make the stripped URI available to API route files
// e.g. $API_URI = '/programs/123' (already stripped of /Biniyam_PHP/api/v1 prefix)
$API_URI = $uri;

// ─── Route the request ───────────────────────────────────────
switch ($resource) {
    case '':
        // Root — health check
        successResponse([
            'message' => 'Biniyam Beauty Academy API is running',
            'status'  => 'ok',
            'version' => '1.0.0-php',
        ]);
        break;

    case 'auth':
        require __DIR__ . '/api/auth.php';
        break;

    case 'admin':
        require __DIR__ . '/api/admin.php';
        break;

    case 'programs':
        require __DIR__ . '/api/programs.php';
        break;

    case 'students':
        require __DIR__ . '/api/students.php';
        break;

    case 'registrations':
        require __DIR__ . '/api/registrations.php';
        break;

    case 'payments':
        require __DIR__ . '/api/payments.php';
        break;

    case 'chapa':
        require __DIR__ . '/api/chapa.php';
        break;

    case 'cloudinary':
        require __DIR__ . '/api/cloudinary.php';
        break;

    case 'gallery':
        require __DIR__ . '/api/gallery.php';
        break;

    default:
        errorResponse('Route not found', 404);
        break;
}
