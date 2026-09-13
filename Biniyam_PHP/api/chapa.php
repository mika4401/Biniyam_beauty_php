<?php
/**
 * Chapa payment routes:
 *   POST /initialize   → initializePayment
 *   GET  /callback      → handleCallback
 *   POST /callback      → handleCallback
 *   POST /webhook       → handleWebhook
 *   GET  /verify/:txRef → verifyPaymentStatus
 */

$method = $_SERVER['REQUEST_METHOD'];
// $API_URI is already stripped of /Biniyam_PHP/api/v1 prefix by index.php
$subPath = preg_replace('#^/chapa#', '', $API_URI) ?: '/';

$segments = array_values(array_filter(explode('/', $subPath)));
$seg0 = $segments[0] ?? '';
$seg1 = $segments[1] ?? '';

switch (true) {
    case ($method === 'POST' && $seg0 === 'initialize'):
        chapaInitialize();
        break;
    case (($method === 'GET' || $method === 'POST') && $seg0 === 'callback'):
        chapaCallback();
        break;
    case ($method === 'POST' && $seg0 === 'webhook'):
        chapaWebhook();
        break;
    case ($method === 'GET' && $seg0 === 'verify' && $seg1 !== ''):
        chapaVerify($seg1);
        break;
    default:
        errorResponse('Route not found', 404);
        break;
}

// ──────────────────────────────────────────────
//  Chapa API helpers (using cURL)
// ──────────────────────────────────────────────

/**
 * Resolve api.chapa.co to an IP, falling back to a known-good IP
 * if the local DNS resolver can't resolve it (common on some ISPs).
 */
function resolveChapaDomain(): array {
    static $cache = null;
    if ($cache !== null) return $cache;

    // Try to reach api.chapa.co via known-good CloudFront IPs (fast — 3s timeout each)
    // dns_get_record() is skipped because it can hang for 15+ seconds on broken DNS.
    $fallbackIps = ['18.66.218.55', '18.66.218.122'];
    foreach ($fallbackIps as $ip) {
        $fp = @fsockopen($ip, 443, $errno, $errstr, 3);
        if ($fp) {
            fclose($fp);
            $cache = [$ip, 'api.chapa.co'];
            return $cache;
        }
    }

    // Last resort: let curl try with default DNS
    $cache = [null, null];
    return $cache;
}

function chapaCallApi(string $endpoint, array $payload, string $secretKey): array {
    $url = 'https://api.chapa.co/v1' . $endpoint;

    [$resolvedIp, $resolvedHost] = resolveChapaDomain();

    $curlOpts = [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $secretKey,
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_SSL_VERIFYPEER => true,
    ];

    // Force DNS resolution if we have a resolved IP
    if ($resolvedIp && $resolvedHost) {
        $curlOpts[CURLOPT_RESOLVE] = ["{$resolvedHost}:443:{$resolvedIp}"];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, $curlOpts);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return ['success' => false, 'message' => "cURL error: $error"];
    }

    $data = json_decode($response, true);

    if ($httpCode !== 200 || ($data['status'] ?? '') !== 'success') {
        $msg = $data['message'] ?? 'Failed to initialize payment';
        if (is_array($msg)) {
            $msg = implode('; ', array_map(
                fn($k, $v) => "$k: " . implode(', ', (array)$v),
                array_keys($msg),
                $msg
            ));
        }
        return ['success' => false, 'message' => $msg];
    }

    return [
        'success'      => true,
        'checkout_url' => $data['data']['checkout_url'] ?? null,
        'ref_id'       => $data['data']['reference'] ?? $data['data']['ref_id'] ?? null,
    ];
}

function chapaVerifyTx(string $txRef, string $secretKey): array {
    $url = 'https://api.chapa.co/v1/transaction/verify/' . urlencode($txRef);

    [$resolvedIp, $resolvedHost] = resolveChapaDomain();

    $curlOpts = [
        CURLOPT_HTTPGET         => true,
        CURLOPT_HTTPHEADER      => [
            'Authorization: Bearer ' . $secretKey,
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ];

    if ($resolvedIp && $resolvedHost) {
        $curlOpts[CURLOPT_RESOLVE] = ["{$resolvedHost}:443:{$resolvedIp}"];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, $curlOpts);

    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);

    if (($data['status'] ?? '') !== 'success') {
        return ['success' => false, 'message' => $data['message'] ?? 'Verification failed'];
    }

    return [
        'success'        => true,
        'status'         => $data['data']['status'] ?? null,
        'ref_id'         => $data['data']['reference'] ?? null,
        'payment_method' => $data['data']['payment_method'] ?? null,
    ];
}

function chapaNormalizePhone(string $phone): string {
    $cleaned = preg_replace('/\D/', '', $phone);
    if (str_starts_with($cleaned, '251')) {
        $cleaned = '0' . substr($cleaned, 3);
    }
    if (!str_starts_with($cleaned, '0')) {
        $cleaned = '0' . $cleaned;
    }
    return substr($cleaned, 0, 10);
}

function chapaMapStatus(string $status): string {
    return match (strtolower($status)) {
        'success', 'completed' => 'Completed',
        'failed', 'cancelled'  => 'Failed',
        'refunded'             => 'Refunded',
        default                => 'Pending',
    };
}

// ──────────────────────────────────────────────
//  Handlers
// ──────────────────────────────────────────────

function chapaInitialize(): void {
    $body          = getJsonBody();
    $registrationId = $body['registrationId'] ?? null;

    if (!$registrationId) {
        errorResponse('Registration ID is required');
        return;
    }

    $db         = Database::getConnection();
    $chapaCfg   = require __DIR__ . '/../config/chapa.php';

    // Fetch registration
    $stmt = $db->prepare("
        SELECT r.*, s.first_name, s.last_name, s.email, s.phone
        FROM registrations r
        JOIN students s ON r.student_id = s.id
        WHERE r.id = ?
    ");
    $stmt->execute([$registrationId]);
    $registration = $stmt->fetch();

    if (!$registration) {
        errorResponse('Registration not found', 404);
        return;
    }

    if (in_array($registration['status'], ['Paid', 'Cancelled'])) {
        errorResponse("Cannot initialize payment for a {$registration['status']} registration");
        return;
    }

    // Fetch programs
    $progStmt = $db->prepare("
        SELECT p.* FROM programs p
        JOIN registration_programs rp ON p.id = rp.program_id
        WHERE rp.registration_id = ?
    ");
    $progStmt->execute([$registrationId]);
    $programs = array_map('formatProgram', $progStmt->fetchAll());

    // Check for existing pending payment
    $payStmt = $db->prepare("
        SELECT * FROM payments WHERE registration_id = ? AND status = 'Pending'
        ORDER BY created_at DESC LIMIT 1
    ");
    $payStmt->execute([$registrationId]);
    $existingPayment = $payStmt->fetch();

    if ($existingPayment && $existingPayment['chapa_checkout_url']) {
        successResponse([
            'data' => [
                'checkoutUrl'            => $existingPayment['chapa_checkout_url'],
                'transactionReference'   => $existingPayment['transaction_reference'],
                'paymentId'              => (int)$existingPayment['id'],
                'alreadyInitialized'     => true,
            ],
        ]);
        return;
    }

    if ($existingPayment) {
        $db->prepare("DELETE FROM payments WHERE id = ?")->execute([$existingPayment['id']]);
    }

    // Compute amount server-side
    $programTotal = array_sum(array_column($programs, 'price'));
    $amount = $registration['payment_type'] === 'Half' ? (int)round($programTotal / 2) : $programTotal;

    // Validate email
    $email = trim($registration['email']);
    if (!$email || !validateEmail($email)) {
        errorResponse("Invalid student email: \"$email\"");
        return;
    }

    // Generate tx_ref
    $txRef = 'beauty-' . base_convert(time(), 10, 36) . '-' . substr(md5(uniqid()), 0, 6);

    $baseUrl    = getenv('API_BASE_URL') ?: 'https://api.biniyambeautytraining.com.et/api/v1';
    $callbackUrl = "$baseUrl/chapa/callback";
    $programNames = implode(', ', array_column($programs, 'title'));
    $description  = preg_replace('/[^a-zA-Z0-9\-_. ]/', ' ', "Payment for $programNames");
    $description  = preg_replace('/\s+/', ' ', trim($description));

    $payload = [
        'amount'        => (string)$amount,
        'currency'      => 'ETB',
        'email'         => $email,
        'first_name'    => trim($registration['first_name']),
        'last_name'     => trim($registration['last_name']),
        'phone_number'  => chapaNormalizePhone($registration['phone'] ?? ''),
        'tx_ref'        => $txRef,
        'callback_url'  => $callbackUrl,
        'customization' => [
            'title'       => 'Beauty Academy',
            'description' => $description,
        ],
        'meta' => [
            'registration_id' => (string)$registrationId,
            'payment_type'    => $registration['payment_type'] ?: 'Full',
        ],
    ];

    $result = chapaCallApi('/transaction/initialize', $payload, $chapaCfg['secret_key']);

    if (!$result['success']) {
        errorResponse($result['message'] ?: 'Failed to initialize payment', 502);
        return;
    }

    // Create payment record
    $db->prepare("
        INSERT INTO payments (registration_id, amount, currency, method, status, payment_type,
            transaction_reference, chapa_reference, chapa_checkout_url)
        VALUES (?, ?, 'ETB', 'Card', 'Pending', ?, ?, ?, ?)
    ")->execute([
        $registrationId,
        $amount,
        $registration['payment_type'] ?: 'Full',
        $txRef,
        $result['ref_id'] ?? null,
        $result['checkout_url'] ?? null,
    ]);

    $paymentId = $db->lastInsertId();

    successResponse([
        'data' => [
            'checkoutUrl'           => $result['checkout_url'],
            'transactionReference'  => $txRef,
            'paymentId'             => (int)$paymentId,
            'amount'                => $amount,
            'paymentType'           => $registration['payment_type'] ?: 'Full',
        ],
    ]);
}

function chapaCallback(): void {
    $txRef = $_GET['tx_ref'] ?? ($_POST['tx_ref'] ?? $_POST['trx_ref'] ?? null);

    if (!$txRef) {
        jsonResponse(200, ['status' => 'acknowledged']);
        return;
    }

    $db       = Database::getConnection();
    $chapaCfg = require __DIR__ . '/../config/chapa.php';

    $verification = chapaVerifyTx($txRef, $chapaCfg['secret_key']);
    $status = ($verification['success'] && isset($verification['status']))
        ? chapaMapStatus($verification['status'])
        : 'Failed';

    $db->prepare("
        UPDATE payments SET status = ?, chapa_reference = COALESCE(?, chapa_reference)
        WHERE transaction_reference = ?
    ")->execute([$status, $verification['ref_id'] ?? null, $txRef]);

    if ($status === 'Completed') {
        $db->prepare("
            UPDATE registrations SET status = 'Paid'
            WHERE id = (SELECT registration_id FROM payments WHERE transaction_reference = ? LIMIT 1)
            AND payment_type != 'Half'
        ")->execute([$txRef]);
    }

    // Return close-page HTML
    chapaCloseTabHtml($txRef, $status);
}

function chapaWebhook(): void {
    $signature = $_SERVER['HTTP_X_CHAPA_SIGNATURE'] ?? $_SERVER['HTTP_CHAPA_SIGNATURE'] ?? null;
    $rawBody   = file_get_contents('php://input');

    $chapaCfg = require __DIR__ . '/../config/chapa.php';
    $expectedSig = hash_hmac('sha256', $rawBody, $chapaCfg['secret_key']);

    if (!$signature || !hash_equals($expectedSig, $signature)) {
        jsonResponse(200, ['status' => 'ignored']);
        return;
    }

    $event = json_decode($rawBody, true);
    $txRef = $event['tx_ref'] ?? $event['reference'] ?? null;

    if (!$txRef) {
        jsonResponse(200, ['status' => 'ignored']);
        return;
    }

    $db = Database::getConnection();
    $payStmt = $db->prepare("SELECT * FROM payments WHERE transaction_reference = ? LIMIT 1");
    $payStmt->execute([$txRef]);
    $payment = $payStmt->fetch();

    if (!$payment) {
        jsonResponse(200, ['status' => 'not_found']);
        return;
    }

    if (in_array($payment['status'], ['Completed', 'Refunded'])) {
        jsonResponse(200, ['status' => 'already_processed']);
        return;
    }

    $mappedStatus = chapaMapStatus($event['status'] ?? 'pending');
    $paymentMethod = $event['payment_method'] ?? null;

    $methodMap = [
        'telebirr' => 'Mobile Money', 'cbebirr' => 'Mobile Money',
        'chapa' => 'Card', 'card' => 'Card', 'bank transfer' => 'Bank Transfer',
    ];
    $method = $methodMap[strtolower($paymentMethod)] ?? 'Card';

    $db->prepare("
        UPDATE payments SET status = ?, method = ?, chapa_reference = COALESCE(?, chapa_reference)
        WHERE id = ?
    ")->execute([$mappedStatus, $method, $event['reference'] ?? null, $payment['id']]);

    if ($mappedStatus === 'Completed' && $payment['payment_type'] !== 'Half') {
        $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")->execute([$payment['registration_id']]);
    }

    jsonResponse(200, ['status' => 'received']);
}

function chapaVerify(string $txRef): void {
    $db = Database::getConnection();

    $payStmt = $db->prepare("
        SELECT p.*, s.first_name, s.last_name, s.email, s.phone,
               GROUP_CONCAT(pr.title) as program_titles, GROUP_CONCAT(pr.price) as program_prices
        FROM payments p
        JOIN registrations r ON p.registration_id = r.id
        JOIN students s ON r.student_id = s.id
        JOIN registration_programs rpr ON r.id = rpr.registration_id
        JOIN programs pr ON rpr.program_id = pr.id
        WHERE p.transaction_reference = ?
        GROUP BY p.id
    ");
    $payStmt->execute([$txRef]);
    $payment = $payStmt->fetch();

    if (!$payment) {
        errorResponse('Payment not found', 404);
        return;
    }

    // If pending, verify with Chapa
    if ($payment['status'] === 'Pending') {
        $chapaCfg = require __DIR__ . '/../config/chapa.php';
        $verification = chapaVerifyTx($txRef, $chapaCfg['secret_key']);

        if ($verification['success'] && isset($verification['status'])) {
            $mappedStatus = chapaMapStatus($verification['status']);

            $db->prepare("
                UPDATE payments SET status = ?, chapa_reference = COALESCE(?, chapa_reference)
                WHERE id = ?
            ")->execute([$mappedStatus, $verification['ref_id'] ?? null, $payment['id']]);

            if ($mappedStatus === 'Completed' && $payment['payment_type'] !== 'Half') {
                $db->prepare("UPDATE registrations SET status = 'Paid' WHERE id = ?")
                    ->execute([$payment['registration_id']]);
            }

            $payment['status'] = $mappedStatus;
        }
    }

    // Format response to match Node.js structure
    $payment['id']     = (int)$payment['id'];
    $payment['amount'] = (int)$payment['amount'];
    $payment['registration'] = [
        'student'  => [
            'firstName' => $payment['first_name'],
            'lastName'  => $payment['last_name'],
            'email'     => $payment['email'],
            'phone'     => $payment['phone'],
        ],
        'programs' => array_map(fn($t, $p) => ['title' => $t, 'price' => (int)$p],
            explode(',', $payment['program_titles'] ?? ''),
            explode(',', $payment['program_prices'] ?? '')
        ),
    ];

    // Compute total paid and remaining balance
    $programPrices = array_map('intval', explode(',', $payment['program_prices'] ?? '0'));
    $totalCost = array_sum($programPrices);

    $totalPaidStmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE registration_id = ? AND status = 'Completed'");
    $totalPaidStmt->execute([$payment['registration_id']]);
    $totalPaid = (int)$totalPaidStmt->fetch()['total'];

    $payment['totalPaid'] = $totalPaid;
    $payment['remainingBalance'] = max(0, $totalCost - $totalPaid);

    successResponse(['data' => $payment]);
}

function chapaCloseTabHtml(string $txRef, string $status): void {
    $isSuccess = in_array($status, ['Completed', 'success']);
    $icon      = $isSuccess ? '✓' : '✕';
    $iconColor = $isSuccess ? '#2d9f6e' : '#e05a5a';
    $heading   = $isSuccess ? 'Payment Confirmed' : 'Payment Issue';
    $message   = $isSuccess
        ? 'Your enrolment at Biniyam Beauty Academy has been confirmed. You can safely close this tab.'
        : 'There was an issue processing your payment. Please try again from the checkout page.';

    $refHtml = $txRef
        ? '<p class="ref">Reference: ' . htmlspecialchars($txRef) . '</p>'
        : '';

    header('Content-Type: text/html; charset=utf-8');
    echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment {$heading}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f6f3;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:#fff;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.08);padding:48px 40px;max-width:420px;width:100%;text-align:center}
    .icon{display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:{$iconColor}15;color:{$iconColor};font-size:36px;font-weight:700;margin:0 auto}
    h1{font-size:28px;font-weight:700;color:#1a1a1a;margin-top:24px}
    p{color:#6b6b6b;line-height:1.7;margin-top:12px;font-size:15px}
    .ref{font-size:12px;color:#a0a0a0;margin-top:24px;padding-top:16px;border-top:1px solid #eee}
    .btn{display:inline-block;margin-top:24px;background:#c89b3c;color:#fff;border:none;border-radius:14px;padding:12px 28px;font-size:14px;font-weight:600;cursor:pointer}
    .btn:hover{opacity:.85}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">{$icon}</div>
    <h1>{$heading}</h1>
    <p>{$message}</p>
    {$refHtml}
    <button class="btn" onclick="window.close()">Close Tab</button>
  </div>
</body>
</html>
HTML;
    exit;
}
