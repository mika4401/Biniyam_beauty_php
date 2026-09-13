# 📄 Documentation: Config Files (`config/`)

These 4 small files store settings. They don't do anything by themselves — they're like labeled jars on a shelf. Other files open these jars to get the values they need.

---

## 1. `config/database.php` — Database Connection

```php
class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $host = getenv('DB_HOST') ?: 'localhost';
            $name = getenv('DB_NAME') ?: 'beauty_academy';
            $user = getenv('DB_USER') ?: 'root';
            $pass = getenv('DB_PASS') ?: '';

            self::$instance = new PDO(
                "mysql:host=$host;dbname=$name;charset=utf8mb4",
                $user, $pass,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        }
        return self::$instance;
    }
}
```

**Line-by-line:**

- **`class Database`**: We create a "tool" (class) called Database.

- **`private static ?PDO $instance = null`**: Create a special variable that holds our database connection. `private` means "only this class can see it." `static` means "shared across all uses." `?PDO` means "it can be a PDO connection or null." `null` means "nothing yet — we haven't connected."

- **`public static function getConnection()`**: A function anyone can call to get the database connection.

- **`if (self::$instance === null)`**: If we haven't connected yet...

- **`getenv('DB_HOST') ?: 'localhost'`**: Read the database host from `.env`. If not set, default to `localhost`.

- **`new PDO(...)`**: Create a new database connection. Think of PDO as a telephone that lets PHP talk to MySQL.

- **`"mysql:host=$host;dbname=$name;charset=utf8mb4"`**: Connection string — "connect to MySQL at this host, use this database, support all characters."

- **`PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION`**: If something goes wrong, throw an error (don't silently fail).

- **`PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC`**: When we get data back, give us an associative array (like `['name' => 'Abebe', 'email' => 'abebe@gmail.com']`).

- **`PDO::ATTR_EMULATE_PREPARES => false`**: Use real MySQL prepared statements (more secure).

- **`return self::$instance`**: Return the connection (creating it only once — this is called a "singleton pattern").

**Why singleton?** We only want ONE database connection, not a new one for every request. It's like having one phone line instead of buying a new phone every time you make a call.

---

## 2. `config/jwt.php` — JWT Token Settings

```php
return [
    'secret'          => getenv('JWT_SECRET') ?: 'change-me-to-a-strong-random-string',
    'access_expiry'   => 900,       // 15 minutes
    'refresh_expiry'  => 604800,    // 7 days
];
```

**Line-by-line:**

- **`return [...]`**: This file returns an array (list) of settings.

- **`'secret'`**: The "secret key" used to sign JWT tokens. This is like the key to a safe — anyone with this key can create valid tokens. NEVER share this! It's read from `.env` file.

- **`'access_expiry' => 900`**: Access tokens expire after 900 seconds (15 minutes). After that, the admin must use a refresh token to get a new one.

- **`'refresh_expiry' => 604800`**: Refresh tokens expire after 604,800 seconds (7 days). After that, the admin must log in again.

**Why two expiry times?**
- **Access token (15 min)**: Short-lived. If someone steals it, they only have 15 minutes to cause damage.
- **Refresh token (7 days)**: Long-lived. Used only to get new access tokens. More protected (stored as httpOnly cookie).

---

## 3. `config/chapa.php` — Chapa Payment Settings

```php
return [
    'secret_key' => getenv('CHAPA_SECRET_KEY') ?: 'CHAPUBK_TEST-your-key-here',
    'api_base'   => 'https://api.chapa.co/v1',
    'sandbox'    => (getenv('CHAPA_SANDBOX') ?: 'true') === 'true',
];
```

**Line-by-line:**

- **`'secret_key'`**: Your Chapa API secret key. Read from `.env`. Used to authenticate with Chapa's servers.

- **`'api_base'`**: The base URL of Chapa's API. All Chapa requests go to `https://api.chapa.co/v1/...`.

- **`'sandbox'`**: Whether we're in test mode (sandbox) or real mode (production). In sandbox, payments are fake — no real money moves.

**⚠️ IMPORTANT**: Never commit your `CHAPA_SECRET_KEY` to git! It's like giving someone your bank PIN.

---

## 4. `config/cloudinary.php` — Cloudinary Image Settings

```php
return [
    'cloud_name'     => getenv('CLOUDINARY_CLOUD_NAME') ?: '',
    'api_key'        => getenv('CLOUDINARY_API_KEY') ?: '',
    'api_secret'     => getenv('CLOUDINARY_API_SECRET') ?: '',
    'upload_preset'  => getenv('CLOUDINARY_UPLOAD_PRESET') ?: '',
];
```

**Line-by-line:**

- **`'cloud_name'`**: Your Cloudinary account name (like "djzmclbg0"). It's part of the image URL: `https://res.cloudinary.com/djzmclbg0/image/upload/...`.

- **`'api_key'`**: Public key for Cloudinary (less secret than api_secret).

- **`'api_secret'`**: Secret key for Cloudinary. Used to delete images and check usage.

- **`'upload_preset'`**: The name of your upload preset in Cloudinary (like "B_Beauty_Academy"). This tells Cloudinary how to handle uploaded images (folder, transformations, etc.).

**Why Cloudinary?** Instead of storing images on our own server (which would be slow and expensive), we use Cloudinary — a service that stores and serves images fast. When someone uploads a national ID photo, it goes to Cloudinary, and we store the URL.

---

## 🎯 Summary

| File | What It Stores | Analogy |
|------|---------------|---------|
| `database.php` | MySQL connection details | Phone number for the database |
| `jwt.php` | Token secret + expiry times | Keys and rules for the security badge system |
| `chapa.php` | Chapa API key + mode | Credit card machine settings |
| `cloudinary.php` | Cloudinary account details | Photo storage account login |
