# Walking Paw Mobile Release Checklist

This repo now contains real native app projects generated with Capacitor.

## App Identity

- App name: Walking Paw
- Web/live URL: https://walking-paw.netlify.app/
- Privacy policy URL: https://walking-paw.netlify.app/privacy
- iOS bundle ID: `com.walkingpaw.service`
- Android package name: `com.walkingpaw.service`
- Current version: `1.0`

## What Is Already Set Up

- Android native project: `android/`
- iOS native project: `ios/`
- Capacitor config: `capacitor.config.ts`
- Shared booking backend: `https://walking-paw.netlify.app/api/bookings`
- App icons and splash assets for Android/iOS/PWA
- PWA manifest: `public/manifest.webmanifest`
- CI build check: `.github/workflows/mobile-build.yml`

## Local Commands

Install dependencies:

```powershell
npm install
```

Build and sync web assets into native projects:

```powershell
npm run mobile:sync
```

Open Android Studio:

```powershell
npm run android:open
```

Open Xcode on macOS:

```bash
npm run ios:open
```

## Google Play Release

Required:

- Google Play Console developer account
- JDK 17 or newer
- Android Studio with Android SDK installed
- Upload signing key or Play App Signing setup

Build a release Android App Bundle after signing is configured:

```powershell
cd android
.\gradlew.bat :app:bundleRelease
```

Upload the generated `.aab` from:

```text
android/app/build/outputs/bundle/release/
```

Store listing fields to prepare:

- Short description: Beaumont-side Lexington dog walking booking for Walking Paw Service.
- Full description: Walking Paw lets Beaumont-side Lexington families request dog walks, choose an approved pickup day and time, confirm cash-only pricing, and share pickup details with workers and bosses.
- Category: Lifestyle or Business
- App access: Admin page is password protected; public booking form is available without login.
- Data collection: name, phone, optional email, address/meet spot, dog name, dog size, booking date/time, optional notes.
- Data sharing: not sold; used for scheduling and contact.

## Apple App Store Release

Required:

- Apple Developer Program account
- macOS with Xcode
- App Store Connect app record using bundle ID `com.walkingpaw.service`
- App signing certificate and provisioning profile

Open the iOS project on a Mac:

```bash
npm run ios:open
```

In Xcode:

1. Select the `App` target.
2. Set Team to the Apple Developer account.
3. Confirm Bundle Identifier is `com.walkingpaw.service`.
4. Set version/build number.
5. Archive with `Product > Archive`.
6. Upload through Organizer to App Store Connect.

Store listing fields to prepare:

- Privacy policy URL: https://walking-paw.netlify.app/privacy
- Support URL: https://walking-paw.netlify.app/
- App category: Lifestyle or Business
- Sign-in required: no for public booking; yes for worker/boss admin.
- Data collection: same fields listed under Google Play.

## Current Local Toolchain Limitation

This Windows machine currently has Java 8 and no Android SDK in PATH. Android Gradle requires Java 11 or newer, and JDK 17 is recommended. iOS cannot be built or submitted from Windows; final iOS submission requires macOS and Xcode.
