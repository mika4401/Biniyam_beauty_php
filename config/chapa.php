<?php
/**
 * Chapa payment gateway configuration.
 * Set these values in your .env or environment variables.
 */

return [
    'secret_key' => getenv('CHAPA_SECRET_KEY') ?: 'CHAPUBK_TEST-your-key-here',
    'api_base'   => 'https://api.chapa.co/v1',
    'sandbox'    => (getenv('CHAPA_SANDBOX') ?: 'true') === 'true',
];
