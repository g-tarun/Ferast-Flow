# Free Demo Deployment

This project can run as one deployable Node service:

- Express API serves `/api/*`
- Express also serves the built React app from `dist`
- MySQL data can live in a free MySQL-compatible cloud database

Final result: one public Render URL that you can share with users for the demo.

## Recommended Free Demo Stack

- App server: Render Free Web Service
- Database: TiDB Cloud Starter, MySQL-compatible free tier
- Source hosting: GitHub

This is good for a demo. It is not a production SLA setup.

## 1. Create Free MySQL-Compatible DB

1. Create a TiDB Cloud account.
2. Create a Starter cluster.
3. Create database/user credentials.
4. Copy the host, port, username, password, and database name.

Use SSL for hosted DB connections:

```env
DB_MODE=mysql
MYSQL_HOST=<tidb-host>
MYSQL_PORT=4000
MYSQL_USER=<tidb-user>
MYSQL_PASSWORD=<tidb-password>
MYSQL_DATABASE=feastflow_demo
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=true
MYSQL_MAX_ALLOWED_PACKET=67108864
```

If your provider gives port `3306`, use that instead. TiDB commonly provides its own port in the connection string.

## 2. Push Code To GitHub

From the project folder:

```powershell
git init
git add .
git commit -m "Prepare FeastFlow demo deployment"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 3. Deploy On Render

Create a new Render Web Service from the GitHub repository.

Use:

```text
Runtime: Node
Build command: npm install && npm run build
Start command: npm start
Instance type: Free
```

Environment variables:

```env
DB_MODE=mysql
MYSQL_HOST=<tidb-host>
MYSQL_PORT=<tidb-port>
MYSQL_USER=<tidb-user>
MYSQL_PASSWORD=<tidb-password>
MYSQL_DATABASE=feastflow_demo
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=true
MYSQL_MAX_ALLOWED_PACKET=67108864
JWT_SECRET=<make-a-long-random-secret>
JWT_EXPIRES_IN=2h
SERVE_CLIENT=true
```

Do not set `VITE_API_BASE_URL` for this single-service deployment. The frontend will call the same deployed domain.

## 4. Test The Demo

Open the Render URL.

This single URL is the shareable user-facing demo link. Customers, vendors, and admins can all log in from the same URL and see their role-based screens.

Demo logins:

```text
customer@feastflow.test / demo1234
vendor@feastflow.test / demo1234
vendor-blue@feastflow.test / demo1234
vendor-green@feastflow.test / demo1234
vendor-royal@feastflow.test / demo1234
admin@feastflow.test / demo1234
```

Use admin to approve/reject vendor documents. Uploaded PDFs/images are stored in the cloud DB as BLOB rows in the `documents` table.

## Demo Limits

- Render Free can sleep after inactivity, so the first request may be slow.
- Free database quotas are fine for demo PDF uploads, but keep documents small.
- For production, move to a paid app instance and a paid database plan with backups.
