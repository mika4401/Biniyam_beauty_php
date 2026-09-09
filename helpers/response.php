<?php
/**
 * JSON response helpers — consistent API responses.
 */

function jsonResponse(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function successResponse(array $data, int $code = 200): void {
    // Automatically convert snake_case keys (from MySQL) to camelCase (for TypeScript)
    $converted = toCamelCaseKeys($data);
    // Add _id string alias wherever 'id' exists — admin frontend expects MongoDB-style _id
    $converted = addIdAliases($converted);
    jsonResponse($code, array_merge(['success' => true], $converted));
}

function errorResponse(string $message, int $code = 400): void {
    jsonResponse($code, ['success' => false, 'message' => $message]);
}

function getJsonBody(): array {
    $body = file_get_contents('php://input');
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : [];
}

function getAuthToken(): ?string {
    $headers = getallheaders();
    // Try both casing conventions
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) {
        return $m[1];
    }
    return null;
}

function getQueryParams(): array {
    return $_GET;
}

function snakeToCamel(string $str): string {
    return lcfirst(str_replace('_', '', ucwords($str, '_')));
}

/**
 * Recursively convert all array keys from snake_case to camelCase.
 * Used to transform MySQL column names to match the TypeScript interfaces.
 */
function toCamelCaseKeys(mixed $data): mixed {
    if (is_array($data)) {
        $result = [];
        foreach ($data as $key => $value) {
            $result[snakeToCamel($key)] = toCamelCaseKeys($value);
        }
        return $result;
    }
    return $data;
}

/**
 * Recursively add _id as a string alias of 'id' wherever 'id' exists.
 * The admin frontend was written for MongoDB (which uses _id), so every model
 * response needs both 'id' (number) and '_id' (string) to work.
 */
function addIdAliases(mixed $data): mixed {
    if (is_array($data)) {
        // Process child values first (bottom-up)
        $result = [];
        foreach ($data as $key => $value) {
            $result[$key] = addIdAliases($value);
        }
        // If this array has 'id', add '_id' as a string copy
        if (array_key_exists('id', $result) && !array_key_exists('_id', $result)) {
            $result['_id'] = (string)$result['id'];
        }
        return $result;
    }
    return $data;
}

/**
 * Apply proper type casting to a program row fetched from MySQL.
 * Decodes JSON columns, casts booleans, and ensures consistent types.
 */
function formatProgram(array $p): array {
    $p['id'] = (int)$p['id'];
    $p['price'] = (int)$p['price'];
    $p['is_active'] = (bool)$p['is_active'];
    $p['allows_half_payment'] = (bool)$p['allows_half_payment'];
    if (is_string($p['included'] ?? null)) {
        $p['included'] = json_decode($p['included'], true) ?? [];
    }
    if (is_string($p['included_am'] ?? null)) {
        $p['included_am'] = json_decode($p['included_am'], true);
    }
    return $p;
}

function getRouteId(string $uri, string $prefix): ?string {
    // Extract the :id segment from a URI like /registrations/123/payments
    $trimmed = rtrim($uri, '/');
    $parts   = explode('/', ltrim($trimmed, '/'));
    // After stripping prefix parts, the next segment is the id
    $prefixParts = explode('/', ltrim($prefix, '/'));
    $offset = count($prefixParts);
    return $parts[$offset] ?? null;
}

function getSubResource(string $uri, string $prefix): ?string {
    // Extract the sub-resource after :id, e.g. /registrations/123/payments → "payments"
    $trimmed = rtrim($uri, '/');
    $parts   = explode('/', ltrim($trimmed, '/'));
    $prefixParts = explode('/', ltrim($prefix, '/'));
    $offset = count($prefixParts) + 1; // +1 for the :id
    return $parts[$offset] ?? null;
}
