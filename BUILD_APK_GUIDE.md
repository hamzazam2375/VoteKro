# VoteKro APK Build Guide

Complete guide to build and download the VoteKro Android APK using Expo Application Services (EAS).

## Setup EAS CLI

### Step 1: Install EAS CLI Globally

```bash
npm install -g eas-cli
```

Verify installation:

```bash
eas --version
```

### Step 2: Login to Expo Account

```bash
eas login
```

This will open a browser window to sign in. If you don't have an account:

1. Go to [expo.dev](https://expo.dev)
2. Click "Sign Up"
3. Create account with email/password or GitHub
4. Verify email

### Step 3: Verify EAS Project Link

```bash
cd d:\VoteKro\VoteKro
eas project:info
```

If this is your first time, link your project:

```bash
eas project:create
```

Follow the prompts to create a new EAS project.

---

## Configure Environment Variables

Environment variables must be set in EAS for the APK build to succeed.

### Step 1: Add Variables to EAS

Use one of these methods:

#### Method A: Using CLI (Interactive)

```bash
eas secret:create
```

Follow prompts to add each variable. When asked for scope, select `production`.

You need to add:

1. **EXPO_PUBLIC_SUPABASE_URL**
   - Value: `https://nfwsbbtmkjpdxgohvhxk.supabase.co`

2. **EXPO_PUBLIC_SUPABASE_ANON_KEY**
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3NiYnRta2pwZHhnb2h2aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzM3NTIsImV4cCI6MjA4ODcwOTc1Mn0.sW7YrnFOStnYAY9fUxyUZRON3ki9cvt7vG6oHEgDJuc`

3. **EXPO_PUBLIC_VOTE_ENCRYPTION_KEY**
   - Value: `7f3a9c8e2b1d5f4a6c9e3b7f1a8c2d5e4b9f6a3c8e1d7b4f2a5c9e3b6f8a1d`

#### Method B: Using EAS Dashboard

1. Go to [expo.dev/projects](https://expo.dev/projects)
2. Select your VoteKro project
3. Go to **Secrets** tab
4. Click **Add Secret**
5. Add each variable listed above
6. Set scope to `production`

### Step 2: Verify Secrets

```bash
eas secret:list
```

You should see all three `EXPO_PUBLIC_*` variables listed.

---

## Build the APK

### Step 1: Build Preview APK (Recommended First)

A preview APK is faster and great for testing:

```bash
eas build --platform android --profile preview
```

This will:

- Show build progress in terminal
- Create a buildID (save this for reference)
- Build completes in 5-15 minutes

### Step 2: Build Production APK (Optional)

For a release-ready APK optimized for distribution:

```bash
eas build --platform android --profile production
```

This takes slightly longer but creates a production-ready APK.

### Step 3: Monitor Build Status

While building, you can check status:

```bash
eas build:list              # List all builds
eas build:view <buildId>    # View specific build
```

Or monitor in browser:

- Go to [expo.dev/projects](https://expo.dev/projects)
- Select VoteKro project
- Go to **Builds** tab

---

## Download & Install

### Step 1: Get the Download Link

After build completes, you'll see:

```
✅ Build finished!
📲 Download APK: https://exp-shell-app-assets.s3.amazonaws.com/...
```

Or find it in Expo dashboard:

1. Go to [expo.dev/projects](https://expo.dev/projects)
2. Select VoteKro
3. Go to **Builds**
4. Click latest build
5. Click **Download APK**

### Step 2: Install on Android Phone

#### Option A: USB Cable (Recommended)

1. Connect phone to computer with USB cable
2. Enable USB debugging on phone:
   - Go to **Settings → About Phone**
   - Tap **Build Number** 7 times
   - Go back to **Settings → Developer Options**
   - Enable **USB Debugging**

3. Install APK:
   ```bash
   adb install votekro.apk
   ```

#### Option B: Download to Phone

1. Open download link on phone
2. APK downloads to Downloads folder
3. Open Downloads app
4. Tap the APK file
5. Tap **Install**
6. Grant permissions if prompted

#### Option C: QR Code

From Expo dashboard, scan QR code with phone to download directly.

### Step 3: Launch App

1. Find VoteKro app on home screen
2. Tap to launch
3. First launch may take a moment to initialize

### Common Issues

If app crashes or shows blank screen:

1. Check logcat:

   ```bash
   adb logcat | grep VoteKro
   ```

2. Check for missing env vars:
   - Open app
   - Go to Settings (if available)
   - Verify Supabase URL and keys are shown

3. Test network:
   - Ensure phone has internet (WiFi or mobile data)
   - Test in browser: https://nfwsbbtmkjpdxgohvhxk.supabase.co

---

## Troubleshooting

### Build Fails: "Missing environment variable"

**Problem:** Build fails with `Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL`

**Solution:**

1. Verify secrets are added:

   ```bash
   eas secret:list
   ```

2. If missing, add them:

   ```bash
   eas secret:create
   ```

3. Rebuild:
   ```bash
   eas build --platform android --profile preview --clear-cache
   ```

### Build Fails: "EAS Project not linked"

**Problem:** `Error: This directory is not inside a valid EAS project`

**Solution:**

1. Verify app.json exists:

   ```bash
   cat app.json
   ```

2. Link project:

   ```bash
   eas project:create
   ```

3. Or link to existing project:
   ```bash
   eas project:link
   ```

### App Crashes on Launch

**Problem:** App starts but immediately crashes

**Solution:**

1. Check logcat for errors:

   ```bash
   adb logcat | tail -20
   ```

2. Common causes:
   - Network unreachable (check WiFi/mobile data)
   - Supabase service down (check status at supabase.com)
   - Missing environment variables (rebuild with correct secrets)

3. If stuck, try:
   ```bash
   adb uninstall com.votekro
   eas build --platform android --profile preview --clear-cache
   ```

### APK Won't Install

**Problem:** "App not installed" error when tapping APK

**Solution:**

1. Check Android version:
   - App requires Android 8.0+ (API level 26)
   - Go to **Settings → About Phone** to check

2. Try installing via adb:

   ```bash
   adb install -r votekro.apk
   ```

3. Uninstall old version first:
   ```bash
   adb uninstall com.votekro
   adb install votekro.apk
   ```

### Blank White Screen After Launch

**Problem:** App opens but shows blank white screen

**Solution:**

1. Wait 10-15 seconds (first launch is slower)

2. Check network connection:
   - Open WiFi settings and reconnect
   - Try using mobile data instead

3. Check Supabase connectivity:
   - Open browser on phone
   - Visit https://nfwsbbtmkjpdxgohvhxk.supabase.co
   - Should show Supabase page (not error)

4. Rebuild and reinstall:
   ```bash
   eas build --platform android --profile preview
   adb install -r votekro.apk
   ```

### Build Takes Too Long

**Problem:** Build running for 30+ minutes

**Solution:**

- EAS builds are cached, so first build takes longer (20-30 min)
- Subsequent builds are faster (5-10 min)
- You can cancel with `Ctrl+C` and check status later:
  ```bash
  eas build:list
  ```

---

## Advanced: Rebuild Options

### Clear Cache Before Building

Use when environment variables changed:

```bash
eas build --platform android --profile preview --clear-cache
```

### Use Specific Node Version

```bash
eas build --platform android --profile preview --env NODE_VERSION=18
```

### View Build Logs

After build completes:

```bash
eas build:view <buildId> --logs
```

---

## Next Steps

After successfully building and testing the APK:

1. **Share for Testing** - Send build URL to testers
2. **Collect Feedback** - Find and fix issues
3. **Build Production** - Create optimized production APK when ready
4. **Deploy to Play Store** - (Optional) Submit to Google Play Store for public release

---

## Quick Reference Commands

```bash
# Login to Expo
eas login

# Add environment variables
eas secret:create

# List secrets
eas secret:list

# Build preview APK
eas build --platform android --profile preview

# Build production APK
eas build --platform android --profile production

# List builds
eas build:list

# View build details
eas build:view <buildId>

# Install APK
adb install votekro.apk

# Uninstall app
adb uninstall com.votekro

# View logs
adb logcat | grep VoteKro

# Project info
eas project:info
```

---

## Support & Resources

- **Expo Documentation** - https://docs.expo.dev
- **EAS Build Guide** - https://docs.expo.dev/build/
- **Android Debug Bridge (ADB)** - https://developer.android.com/studio/command-line/adb
- **Supabase Status** - https://status.supabase.com

---

**Last Updated:** May 2026  
**Project:** VoteKro v1.0.0
