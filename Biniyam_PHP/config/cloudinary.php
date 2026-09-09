<?php
/**
 * Cloudinary configuration.
 * Set these values in your .env or environment variables.
 */

return [
    'cloud_name'     => getenv('CLOUDINARY_CLOUD_NAME') ?: '',
    'api_key'        => getenv('CLOUDINARY_API_KEY') ?: '',
    'api_secret'     => getenv('CLOUDINARY_API_SECRET') ?: '',
    'upload_preset'  => getenv('CLOUDINARY_UPLOAD_PRESET') ?: '',
];
