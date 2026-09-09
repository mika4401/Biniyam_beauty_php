<?php
/**
 * Router script for PHP built-in dev server.
 *
 * Usage:  php -S localhost:8080 router.php
 *
 * PHP's built-in server does NOT support .htaccess files (Apache-only).
 * This router forwards all non-static-file requests to index.php,
 * which handles API routing, CORS, and environment loading.
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Serve static files directly if they exist
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    // If the request is for a PHP file, let PHP handle it
    if (pathinfo($uri, PATHINFO_EXTENSION) === 'php') {
        return false; // Let PHP's built-in server handle it
    }
    // Serve other static files directly (CSS, JS, images, etc.)
    return false;
}

// Forward everything else to index.php (API router)
require __DIR__ . '/index.php';
