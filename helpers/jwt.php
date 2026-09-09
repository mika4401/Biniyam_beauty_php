<?php
/**
 * Pure-PHP JWT implementation (HS256).
 * No external library required.
 */

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

/**
 * Encode a JWT token.
 * @param array  $payload  Claims to include.
 * @param string $secret   HMAC signing key.
 * @param int    $expiry   Seconds until expiry.
 */
function jwt_encode(array $payload, string $secret, int $expiry): string {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));

    $now        = time();
    $payload['iat'] = $now;
    $payload['exp'] = $now + $expiry;

    $payloadB64 = base64url_encode(json_encode($payload));
    $signingInput = "$header.$payloadB64";
    $signature    = base64url_encode(
        hash_hmac('sha256', $signingInput, $secret, true)
    );

    return "$signingInput.$signature";
}

/**
 * Decode and verify a JWT token.
 * @return array|null  The decoded payload, or null on failure.
 */
function jwt_decode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$headerB64, $payloadB64, $signatureB64] = $parts;

    // Verify signature
    $expectedSig = base64url_encode(
        hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true)
    );
    if (!hash_equals($expectedSig, $signatureB64)) {
        return null;
    }

    $data = json_decode(base64url_decode($payloadB64), true);
    if (!is_array($data) || !isset($data['exp'])) {
        return null;
    }

    // Check expiry
    if ($data['exp'] < time()) {
        return null;
    }

    return $data;
}
