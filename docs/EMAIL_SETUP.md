# Real email setup: Gmail SMTP

All email flows can already be exercised without credentials using `npm run test:auth`. To receive messages in an actual inbox, an account owner must configure a real SMTP account. No real message has been sent by the development verification suites.

## One-time setup by the account owner

1. Sign in to the Google account you want Brightloop to send from.
2. Enable two-step verification if it is not enabled.
3. Create an app password for Brightloop where your account policy allows it. Follow [Google's official app-password instructions](https://support.google.com/accounts/answer/185833). Some managed or protected accounts do not offer this option.
4. Copy `.env.example` to `.env.local` if that local file does not exist. Never overwrite an existing configured file.
5. Edit these fields locally, replacing the explanatory values below:

```dotenv
APP_URL=http://127.0.0.1:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-sending-address@gmail.com
SMTP_PASSWORD=your-google-app-password
MAIL_FROM=your-sending-address@gmail.com
SCHEDULER_ENABLED=false
```

Use the Google app password, never the normal Google account password. Do not paste either into chat, issue comments or screenshots. The local environment file is ignored by Git. Restart `npm run dev` after changes. For hosted deployment, APP_URL must be the actual HTTPS application origin so recipients can open links.

## Verify the real connection deliberately

Register a customer using an inbox you control. This explicitly requests the verification message. Open its link and press Verify email, then sign in. Request a password reset and test the new password. Finally, invite a consenting staff tester from the administrator page. These actions send real messages only after you configure SMTP and invoke them.

Review Email delivery history. “Accepted by mail server” is not an inbox-delivery guarantee. Check the recipient inbox/spam folder and provider diagnostics. If credentials are rejected, confirm the account's app-password eligibility, sender identity and port settings; do not weaken TLS or use an ordinary account password.

Keep scheduled reminders disabled until you intend to send them to all eligible customer records. Use a separate demo database for demonstrations and never seed invented records into your operational database.

## Other SMTP providers

The same application supports a standards-compliant provider by changing SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD and MAIL_FROM. No application auth logic needs replacement. Provider-specific identity approval, quotas and deliverability remain operator responsibilities.
