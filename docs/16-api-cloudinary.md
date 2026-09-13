# 📄 Documentation: `api/cloudinary.php` — Cloudinary Configuration

## What Does This File Do?

This is a very simple file. It has one route:
- `GET /cloudinary/config` — Returns the Cloudinary cloud name and upload preset

---

## Handler

```php
if ($method === 'GET' && $subPath === '/config') {
    $config = require __DIR__ . '/../config/cloudinary.php';

    if (empty($config['cloud_name']) || empty($config['upload_preset'])) {
        successResponse([
            'configured' => false,
            'message'    => 'Cloudinary is not configured.',
        ]);
        return;
    }

    successResponse([
        'configured' => true,
        'data' => [
            'cloudName'     => $config['cloud_name'],
            'uploadPreset'  => $config['upload_preset'],
        ],
    ]);
} else {
    errorResponse('Route not found', 404);
}
```

**Line-by-line:**

1. Check if it's a GET request to `/cloudinary/config`.
2. Load the Cloudinary configuration from `config/cloudinary.php`.
3. If `cloud_name` or `upload_preset` is empty → return "not configured".
4. Otherwise, return the cloud name and upload preset.

**Why is this a separate endpoint?** The frontend's Cloudinary upload widget needs to know:
- The cloud name (to know which Cloudinary account to upload to)
- The upload preset (to know how to handle the upload)

Instead of hardcoding these in the frontend, we serve them from the backend. This way:
- If the Cloudinary account changes, we only update the backend `.env`
- The API key and secret are NEVER sent to the frontend (they stay server-side)

---

## Response Format

**If configured:**
```json
{
  "success": true,
  "configured": true,
  "data": {
    "cloudName": "djzmclbg0",
    "uploadPreset": "B_Beauty_Academy"
  }
}
```

**If not configured:**
```json
{
  "success": true,
  "configured": false,
  "message": "Cloudinary is not configured."
}
```

---

## 🎯 Summary

| Route | What It Does |
|-------|-------------|
| `GET /cloudinary/config` | Returns Cloudinary cloud name + upload preset (public) |

This is the simplest API file — just 20 lines. It's a bridge between the backend configuration and the frontend upload widget.
