@echo off
cd /d "%~dp0"
echo Starting Driver Fatigue Monitoring device...
echo Using saved device_config.json from: %CD%
set DFMS_DEVICE_SERIAL=
set DFMS_DEVICE_TOKEN=
set SUPABASE_EVENT_URL=
python main.py
pause
