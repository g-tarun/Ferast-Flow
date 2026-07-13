# Email MFA Setup

FeastFlow supports email-based multi-factor authentication with SMTP. The login flow validates the password first, stores only a hash of a six-digit code in MySQL, then requires that code before issuing a JWT.

For a free demo, use a dedicated Gmail mailbox rather than a personal mailbox.

1. Turn on 2-Step Verification for the Gmail account.
2. Create a Google App Password for FeastFlow.
3. Add the values below to the local `.env` file. Do not commit this file.

```dotenv
MFA_REQUIRED=true
MFA_CODE_SECRET=<a-separate-long-random-value>
MFA_CODE_TTL_MINUTES=10
MFA_MAX_ATTEMPTS=5
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-demo-mailbox@gmail.com
SMTP_PASS=<the-16-digit-google-app-password>
SMTP_FROM=FeastFlow <your-demo-mailbox@gmail.com>
```

Restart the local API after changing `.env`. The health endpoint will report `emailMfa.configured: true` once MySQL and SMTP configuration are present.

The project is SMTP-based, so a future provider change only requires changing the `SMTP_*` values. Keep MFA required for a shared demo or production environment; leave it `false` only while configuring local email delivery.
