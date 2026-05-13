# Physical Device Guide

This document explains the physical-device part of my Driver Fatigue Monitoring System. The physical device is responsible for camera capture, local AI inference, alarms, local evidence logging, and sending confirmed fatigue events to the Supabase backend.

The website does not run the model. The device detects the driver state locally and sends only confirmed results.

## Device Folder

```text
physical-device/
├── main.py
├── Run_DFMS_Device.bat
├── Setup_Device_Once.bat
├── device_config.example.json
├── alarm1.mp3
├── alarm2.mp3
└── fatigues.pt
```

Runtime files created on the device:

```text
device_config.json          # private serial/token config, not committed
Excel_driver_logs.xlsx      # local daily fatigue log, not committed
recordinges_drowsy/         # local drowsy video clips, not committed
```

## What The Device Does

1. Opens the camera.
2. Loads the fatigue detection model.
3. Runs inference locally on the device.
4. Classifies driver states such as Awake, Drowsy, and Yawn.
5. Plays alarms when fatigue behavior is confirmed.
6. Saves local Excel logs for confirmed fatigue events.
7. Records local drowsy evidence clips.
8. Sends confirmed Drowsy/Yawn events to the Supabase Edge Function.

## Detection Rules

### Drowsy

Drowsy is not sent for every frame. The device waits until the driver remains in a Drowsy state for 3 consecutive seconds.

After confirmation:

- `alarm1.mp3` starts looping.
- The alarm stops immediately when the driver opens their eyes.
- A Drowsy event is sent to Supabase.
- A Drowsy row is written to the Excel log.
- A 15-second video clip is saved locally.

The recording includes:

- 3 seconds before the confirmed Drowsy moment.
- The remaining seconds after confirmation.

### Yawn

Yawn events are filtered by confidence.

- Minimum Yawn confidence: 65%.
- If confidence is below 65%, the device does not treat it as Yawn.
- `alarm2.mp3` plays once.
- The Yawn alarm does not repeat for 10 seconds.
- A Yawn event is sent to Supabase.
- A Yawn row is written to the Excel log.

## Backend Connection

The device sends events to:

```text
https://wxxdtuzicvjkjqymjsfj.supabase.co/functions/v1/device-events
```

Payload example:

```json
{
  "device_serial": "DFMS-YOUR-SERIAL",
  "device_token": "PRIVATE_DEVICE_TOKEN",
  "timestamp": "2026-05-13T10:20:00Z",
  "event_type": "Drowsy",
  "confidence": 0.91,
  "status": "Drowsy",
  "frame_url": null,
  "session_id": "session-uuid"
}
```

The device uses HTTPS only. It never stores the Supabase service role key.

## One-Time Device Setup

Each device must be configured before it is sold or delivered.

1. Open the admin console.
2. Register a printed physical device.
3. Copy the generated permanent serial number and private token.
4. Run:

```bat
Setup_Device_Once.bat
```

5. Paste the serial number and private token.
6. The script creates `device_config.json`.
7. Print only the serial number on the device or box.

The client should not see the device token.

## Running The Device

After one-time setup, run:

```bat
Run_DFMS_Device.bat
```

or:

```bash
python main.py
```

The terminal prints:

- Device serial
- Whether the token is configured
- Supabase endpoint
- Device config file path

Then the camera window opens.

## Manual Alarm Test

To test alarm files without camera detection:

```bash
python main.py --test-alarms
```

In the camera window:

- Press `1` to test the Drowsy alarm.
- Press `2` to test the Yawn alarm.
- Press `0` to stop alarms.
- Press `q` or `Esc` to quit.

## Local Storage Behavior

### Drowsy Recordings

Drowsy clips are stored in:

```text
recordinges_drowsy/
```

The folder is limited to 1 GB by default. When the folder exceeds the limit, the oldest clips are deleted automatically.

### Excel Logs

Excel logs are stored in:

```text
Excel_driver_logs.xlsx
```

Each day is stored in a separate sheet. The file is limited to 100 MB by default. When it exceeds the limit, the oldest data is trimmed.

## Configuration File

The real private configuration file is:

```text
device_config.json
```

Example:

```json
{
  "device_serial": "DFMS-YOUR-SERIAL",
  "device_token": "PRIVATE_DEVICE_TOKEN",
  "supabase_event_url": "https://wxxdtuzicvjkjqymjsfj.supabase.co/functions/v1/device-events"
}
```

This file must stay on the device only and must not be pushed to GitHub.

## Environment Overrides

The Python code also supports environment variables:

```bash
DFMS_DEVICE_SERIAL
DFMS_DEVICE_TOKEN
SUPABASE_EVENT_URL
DFMS_DROWSY_ALARM_DELAY
DFMS_YAWN_ALARM_COOLDOWN
DFMS_YAWN_MIN_CONFIDENCE
DFMS_DROWSY_RECORDING_MAX_MB
DFMS_EXCEL_MAX_MB
```

The normal product workflow should use `device_config.json`, because it is easier for real users.

## Python Requirements

Recommended packages:

```bash
pip install ultralytics opencv-python pygame openpyxl
```

The project uses:

- `ultralytics` for YOLO model inference.
- `opencv-python` for camera capture and video recording.
- `pygame` for MP3 alarms.
- `openpyxl` for Excel logs.

## Device Security

- The serial number is public and can be printed on the device.
- The device token is private and must stay inside the device.
- The token is stored as a hash in Supabase.
- The device does not contain the Supabase service role key.
- The device sends only confirmed Drowsy/Yawn events through the Edge Function.

## Notes For Raspberry Pi Or Small Devices

The code can run on a laptop and can be adapted for Raspberry Pi or similar edge devices. Performance depends on the model size, camera resolution, CPU/GPU availability, and installed inference runtime. For small devices, I would lower camera resolution, use an optimized model format, and test FPS before final installation in a vehicle.
