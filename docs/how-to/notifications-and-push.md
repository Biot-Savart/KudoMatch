# 🔔 How-To: Notifications & Web Push

This guide explains how notification alerts, Web Push subscriptions, and automated performance digests work in KudoMatch.

---

## 🌟 Notification Types

1. **Matchday Kickoff Reminders**: Alerts users 15–60 minutes before kickoff for unpredicted upcoming matches.
2. **Match Results & Points**: Notifies users when match scores are settled and points are tallied.
3. **Weekly Gameweek Digest**: Sends an email summary recapping points earned, exact scores, pool ranking movements, and upcoming fixtures.

---

## 📱 Browser Web Push & VAPID Setup

Web Push enables native-like background alerts on desktop and mobile browsers (Chrome, Edge, Safari on iOS/macOS, Firefox).

### 1. Generating VAPID Keys

To generate a new public/private VAPID keypair:

```bash
npx web-push generate-vapid-keys
```

Add the resulting keys to your [`.env.local`](.env.example:21):

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-generated-public-key
VAPID_PRIVATE_KEY=your-generated-private-key
VAPID_SUBJECT=mailto:notifications@yourdomain.com
```

### 2. How the Client Registers Push

- When the user clicks **"Enable"** on [`/profile`](app/profile/page.tsx:1), the hook [`usePushNotifications`](lib/hooks/use-push-notifications.ts:28) requests browser permission via `Notification.requestPermission()`.
- The browser registers [`public/sw.js`](public/sw.js:1).
- The subscription object (`endpoint`, `p256dh`, `auth`) is sent to the database via [`savePushSubscription()`](lib/queries/notifications.ts:89).

---

## 📧 Email Service Setup (Resend / SendGrid)

Emails are managed through [`lib/notifications/email-service.ts`](lib/notifications/email-service.ts:1).

### Production Configuration

- **Option A (Recommended: Resend)**:

  ```env
  RESEND_API_KEY=re_your_api_key_here
  EMAIL_FROM=notifications@yourdomain.com
  ```

  _(Note: For unverified testing accounts, Resend requires `EMAIL_FROM=onboarding@resend.dev` and delivers to your registered developer email or `delivered@resend.dev`)_

- **Option B (SendGrid)**:
  ```env
  SENDGRID_API_KEY=SG.your_api_key_here
  EMAIL_FROM=notifications@yourdomain.com
  ```

### Development Mock Mode

If no API keys are present in `.env.local`, `sendEmail()` automatically logs the formatted payload to the terminal without errors.

---

## 🧪 Testing & Simulating Notifications

### 1. Simulate Kickoff Reminders CLI

```bash
npm run notifications:kickoff:simulate
```

- Finds upcoming matches.
- Finds users who have missing predictions for those fixtures.
- Sends Web Push and/or Email alerts according to their preferences.

### 2. Simulate Weekly Performance Digest CLI

```bash
npm run notifications:digest:simulate
```

- Calculates each user's points and exact scores from the past 7 days.
- Finds their highest-ranking pool.
- Dispatches the responsive HTML digest email.

### 3. Trigger via HTTP API Endpoint

```bash
# Kickoff Reminders
curl "http://localhost:3000/api/cron/send-kickoff-reminders?simulate=true"

# Weekly Digest
curl "http://localhost:3000/api/cron/send-weekly-digest?simulate=true"
```
