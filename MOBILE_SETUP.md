# FeastFlow mobile local setup

The mobile app uses the same Express API and MySQL database as the website. The phone never connects directly to MySQL and never stores database credentials. Only the JWT session and selected API address are stored in the device's encrypted keychain.

## First-time setup

1. Start **MySQL** in XAMPP. Apache is optional for FeastFlow.
2. In the project root, confirm `.env` contains your local MySQL values and `DB_MODE=mysql`.
3. Create or upgrade all local tables:

   ```powershell
   npm run db:check
   ```

4. Install the mobile packages once:

   ```powershell
   npm run mobile:install
   ```

5. Install **Expo Go** on the Android or iPhone used for testing.

Expo SDK 54 is intentionally used because it is compatible with Expo Go during the SDK 57 transition.

## Run the API and mobile app together

From the project root:

```powershell
npm run dev:mobile
```

The command starts the API on all local network interfaces and starts Metro. Scan the QR code with Expo Go. The phone and laptop must use the same Wi-Fi network.

The app normally detects the laptop IP from Metro. If it cannot connect, open the server button on the login screen and enter:

```text
http://YOUR_LAPTOP_IPV4:4000
```

Find the laptop address with:

```powershell
ipconfig
```

Use the Wi-Fi adapter's IPv4 address, for example `http://192.168.1.25:4000`. Do not use `127.0.0.1` on a physical phone. For the Android emulator use `http://10.0.2.2:4000`.

If Windows Firewall prompts for Node.js access, allow it on **Private networks** only.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `customer@feastflow.test` | `demo1234` |
| Vendor | `vendor@feastflow.test` | `demo1234` |
| Admin | `admin@feastflow.test` | `demo1234` |

New customer and vendor accounts can register in the app. Admin registration is intentionally disabled.

## Notifications and installable builds

Local notifications, sound, and database event polling work in Expo Go. Android remote push notifications require an Expo development build, because Expo Go has not supported remote push on Android since SDK 53.

Create an installable Android test APK later with:

```powershell
cd mobile
npx eas-cli@latest init
npx eas-cli@latest build --profile preview --platform android
```

`eas init` replaces the placeholder Expo project ID used for remote push. The `preview` profile creates an APK for direct installation and does not require Play Store registration.
