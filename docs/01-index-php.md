# 📄 Documentation: `index.php` — The Front Door

## What Does This File Do?

`index.php` is the **main entry point** of the entire API. Think of it like the receptionist at a hotel — every guest (API request) must come through the receptionist first, who then directs them to the right room.

When someone visits `http://localhost/Biniyam_PHP/api/v1/programs`, the web server (Apache) forwards the request to `index.php`, which figures out what to do.

---

## Line-by-Line Explanation

### Part 1: Loading Environment Variables (Lines 1-18)

```php
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key]     = $value;
            putenv("$key=$value");
        }
    }
}
```

**What's happening here, explained simply:**

- **Line 2**: Check if a file called `.env` exists in the same folder. The `.env` file contains secret settings like database passwords and API keys.

- **Line 3**: Read all lines from the `.env` file. `FILE_IGNORE_NEW_LINES` means "don't include the invisible newline character at the end of each line". `FILE_SKIP_EMPTY_LINES` means "skip any blank lines".

- **Line 4**: Go through each line one by one (this is a loop).

- **Line 5**: Remove any spaces from the beginning and end of the line.

- **Line 6**: If the line is empty OR starts with `#` (a comment), skip it and move to the next line. Nobody wants to read comments — we only want the actual settings!

- **Line 7**: If the line doesn't contain an `=` sign, skip it. A setting looks like `DB_HOST=localhost`, so it must have an equals sign.

- **Line 8**: Split the line into two parts at the first `=` sign. `$key` becomes "DB_HOST" and `$value` becomes "localhost". The `2` means "only split at the first `=` — if the value itself contains `=`, keep it as part of the value."

- **Lines 9-10**: Remove any extra spaces from the key and value.

- **Lines 11-14**: Only set the variable if it hasn't been set already. This means if someone already set `DB_HOST` before, don't overwrite it. `$ENV` is PHP's built-in place to store environment variables, and `putenv()` makes it available to the whole system.

**Why?** This is our own simple `.env` file loader. It reads settings like:
```
DB_HOST=localhost
DB_NAME=beauty_academy
CHAPA_SECRET_KEY=CHAPUBK_TEST-xxxxx
```
...and makes them available as `getenv('DB_HOST')` anywhere in the code.

---

### Part 2: CORS Headers (Lines 19-31)

```php
header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^https?://(localhost|127\.0\.0\.1|\[::1\]):(5173|5174)$#', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Cache-Control, Pragma');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
```

**What's happening here:**

- **Line 2**: Tell the browser "Hey, I'm going to send you JSON data, not HTML."

- **Line 4**: Get the "origin" — which website is making this request? When your frontend at `http://localhost:5173` asks the backend at `http://localhost/Biniyam_PHP/api/v1` for data, the browser includes an `Origin` header saying "I'm from localhost:5173".

- **Lines 5-7**: This is the **CORS** (Cross-Origin Resource Sharing) check. Browsers have a security rule: Website A can't talk to Website B unless Website B explicitly says "yes, you can talk to me."
  - The regex checks: is the origin from `localhost`, `127.0.0.1`, or `[::1]` (IPv6 localhost) on port `5173` (frontend) or `5174` (admin)?
  - If yes → set the `Access-Control-Allow-Origin` header to tell the browser "yes, this website is allowed to talk to me"
  - If no → the header isn't set, so the browser blocks the request

- **Line 8**: "I accept all these HTTP methods: GET, POST, PUT, PATCH, DELETE, and OPTIONS."

- **Line 9**: "I accept these headers in the request: Content-Type, Authorization, Cache-Control, Pragma."

- **Line 10**: "I accept cookies/credentials from the frontend."

- **Lines 12-15**: Handle the **preflight request**. Before the browser sends a real request, it first sends an "OPTIONS" request to ask "Am I allowed to make this request?" If the request method is OPTIONS, we respond with 204 (No Content) — meaning "Yes, you're allowed" — and exit immediately without doing anything else.

**Why?** Without CORS, the browser would block ALL communication between your frontend (port 5173) and your backend (port 80). CORS is like a bouncer at a club — it checks IDs and lets the right people in.

---

### Part 3: Loading Helper Files (Lines 32-37)

```php
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/helpers/jwt.php';
require_once __DIR__ . '/helpers/validation.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/AuthMiddleware.php';
```

**What's happening here:**

- Each `require_once` line loads a file that contains useful functions we'll need.

- `__DIR__` means "the folder this current file is in" (Biniyam_PHP/).

- `require_once` means "load this file, but only once — if it's already loaded, don't load it again."

- **Line 2**: Load `response.php` — gives us `successResponse()` and `errorResponse()` to send JSON back.

- **Line 3**: Load `jwt.php` — gives us `jwt_encode()` and `jwt_decode()` to create and verify tokens.

- **Line 4**: Load `validation.php` — gives us `validateEmail()`, `validatePhone()`, etc.

- **Line 5**: Load `database.php` — gives us `Database::getConnection()` to talk to MySQL.

- **Line 6**: Load `AuthMiddleware.php` — gives us `AuthMiddleware::authenticate()` to check if an admin is logged in.

**Why?** These files contain tools we use everywhere. Instead of rewriting the same code in every file, we load them once at the beginning.

---

### Part 4: Parse the Request URL (Lines 38-53)

```php
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if (preg_match('#^.*/api/v1(.*)$#', $uri, $m)) {
    $uri = $m[1];
} else {
    $uri = preg_replace('#^/[^/]+/?#', '/', $uri);
}
$uri = rtrim($uri, '/') ?: '/';

$parts    = explode('/', ltrim($uri, '/'));
$resource = $parts[0] ?? '';

$API_URI = $uri;
```

**What's happening here:**

- **Line 2**: Get the URL path from the request. For example, if the full URL is `http://localhost/Biniyam_PHP/api/v1/programs`, then `$uri` becomes `/Biniyam_PHP/api/v1/programs`.

- **Line 3**: Get the HTTP method — is it GET, POST, PUT, PATCH, or DELETE?

- **Lines 5-9**: Clean up the URL:
  - If the URL contains `/api/v1`, strip everything before it. So `/Biniyam_PHP/api/v1/programs` becomes `/programs`.
  - If it doesn't contain `/api/v1` (direct access), strip the first part. So `/Biniyam_PHP/programs` becomes `/programs`.

- **Line 10**: Remove any trailing slash. `/programs/` becomes `/programs`. If the URL is just `/`, keep it as `/`.

- **Lines 12-13**: Split the URL by `/` and grab the first word. For `/programs/123`, the first word is "programs". For `/registrations/stats/summary`, it's "registrations".

- **Line 16**: Store the cleaned URL in `$API_URI` so the API route files (like `programs.php`) can use it to figure out the details.

---

### Part 5: Route the Request (Lines 54-105)

```php
switch ($resource) {
    case '':
        successResponse([
            'message' => 'Biniyam Beauty Academy API is running',
            'status'  => 'ok',
            'version' => '1.0.0-php',
        ]);
        break;

    case 'auth':
        require __DIR__ . '/api/auth.php';
        break;

    case 'admin':
        require __DIR__ . '/api/admin.php';
        break;

    case 'programs':
        require __DIR__ . '/api/programs.php';
        break;

    // ... more cases ...

    default:
        errorResponse('Route not found', 404);
        break;
}
```

**What's happening here:**

- This is a **switch statement** — it looks at the first word of the URL and does different things:

- **`case ''`** (empty = root URL): Someone visited `http://localhost/Biniyam_PHP/api/v1/` — return a health check message saying "API is running."

- **`case 'auth'`**: URL starts with `/auth/...` — load `api/auth.php` to handle login, logout, etc.

- **`case 'admin'`**: URL starts with `/admin/...` — load `api/admin.php` to handle admin profile.

- **`case 'programs'`**: URL starts with `/programs/...` — load `api/programs.php` to handle course management.

- **`case 'students'`**: URL starts with `/students/...` — load `api/students.php`.

- **`case 'registrations'`**: URL starts with `/registrations/...` — load `api/registrations.php`.

- **`case 'payments'`**: URL starts with `/payments/...` — load `api/payments.php`.

- **`case 'chapa'`**: URL starts with `/chapa/...` — load `api/chapa.php` for payment integration.

- **`case 'cloudinary'`**: URL starts with `/cloudinary/...` — load `api/cloudinary.php`.

- **`case 'gallery'`**: URL starts with `/gallery/...` — load `api/gallery.php`.

- **`default`**: If the URL doesn't match any of the above, return a "Route not found" error (404).

**Why?** This is our simple router. Instead of using a big framework like Laravel, we use a simple switch statement. When someone asks for `/programs`, we route them to `programs.php`. When someone asks for `/auth/login`, we route them to `auth.php`.

---

## 🎯 Summary

| Line Range | What It Does | Like... |
|------------|-------------|---------|
| 1-18 | Load secret settings from .env | Reading a sealed envelope with passwords |
| 19-31 | Set CORS headers (who can talk to us) | A bouncer checking IDs at the door |
| 32-37 | Load helper files | Picking up your tools before starting work |
| 38-53 | Parse and clean up the URL | A GPS figuring out where you want to go |
| 54-105 | Route to the right file | A receptionist directing you to the right room |
