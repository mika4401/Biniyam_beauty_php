<?php
/**
 * Gallery routes:
 *   GET  /         → listGalleryItems (public)
 *   GET  /usage    → getGalleryUsage (admin)
 *   POST /         → createGalleryItem (admin)
 *   DELETE /:id    → deleteGalleryItem (admin)
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/gallery#', '', $API_URI) ?: '/';

$segments = array_values(array_filter(explode('/', $subPath)));
$seg0 = $segments[0] ?? '';

switch (true) {
    case ($method === 'GET' && $seg0 === 'usage'):
        galleryUsage();
        break;
    case ($method === 'GET' && $seg0 === ''):
        galleryList();
        break;
    case ($method === 'POST' && $seg0 === ''):
        galleryCreate();
        break;
    case ($method === 'DELETE' && $seg0 !== ''):
        galleryDelete($seg0);
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function galleryList(): void {
    $db   = Database::getConnection();
    $stmt = $db->query("SELECT * FROM gallery_items ORDER BY created_at DESC");
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
    }

    successResponse(['data' => $items]);
}

function galleryUsage(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    // Cloudinary usage check — only if configured
    $config = require __DIR__ . '/../config/cloudinary.php';

    if (empty($config['api_key']) || empty($config['api_secret'])) {
        successResponse([
            'data' => [
                'plan'          => 'Unknown',
                'usedPercent'   => 0,
                'creditsUsed'   => 0,
                'creditsLimit'  => 0,
                'storageBytes'  => 0,
                'atLimit'       => false,
            ],
        ]);
        return;
    }

    // Call Cloudinary usage API
    $timestamp = time();
    $signature = sha1("usage_at={$timestamp}#{$config['api_key']}#{$config['api_secret']}");
    $url = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/usage?usage_at={$timestamp}&signature={$signature}&api_key={$config['api_key']}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    $credits = $response['credits'] ?? [];
    $usedPercent = $credits['used_percent'] ?? 0;

    successResponse([
        'data' => [
            'plan'          => $response['plan'] ?? 'Unknown',
            'usedPercent'   => (float)$usedPercent,
            'creditsUsed'   => (int)($credits['usage'] ?? 0),
            'creditsLimit'  => (int)($credits['limit'] ?? 0),
            'storageBytes'  => (int)($response['storage']['usage'] ?? 0),
            'atLimit'       => $usedPercent >= 90,
        ],
    ]);
}

function galleryCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $imageData = $body['imageData'] ?? '';
    $caption   = $body['caption'] ?? '';
    $category  = $body['category'] ?? '';

    if (!$imageData) {
        errorResponse('Image is required');
        return;
    }
    if (!$caption) {
        errorResponse('Caption is required');
        return;
    }
    if (!$category) {
        errorResponse('Category is required');
        return;
    }

    // Validate image format
    if (!preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#', $imageData)) {
        errorResponse('Image must be a valid PNG, JPEG, WEBP, or GIF file');
        return;
    }

    $config = require __DIR__ . '/../config/cloudinary.php';
    if (empty($config['cloud_name']) || empty($config['api_key']) || empty($config['api_secret'])) {
        errorResponse('Cloudinary is not configured.');
        return;
    }

    // Upload to Cloudinary
    $uploadUrl = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/image/upload";
    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => [
            'file'            => $imageData,
            'upload_preset'   => $config['upload_preset'],
            'folder'          => 'beauty-academy/gallery',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
    ]);

    $result = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (empty($result['secure_url'])) {
        errorResponse('Failed to upload image to Cloudinary');
        return;
    }

    $db = Database::getConnection();
    $db->prepare("
        INSERT INTO gallery_items (image_url, public_id, caption, category, created_by)
        VALUES (?, ?, ?, ?, ?)
    ")->execute([
        $result['secure_url'],
        $result['public_id'],
        sanitizeString($caption),
        sanitizeString($category),
        $admin['adminId'],
    ]);

    $newId = $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM gallery_items WHERE id = ?");
    $stmt->execute([$newId]);
    $item = $stmt->fetch();
    $item['id'] = (int)$item['id'];

    successResponse(['data' => $item], 201);
}

function galleryDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM gallery_items WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item) {
        errorResponse('Gallery item not found', 404);
        return;
    }

    // Delete from Cloudinary
    $config = require __DIR__ . '/../config/cloudinary.php';
    if (!empty($config['api_key']) && !empty($config['api_secret'])) {
        $timestamp = time();
        $signature = sha1("public_id={$item['public_id']}#timestamp={$timestamp}#{$config['api_secret']}");
        $deleteUrl = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/image/destroy";

        $ch = curl_init($deleteUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                'public_id'  => $item['public_id'],
                'timestamp'  => $timestamp,
                'api_key'    => $config['api_key'],
                'signature'  => $signature,
            ],
            CURLOPT_RETURNTRANSFER => true,
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    $db->prepare("DELETE FROM gallery_items WHERE id = ?")->execute([$id]);
    successResponse(['message' => 'Gallery item deleted successfully']);
}
