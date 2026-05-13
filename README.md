# Driver Fatigue Monitoring System

Driver Fatigue Monitoring System is a production-style graduation project that connects a physical AI detection device to a secure web dashboard. The physical device owns the camera and runs the fatigue model locally. The website does not run AI inference; it only displays verified events that were already detected by the device and stored in Supabase.

The system is designed around this architecture:

```text
Physical Device -> Supabase Edge Function -> Supabase Database -> Website Dashboard
```

## Live Pages

- Driver portal: `https://driver-fatigue-monitoring-system.github.io/`
- Admin console: `https://driver-fatigue-monitoring-system.github.io/admin.html`

The driver portal is the page I use for clients. The admin console is deployed too, but access is protected by Supabase Auth and the `profiles.role = 'admin'` database rule.

## What This Project Does

- Runs fatigue detection on a physical camera device, not in the browser.
- Sends confirmed fatigue events to a Supabase Edge Function over HTTPS.
- Validates the device serial number and private device token before storing events.
- Stores drivers, devices, detection logs, and sessions in Supabase.
- Lets a driver open their dashboard using the permanent serial number printed on the device.
- Lets a new driver claim an unassigned serial once by entering serial, email, and name.
- Shows live status, latest event, confidence, current session counters, analytics, event history, and CSV export.
- Provides an admin console to register devices, assign devices, reset tokens, disable/activate devices, and search devices.
- Sends device activation emails with Brevo from the backend only.
- Keeps service role keys, Brevo keys, and device token hashing logic out of frontend code.

## Repository Structure

```text
.
├── index.html                         # Full local/admin-capable web app
├── client.html                        # Public driver portal used as GitHub Pages homepage
├── app.js                             # Admin/full dashboard logic
├── client.js                          # Driver-only dashboard logic
├── styles.css                         # Shared responsive UI styles
├── config.js                          # Public Supabase frontend config
├── config.example.js                  # Template frontend config
├── supabase/
│   ├── schema.sql                     # Tables, indexes, RLS policies
│   └── functions/
│       ├── device-events/             # Physical device event ingestion endpoint
│       ├── driver-login/              # Driver serial/email/name access workflow
│       ├── driver-update-profile/     # Driver profile update endpoint
│       ├── admin-register-device/     # Register printed devices before sale
│       ├── admin-activate-device/     # Assign driver and send Brevo email
│       ├── admin-device-action/       # Disable, activate, reset token
│       └── _shared/                   # Shared crypto, HTTP, Supabase helpers
├── physical-device/                   # Laptop/Raspberry Pi device code
│   ├── main.py
│   ├── Run_DFMS_Device.bat
│   ├── Setup_Device_Once.bat
│   ├── device_config.example.json
│   ├── alarm1.mp3
│   ├── alarm2.mp3
│   └── fatigues.pt
└── README_DEVICE.md                   # Physical device guide
```

Runtime files are intentionally not committed:

- `physical-device/device_config.json`
- `physical-device/Excel_driver_logs.xlsx`
- `physical-device/recordinges_drowsy/`
- local `.env` files

## System Flow

1. I register a physical device in the admin console.
2. The backend generates a permanent serial number and a private device token.
3. The serial number is printed on the device or box.
4. The private device token is stored only inside the device configuration file.
5. The client opens the driver portal and enters the serial number.
6. If the device is new and unclaimed, the client enters their email and name once.
7. The device runs the AI model locally using the camera.
8. When Drowsy is confirmed for 3 consecutive seconds, or Yawn is detected above the confidence threshold, the device sends an event to Supabase.
9. The Edge Function validates the serial number and token, then stores the event.
10. The dashboard reads the authenticated driver’s rows and displays status, analytics, logs, and sessions.

## Frontend

The frontend is a static website that can run on GitHub Pages. It uses:

- Plain HTML/CSS/JavaScript
- Supabase browser client
- Chart.js for analytics
- XLSX library for log export

The UI includes:

- Driver access page
- Driver live status
- Current session counters
- Session duration
- Analytics charts
- Event logs table
- Driver info modal
- Responsive PC/tablet and mobile layouts
- Admin fleet console
- Device search by serial, driver email, driver name, or status

## Supabase Database

The schema is in `supabase/schema.sql`.

Main tables:

- `profiles`: Supabase Auth profile and admin role.
- `drivers`: Driver name and email.
- `devices`: Permanent serial numbers, hashed device tokens, device status, and assigned driver.
- `detection_logs`: Confirmed Drowsy/Yawn events sent by devices.
- `driving_sessions`: Session summaries and fatigue totals.

Security:

- Row Level Security is enabled.
- Drivers can read only their own driver, device, log, and session rows.
- Admins can manage all rows.
- Physical devices cannot read database tables directly.
- Devices only send events through the Edge Function.

## Supabase Edge Functions

### Device Event Endpoint

```text
POST https://wxxdtuzicvjkjqymjsfj.supabase.co/functions/v1/device-events
```

Example body:

```json
{
  "device_serial": "DFMS-8H42K9",
  "device_token": "PRIVATE_DEVICE_TOKEN",
  "timestamp": "2026-05-13T10:20:00Z",
  "event_type": "Drowsy",
  "confidence": 0.91,
  "status": "Drowsy",
  "frame_url": null,
  "session_id": "session-id"
}
```

The function:

- Validates the serial number.
- Hashes the submitted token and compares it with `device_token_hash`.
- Rejects unknown, inactive, or unassigned devices.
- Finds the linked driver.
- Inserts the event into `detection_logs`.
- Updates or creates the related driving session.

## Brevo Email Workflow

Brevo is used only from the backend. The frontend never contains the Brevo API key.

When a device is assigned to a driver by the admin workflow:

- The backend sends the email using Brevo.
- The email includes the driver name, serial number, dashboard link, and activation instructions.
- The permanent serial number is what the driver uses to access the dashboard.

## Required Supabase Secrets

Set these in Supabase, not in frontend code:

```bash
npx supabase secrets set APP_JWT_SECRET="YOUR_SUPABASE_JWT_SECRET"
npx supabase secrets set DEVICE_TOKEN_PEPPER="LONG_RANDOM_PEPPER"
npx supabase secrets set BREVO_API_KEY="YOUR_BREVO_API_KEY"
npx supabase secrets set BREVO_SENDER_EMAIL="verified-sender@example.com"
npx supabase secrets set BREVO_SENDER_NAME="Driver Fatigue Monitoring System"
npx supabase secrets set DASHBOARD_LOGIN_URL="https://driver-fatigue-monitoring-system.github.io/"
```

The normal Supabase runtime secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the Edge Functions in the Supabase environment.

## Deploy Supabase

1. Link the project:

```bash
npx supabase link --project-ref wxxdtuzicvjkjqymjsfj
```

2. Apply the database schema in the Supabase SQL editor or through the CLI.

3. Deploy functions:

```bash
npx supabase functions deploy device-events
npx supabase functions deploy driver-login
npx supabase functions deploy driver-update-profile
npx supabase functions deploy admin-register-device
npx supabase functions deploy admin-activate-device
npx supabase functions deploy admin-device-action
```

4. Create an admin user in Supabase Auth, then add their profile row:

```sql
insert into public.profiles (id, email, role)
values ('ADMIN_AUTH_USER_UUID', 'admin@example.com', 'admin')
on conflict (id) do update
set role = 'admin', email = excluded.email;
```

## Deploy Website To GitHub Pages

This repository is prepared for the GitHub organization:

```text
driver-fatigue-monitoring-system/driver-fatigue-monitoring-system.github.io
```

That repository name gives this clean URL:

```text
https://driver-fatigue-monitoring-system.github.io/
```

The GitHub Pages workflow copies:

- `client.html` as the public `index.html`
- `index.html` as `admin.html`
- shared JavaScript/CSS/config files
- documentation

## Physical Device

The physical-device code is included in `physical-device/`. It is the part that runs on a laptop or small computer connected to the camera.

Important behavior:

- The device runs the model locally.
- Drowsy is only sent after the driver’s eyes remain closed for 3 consecutive seconds.
- Yawn is ignored below 65% confidence.
- Drowsy alarm loops until the eyes reopen.
- Yawn alarm plays once and does not repeat for 10 seconds.
- Drowsy events record a 15-second clip with 3 seconds before the confirmed drowsy moment.
- Local Excel logs are separated by day.
- The device sends only confirmed Drowsy/Yawn events to Supabase.

Full setup details are in `README_DEVICE.md`.

## Security Notes

- The Supabase service role key is never stored on the physical device.
- The Brevo API key is never placed in frontend files.
- The physical device stores only its own serial number and private token.
- Device tokens are hashed in the database.
- The browser uses only public Supabase frontend values.
- Admin actions require Supabase Auth and the admin role.
- `device_config.json` is private and ignored by Git.

## My Project Goal

I built this project to demonstrate a realistic Driver Fatigue Monitoring System where the physical AI device, backend validation, database security, email activation, and dashboard analytics work together as one complete platform. The main idea is that the AI model stays on the device, while the website acts as the secure monitoring and reporting layer.
