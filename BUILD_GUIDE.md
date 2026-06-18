# Build Guide — Styloren

How to build production releases for **Android** (AAB) and **iOS** (IPA).

> All builds follow the same first principle: build the web app → sync it into the
> native project with Capacitor → compile the native artifact.
> Make sure a valid `.env` (from the developer) is in the project root first.

---

## Android

### Option A — Automated script (recommended)

The repo ships [`build-android.sh`](./build-android.sh), which auto-fixes common
build issues, bumps the version, builds the frontend, syncs Capacitor, and produces
a signed release AAB.

```sh
./build-android.sh
```

**What the script does automatically:**

1. **Auto-increments** `versionCode` in `android/app/build.gradle`.
2. **Detects & fixes** known issues:
   - Missing **Foojay toolchain resolver** in `android/settings.gradle`.
   - `minSdkVersion` below **24** (in `android/app/build.gradle` and `android/variables.gradle`).
   - Missing **`androidx.core` version forcing** (`1.13.0`) in `android/build.gradle`.
3. **Builds** the web frontend: `npm run build`.
4. **Syncs** assets: `npx cap sync android`.
5. **Compiles** the release bundle: `./gradlew clean bundleRelease`.
6. **Auto-recovery:** if Gradle fails, it stops the daemon, clears the project
   Gradle caches, and retries once with `--refresh-dependencies`.

**Flags:**

```sh
./build-android.sh            # full build + version bump
./build-android.sh --no-bump  # build without bumping versionCode
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

### Option B — Manual steps

```sh
# 1. Install deps (first time) and ensure .env is present
npm i

# 2. Build the web frontend
npm run build

# 3. Sync into the native Android project
npx cap sync android

# 4. Build the release AAB
cd android
./gradlew clean bundleRelease
cd ..
```

The AAB is written to `android/app/build/outputs/bundle/release/app-release.aab`.
To build an APK instead, use `./gradlew assembleRelease`.

### Signing

Release signing reads credentials from `android/keystore/credentials` (a Java
properties file, **not** committed). It must define:

```properties
storeFile=/absolute/path/to/your.keystore
storePassword=********
keyAlias=********
keyPassword=********
```

Obtain the keystore and credentials from the developer / project owner.

### Requirements

- **JDK 17** (`java -version` should report 17). The project pins Java/Kotlin to 17.
- **Android SDK** with `compileSdkVersion 35` installed (via Android Studio).
- `ANDROID_HOME` / `ANDROID_SDK_ROOT` set, or use Android Studio's bundled SDK.

### Uploading to Google Play

1. Go to **Google Play Console → your app → Production → Create new release**.
2. Upload `app-release.aab`.
3. Each upload must have a **higher `versionCode`** — the script handles this for you.

---

## iOS

iOS builds **require macOS + Xcode** and valid Apple signing certificates /
provisioning profiles. There is no fully headless path for App Store distribution;
the steps below use Xcode for archiving and export.

### Build & sync (CLI)

```sh
# 1. Install deps (first time) and ensure .env is present
npm i

# 2. Build the web frontend
npm run build

# 3. Sync into the native iOS project (installs CocoaPods dependencies)
npx cap sync ios

# 4. Open the project in Xcode
npx cap open ios
```

### Archive & export the IPA (Xcode)

1. In Xcode, open the **`App`** workspace (opened by `npx cap open ios`).
2. Select the **App** target → **Signing & Capabilities** → choose your **Team**
   and ensure a valid **Bundle Identifier** and provisioning profile.
3. Set the build destination to **Any iOS Device (arm64)** (not a simulator).
4. Bump the **Version**/**Build** number under the target's **General** tab if
   submitting a new build.
5. Menu: **Product → Archive**. Wait for the archive to complete.
6. In the **Organizer** window: select the archive → **Distribute App**.
7. Choose **App Store Connect** (for TestFlight/App Store) → **Upload** (or
   **Export** to save an `.ipa` locally).
8. Follow the prompts to sign and upload to **App Store Connect**.

### Command-line archive (optional, advanced)

If your signing is fully configured, you can archive without the Xcode UI:

```sh
cd ios/App

# Archive
xcodebuild -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath build/App.xcarchive \
  archive

# Export the IPA (requires an ExportOptions.plist with your method/teamID)
xcodebuild -exportArchive \
  -archivePath build/App.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ExportOptions.plist
```

A minimal `ExportOptions.plist` for App Store distribution:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
</dict>
</plist>
```

### Requirements

- **macOS** with the latest **Xcode**.
- **CocoaPods** (`sudo gem install cocoapods`).
- An **Apple Developer account** with certificates & provisioning profiles.

---

## Common note

After **any** change to web code, re-run:

```sh
npm run build && npx cap sync <android|ios>
```

to push the latest assets into the native app before building.
