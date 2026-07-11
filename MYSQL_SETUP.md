# Local MySQL Setup

The app can persist all runtime data into your local MySQL database:

- users and JWT login accounts
- vendors, packages, vendor applications, banners, and uploaded documents stored as MySQL BLOB records
- bookings, quotes, chat messages, reviews, and payment records
- realtime event history

## 1. Start MySQL Server

MySQL Workbench is only the UI. The Windows service must also be running.

Open **XAMPP Control Panel** and start **MySQL**.

If you use the standalone MySQL service instead of XAMPP, open **Services** in Windows, find `MYSQL80`, and click **Start**.

You can also try PowerShell as Administrator:

```powershell
Start-Service MYSQL80
```

## 2. Create `.env`

Copy `.env.example` to `.env` and fill in your MySQL password:

```powershell
copy .env.example .env
```

Edit `.env`:

```env
DB_MODE=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=feastflow_local
MYSQL_MAX_ALLOWED_PACKET=67108864
JWT_SECRET=change-this-local-secret
API_PORT=4000
```

`MYSQL_MAX_ALLOWED_PACKET` lets the API store uploaded PDF/image documents as BLOBs in MySQL. The app keeps each document under 2.5 MB, and the API raises the MySQL session limit on startup so those files can be saved safely.

## 3. Check The Connection

```powershell
npm run db:check
```

Expected output:

```text
MySQL is ready: root@127.0.0.1:3306/feastflow_local
```

## 4. Run The App

```powershell
npm run dev
```

The backend will auto-create the database/tables if they do not exist, then seed the demo data only the first time.

## 5. View Data In Workbench

Open this database:

```sql
USE feastflow_local;
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM vendors;
SELECT COUNT(*) FROM vendor_packages;
SELECT COUNT(*) FROM bookings;
SELECT COUNT(*) FROM chat_messages;
SELECT COUNT(*) FROM payments;
SELECT * FROM event_log ORDER BY created_at DESC;
```

The app uses normalized relational tables such as `users`, `vendors`, `vendor_packages`, `documents`, `bookings`, `chat_messages`, `payments`, `reviews`, and lookup tables for tags, menu items, availability, badges, event types, and service pincodes.
