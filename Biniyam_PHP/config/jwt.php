<?php
/**
 * JWT configuration.
 * Set JWT_SECRET in your .env to a strong random string.
 */

return [
    'secret'          => getenv('JWT_SECRET') ?: 'change-me-to-a-strong-random-string',
    'access_expiry'   => 900,       // 15 minutes
    'refresh_expiry'  => 604800,    // 7 days
];
