# 📄 Documentation: `router.php` — The Dev Server Helper

## What Does This File Do?

`router.php` is a helper for PHP's **built-in development server**. When you run `php -S localhost:8080 router.php`, PHP starts a mini web server, but it doesn't understand `.htaccess` files (those are Apache-only). So `router.php` acts as a translator.

---

## Line-by-Line Explanation

### Part 1: Get the URL (Lines 1-2)

```php
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
```

**What's happening:**
- Get just the path part of the URL. If someone visits `http://localhost:8080/api/v1/programs`, this gives us `/api/v1/programs`.
- We don't need the query string (?page=1) or the protocol (http://) — just the path.

---

### Part 2: Serve Static Files (Lines 3-12)

```php
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    if (pathinfo($uri, PATHINFO_EXTENSION) === 'php') {
        return false;
    }
    return false;
}
```

**What's happening:**
- **Line 3**: Check two things: (a) the URL is not just `/`, and (b) there's an actual file on disk at that location.
  - For example, if someone requests `/schema.sql`, check if the file `schema.sql` exists.

- **Lines 5-7**: If the file is a `.php` file (like `setup.php`), let PHP handle it normally by returning `false`.

- **Line 10**: If it's any other file (CSS, images, etc.), also return `false` to let PHP's built-in server serve it directly.

**Why?** If someone requests a CSS file or an image, we want to serve that file directly without going through our API router. `return false` tells PHP's dev server "handle this yourself."

---

### Part 3: Forward to index.php (Lines 13-14)

```php
require __DIR__ . '/index.php';
```

**What's happening:**
- If the URL doesn't match a real file, forward the request to `index.php` — our main API router.

**Why?** This is how all API requests (`/api/v1/programs`, `/api/v1/auth/login`, etc.) get routed through `index.php`, which handles them.

---

## 🎯 Summary

This file is only used during **local development**. In production (on a real server), Apache/Nginx handles everything using `.htaccess` rules, so this file isn't needed.

| Step | What Happens | Analogy |
|------|-------------|---------|
| 1 | Get the URL path | Look at the address on the envelope |
| 2 | If it's a real file, serve it | If it's a package, deliver it directly |
| 3 | If it's not a real file, send to index.php | If it's a letter, take it to the front desk |
