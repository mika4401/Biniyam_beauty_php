# 📄 Documentation: `api/gallery.php` — Photo Gallery Management

## What Does This File Do?

This file handles the photo gallery:
- `GET /gallery` — List all gallery photos (public)
- `GET /gallery/usage` — Check Cloudinary storage usage (admin)
- `POST /gallery` — Upload a new photo (admin)
- `DELETE /gallery/:id` — Delete a photo (admin)

---

## Handlers

### `GET /gallery` — List Photos

```php
function galleryList(): void {
    $db   = Database::getConnection();
    $stmt = $db->query("SELECT * FROM gallery_items ORDER BY created_at DESC");
    $items = $stmt->fetchAll();

    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
    }

    successResponse(['data' => $items]);
}
```

**What it does:**
- Fetches all gallery items from the database.
- Returns them sorted by newest first.
- No authentication required — anyone can view the gallery.

---

### `GET /gallery/usage` — Cloudinary Storage Check

```php
function galleryUsage(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $config = require __DIR__ . '/../config/cloudinary.php';

    if (empty($config['api_key']) || empty($config['api_secret'])) {
        successResponse([
            'data' => [
                'plan'          => 'Unknown',
                'usedPercent'   => 0,
                // ... default values
            ],
        ]);
        return;
    }

    $timestamp = time();
    $signature = sha1("usage_at={$timestamp}#{$config['api_key']}#{$config['api_secret']}");
    $url = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/usage?usage_at={$timestamp}&signature={$signature}&api_key={$config['api_key']}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);
```

**What it does:**
- Calls Cloudinary's usage API to check:
  - What plan you're on
  - How much storage you've used
  - How many credits you've used
  - Whether you're near the limit (>= 90%)
- Used by the admin gallery page to show a storage quota bar.

---

### `POST /gallery` — Upload Photo

```php
function galleryCreate(): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $body = getJsonBody();
    $imageData = $body['imageData'] ?? '';
    $caption   = $body['caption'] ?? '';
    $category  = $body['category'] ?? '';

    if (!$imageData) { errorResponse('Image is required'); return; }
    if (!$caption)   { errorResponse('Caption is required'); return; }
    if (!$category)  { errorResponse('Category is required'); return; }

    if (!preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#', $imageData)) {
        errorResponse('Image must be a valid PNG, JPEG, WEBP, or GIF file');
        return;
    }
```

**What it does:**
1. Validate required fields: image data, caption, category.
2. Validate image format (must be PNG, JPEG, WEBP, or GIF).
3. Upload the image to Cloudinary.
4. Store the URL and metadata in the database.

---

```php
    $config = require __DIR__ . '/../config/cloudinary.php';
    $uploadUrl = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/image/upload";
    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => [
            'file'            => $imageData,
            'upload_preset'   => $config['upload_preset'],
            'folder'          => 'beauty-academy/gallery',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
    ]);

    $result = json_decode(curl_exec($ch), true);
    curl_close($ch);

    if (empty($result['secure_url'])) {
        errorResponse('Failed to upload image to Cloudinary');
        return;
    }
```

**Line-by-line:**
- Upload the base64 image data to Cloudinary.
- Use the upload preset (pre-configured settings in Cloudinary).
- Store in the `beauty-academy/gallery` folder.
- Get back the `secure_url` (the public URL of the uploaded image).

---

### `DELETE /gallery/:id` — Delete Photo

```php
function galleryDelete(string $id): void {
    $admin = AuthMiddleware::authenticate();
    if (!$admin) return;

    $db   = Database::getConnection();
    $stmt = $db->prepare("SELECT * FROM gallery_items WHERE id = ?");
    $stmt->execute([$id]);
    $item = $stmt->fetch();

    if (!$item) {
        errorResponse('Gallery item not found', 404);
        return;
    }

    // Delete from Cloudinary
    $config = require __DIR__ . '/../config/cloudinary.php';
    if (!empty($config['api_key']) && !empty($config['api_secret'])) {
        $timestamp = time();
        $signature = sha1("public_id={$item['public_id']}#timestamp={$timestamp}#{$config['api_secret']}");
        $deleteUrl = "https://api.cloudinary.com/v1_1/{$config['cloud_name']}/image/destroy";

        $ch = curl_init($deleteUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => [
                'public_id'  => $item['public_id'],
                'timestamp'  => $timestamp,
                'api_key'    => $config['api_key'],
                'signature'  => $signature,
            ],
            CURLOPT_RETURNTRANSFER => true,
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    $db->prepare("DELETE FROM gallery_items WHERE id = ?")->execute([$id]);
    successResponse(['message' => 'Gallery item deleted successfully']);
}
```

**What it does:**
1. Find the gallery item in the database.
2. Delete the image from Cloudinary (using their destroy API with a signed request).
3. Delete the record from our database.

**Why delete from Cloudinary too?** Otherwise, the image stays on Cloudinary's servers, taking up storage space even though we no longer display it.

---

## 🎯 Summary

| Route | What It Does |
|-------|-------------|
| `GET /gallery` | List all photos (public) |
| `GET /gallery/usage` | Check Cloudinary storage (admin) |
| `POST /gallery` | Upload photo to Cloudinary + save record (admin) |
| `DELETE /gallery/:id` | Delete from Cloudinary + database (admin) |
