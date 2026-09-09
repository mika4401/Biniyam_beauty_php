<?php
/**
 * Input validation helpers.
 */

function sanitizeString(string $value): string {
    $value = trim($value);
    $value = stripslashes($value);
    // Note: We use prepared statements for SQL safety,
    // so htmlspecialchars is not needed for API JSON responses.
    return $value;
}

function validateEmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validatePhone(string $phone): bool {
    // Accept Ethiopian formats: +251..., 09..., 07...
    $cleaned = preg_replace('/\D/', '', $phone);
    return strlen($cleaned) >= 9 && strlen($cleaned) <= 15;
}

function validateRequired(array $data, array $fields): array {
    $errors = [];
    foreach ($fields as $field) {
        $value = $data[$field] ?? null;
        if ($value === null || $value === '' || (is_string($value) && trim($value) === '')) {
            $errors[] = "$field is required.";
        }
    }
    return $errors;
}
