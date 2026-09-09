<?php
/**
 * Cloudinary routes:
 *   GET /config → getCloudinaryConfig (public)
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/cloudinary#', '', $API_URI) ?: '/';

if ($method === 'GET' && $subPath === '/config') {
    $config = require __DIR__ . '/../config/cloudinary.php';

    if (empty($config['cloud_name']) || empty($config['upload_preset'])) {
        successResponse([
            'configured' => false,
            'message'    => 'Cloudinary is not configured.',
        ]);
        return;
    }

    successResponse([
        'configured' => true,
        'data' => [
            'cloudName'     => $config['cloud_name'],
            'uploadPreset'  => $config['upload_preset'],
        ],
    ]);
} else {
    errorResponse('Route not found', 404);
}
