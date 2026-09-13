# 🔧 Fix: Registration Search Filter on Admin Dashboard

## Date: August 31, 2026

## Problem

The search filter on the admin Registrations page (`/registrations`) was **completely non-functional**. When typing in the search box (e.g., "Abebe", "test", "gmail"), the results never changed — all 12 registrations were always shown regardless of the search term.

## Root Cause

The `registrationsList()` function in `api/registrations.php` **never handled the `search` parameter**. The frontend correctly sends `?search=Abebe` as a URL parameter, but the backend code only handled:
- `filter` (paidInFull, halfPaid)
- `status` (Pending, Paid, etc.)
- `schedule` (weekend, weekday-morning, etc.)

The `search` parameter was simply ignored — no WHERE clause was added for it.

## Fix

Added search logic to `registrationsList()` in `Biniyam_PHP/api/registrations.php`:

### What was added (after the schedule filter):

```php
// Search by student name or email
if (!empty($params['search'])) {
    $search = '%' . trim($params['search']) . '%';
    $where[] = "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?)";
    $binds[] = $search;
    $binds[] = $search;
    $binds[] = $search;
    $binds[] = $search;
}
```

### What was also fixed:

The `COUNT(*)` query didn't JOIN the students table, so it couldn't reference `s.first_name`. Fixed by conditionally adding the JOIN:

```php
$countJoin = !empty($params['search']) ? ' JOIN students s ON r.student_id = s.id' : '';
$countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM registrations r{$countJoin} $whereSql");
```

## What the Search Now Matches

The search is **case-insensitive** and matches against:
- Student **first name** (e.g., "Abebe" finds "Abebe Kebede")
- Student **last name** (e.g., "Kebede" finds all students with last name Kebede)
- Student **email** (e.g., "gmail" finds all students with gmail addresses)
- **Full name** (e.g., "Abebe Kebede" as a combined string)

## Test Results

| Search Term | Before Fix | After Fix |
|-------------|-----------|-----------|
| (empty) | 12 results | 12 results ✅ |
| "Abebe" | 12 results ❌ | 2 results ✅ |
| "test" | 12 results ❌ | 1 result ✅ |
| "kebede" | 12 results ❌ | 11 results ✅ |
| "gmail" | 12 results ❌ | 12 results ✅ (all students have gmail) |
| "nonexistent" | 12 results ❌ | 0 results ✅ |

## Files Changed

| File | Change |
|------|--------|
| `Biniyam_PHP/api/registrations.php` | Added search WHERE clause + fixed COUNT JOIN |
| `C:/xampp/htdocs/Biniyam_PHP/api/registrations.php` | Same fix (synced to htdocs) |

## How It Works (Line by Line)

1. **`if (!empty($params['search']))`**: Check if a search term was provided in the URL.

2. **`$search = '%' . trim($params['search']) . '%'`**: Wrap the search term in `%` wildcards for SQL LIKE matching. The `%` means "match anything before or after." Example: "Abebe" becomes "%Abebe%".

3. **`$where[] = "(s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?)"`**: Add a WHERE condition that matches the search term against:
   - First name: `WHERE s.first_name LIKE '%Abebe%'`
   - Last name: `WHERE s.last_name LIKE '%Abebe%'`
   - Email: `WHERE s.email LIKE '%Abebe%'`
   - Full name: `WHERE CONCAT(s.first_name, ' ', s.last_name) LIKE '%Abebe%'`
   - The `OR` means "match any of these."

4. **`$binds[] = $search` (×4)**: Add the search value 4 times — once for each `?` placeholder in the query.

5. **`$countJoin`**: When searching, the COUNT query needs to JOIN the students table (because the search references `s.first_name`). When NOT searching, no JOIN is needed (faster query).
