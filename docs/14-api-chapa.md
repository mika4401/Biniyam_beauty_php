# 📄 Documentation: `api/chapa.php` — Chapa Payment Integration 💳

## What Does This File Do?

This is the **payment gateway integration** — it connects our website to Chapa (Ethiopia's leading online payment processor). When a student clicks "Pay Now", this file:

1. Creates a payment session with Chapa
2. Returns a checkout URL where the student pays
3. Handles callbacks when payment is completed
4. Verifies payment status

---

## Routes Overview

| Route | Method | What It Does |
|-------|--------|-------------|
| `POST /chapa/initialize` | POST | Start a payment session |
| `GET /chapa/callback` | GET | Chapa redirects here after payment |
| `POST /chapa/callback` | POST | Chapa sends payment result |
| `POST /chapa/webhook` | POST | Server-to-server notification |
| `GET /chapa/verify/:txRef` | GET | Check payment status |

---

## Helper Functions

### `resolveChapaDomain()` — DNS Workaround

```php
function resolveChapaDomain(): array {
    static $cache = null;
    if ($cache !== null) return $cache;

    $fallbackIps = ['18.66.218.55', '18.66.218.122'];
    foreach ($fallbackIps as $ip) {
        $fp = @fsockopen($ip, 443, $errno, $errstr, 3);
        if ($fp) {
            fclose($fp);
            $cache = [$ip, 'api.chapa.co'];
            return $cache;
        }
    }

    $cache = [null, null];
    return $cache;
}
```

**What it does:**
- Sometimes the local DNS resolver can't resolve `api.chapa.co` (the Chapa API server).
- This function tries to connect to known CloudFront IPs directly.
- If one works, it caches the result and uses `CURLOPT_RESOLVE` to force cURL to use that IP.
- This is a workaround for ISPs with broken DNS.

**Why?** The Node.js backend had `FORCE_DNS=true` which forced DNS through Google/Cloudflare. The PHP backend needed the same workaround.

---

### `chapaCallApi(string $endpoint, array $payload, string $secretKey)`

```php
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

    if ($resolvedIp && $resolvedHost) {
        $curlOpts[CURLOPT_RESOLVE] = ["{$resolvedHost}:443:{$resolvedIp}"];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, $curlOpts);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);
```

**What it does:**
1. Build the full URL: `https://api.chapa.co/v1` + the endpoint.
2. Resolve the domain to an IP (for the DNS workaround).
3. Set cURL options:
   - POST request with JSON payload.
   - Authorization header with the Chapa secret key.
   - 30-second timeout.
   - SSL verification enabled (security!).
   - DNS override if we have a resolved IP.
4. Execute the request and get the response.

---

### `chapaVerifyTx(string $txRef, string $secretKey)`

```php
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
```

**What it does:**
- Calls Chapa's verification endpoint: `GET /transaction/verify/:txRef`
- Sends the API key for authentication.
- Returns the payment status (success, failed, pending) and reference numbers.

---

### `chapaNormalizePhone(string $phone)`

```php
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
```

**What it does:**
- Normalizes phone numbers to Ethiopian format: `0XXXXXXXXX` (10 digits).
- Removes all non-digit characters.
- Converts `+251...` to `0...`.
- Ensures it starts with `0`.

---

### `chapaMapStatus(string $status)`

```php
function chapaMapStatus(string $status): string {
    return match (strtolower($status)) {
        'success', 'completed' => 'Completed',
        'failed', 'cancelled'  => 'Failed',
        'refunded'             => 'Refunded',
        default                => 'Pending',
    };
}
```

**What it does:**
- Maps Chapa's status strings to our internal status:
  - `success`/`completed` → `Completed`
  - `failed`/`cancelled` → `Failed`
  - `refunded` → `Refunded`
  - Everything else → `Pending`

---

## Handlers (The Main Functions)

### `POST /chapa/initialize` — Start Payment

This is the most important function. Here's the complete flow:

```php
function chapaInitialize(): void {
    $body          = getJsonBody();
    $registrationId = $body['registrationId'] ?? null;

    if (!$registrationId) {
        errorResponse('Registration ID is required');
        return;
    }
```

**Step 1:** Get the registration ID from the request.

---

```php
    $db         = Database::getConnection();
    $chapaCfg   = require __DIR__ . '/../config/chapa.php';

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
```

**Step 2:** Fetch the registration with student details. Block if already paid or cancelled.

---

```php
    $progStmt = $db->prepare("
        SELECT p.* FROM programs p
        JOIN registration_programs rp ON p.id = rp.program_id
        WHERE rp.registration_id = ?
    ");
    $progStmt->execute([$registrationId]);
    $programs = array_map('formatProgram', $progStmt->fetchAll());
```

**Step 3:** Fetch the programs (courses) for this registration.

---

```php
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
```

**Step 4:** Check for existing pending payments:
- If there's already a pending payment with a checkout URL → return it (don't create a new one).
- If there's a pending payment without a URL → delete it and create a fresh one.

---

```php
    $programTotal = array_sum(array_column($programs, 'price'));
    $amount = $registration['payment_type'] === 'Half' ? (int)round($programTotal / 2) : $programTotal;
```

**Step 5:** Calculate the amount:
- Full payment → total of all program prices.
- Half payment → half the total (rounded).

---

```php
    $email = trim($registration['email']);
    if (!$email || !validateEmail($email)) {
        errorResponse("Invalid student email: \"$email\"");
        return;
    }
```

**Step 6:** Validate the student's email. Chapa requires a valid email.

---

```php
    $txRef = 'beauty-' . base_convert(time(), 10, 36) . '-' . substr(md5(uniqid()), 0, 6);

    $baseUrl    = getenv('API_BASE_URL') ?: 'http://localhost:8080/api/v1';
    $callbackUrl = "$baseUrl/chapa/callback";
    $programNames = implode(', ', array_column($programs, 'title'));
    $description  = preg_replace('/[^a-zA-Z0-9\-_. ]/', ' ', "Payment for $programNames");
    $description  = preg_replace('/\s+/', ' ', trim($description));
```

**Step 7:** Generate a unique transaction reference and build the callback URL.
- `tx_ref` format: `beauty-<timestamp-base36>-<random6chars>`
- `callback_url`: Where Chapa sends the payment result.

---

```php
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
```

**Step 8:** Build the Chapa API payload with:
- Amount in ETB
- Student's email, name, phone
- Unique transaction reference
- Callback URL (where Chapa sends the result)
- Customization (what the student sees on the payment page)
- Metadata (registration ID and payment type)

---

```php
    $result = chapaCallApi('/transaction/initialize', $payload, $chapaCfg['secret_key']);

    if (!$result['success']) {
        errorResponse($result['message'] ?: 'Failed to initialize payment', 502);
        return;
    }
```

**Step 9:** Call Chapa's API. If it fails, return the error.

---

```php
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
```

**Step 10:** Create a payment record in the database with status "Pending", and return the checkout URL to the frontend.

---

### `GET /chapa/callback` — Payment Callback

```php
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

    chapaCloseTabHtml($txRef, $status);
}
```

**What it does:**
1. Get the transaction reference from the URL.
2. Verify with Chapa that the payment was successful.
3. Update the payment status in our database.
4. If completed and NOT half payment → mark registration as "Paid".
5. Show an HTML page with payment status (this is what the Chapa tab shows).

**Important:** The callback only marks the registration as "Paid" if `payment_type != 'Half'`. Half payments need the remaining balance to be recorded manually.

---

### `POST /chapa/webhook` — Server-to-Server Notification

```php
function chapaWebhook(): void {
    $signature = $_SERVER['HTTP_X_CHAPA_SIGNATURE'] ?? $_SERVER['HTTP_CHAPA_SIGNATURE'] ?? null;
    $rawBody   = file_get_contents('php://input');

    $chapaCfg = require __DIR__ . '/../config/chapa.php';
    $expectedSig = hash_hmac('sha256', $rawBody, $chapaCfg['secret_key']);

    if (!$signature || !hash_equals($expectedSig, $signature)) {
        jsonResponse(200, ['status' => 'ignored']);
        return;
    }
```

**What it does:**
- Receives a server-to-server notification from Chapa.
- Verifies the signature (to ensure it's really from Chapa, not a hacker).
- Updates the payment status.

**Why both callback AND webhook?**
- **Callback**: Browser redirect — happens when the user is on the Chapa page.
- **Webhook**: Server notification — happens even if the user closes the browser before redirect. It's a backup.

---

### `GET /chapa/verify/:txRef` — Verify Payment Status

```php
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
```

**What it does:**
1. Look up the payment by transaction reference.
2. If still "Pending", verify with Chapa and update status.
3. Return comprehensive payment details including:
   - Student info (name, email, phone)
   - Program info (titles, prices)
   - Payment status
   - Total paid and remaining balance
4. This is used by the frontend's payment result page.

---

## 🎯 Complete Payment Flow

```
Student clicks "Pay Now"
        ↓
Frontend calls POST /chapa/initialize
        ↓
Backend creates payment record (status: Pending)
        ↓
Backend calls Chapa API → gets checkout URL
        ↓
Frontend opens Chapa checkout in new tab
        ↓
Student enters card details on Chapa
        ↓
Chapa processes payment
        ↓
Chapa sends callback → GET /chapa/callback
        ↓
Backend verifies with Chapa → updates payment status
        ↓
Backend updates registration status (if full payment)
        ↓
Original tab polls GET /chapa/verify/:txRef
        ↓
Frontend shows payment result page
```

---

## 🎯 Summary

| Function | What It Does |
|----------|-------------|
| `resolveChapaDomain` | Workaround for broken DNS (resolve Chapa API IP) |
| `chapaCallApi` | Make API calls to Chapa |
| `chapaVerifyTx` | Verify a transaction with Chapa |
| `chapaNormalizePhone` | Format phone numbers for Chapa |
| `chapaMapStatus` | Convert Chapa status to our status |
| `chapaInitialize` | Start a payment session |
| `chapaCallback` | Handle payment result from Chapa |
| `chapaWebhook` | Handle server-to-server notification |
| `chapaVerify` | Check payment status (used by frontend polling) |
| `chapaCloseTabHtml` | Show payment result page in Chapa tab |
