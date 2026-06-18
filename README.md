# Styloren — AI Style Advisor

Styloren is a cross-platform (iOS, Android, Web) AI styling app. Users capture or
upload outfit photos and get AI-powered style analysis, comparisons, and chat-based
advice. Built with **React + Vite + TypeScript**, wrapped natively with **Capacitor**,
and backed by **Supabase** (auth, database, edge functions) with **RevenueCat** for
in-app purchases.

- **App ID:** `app.lovable.styleai`
- **App Name:** Styloren

---

## App functions & modules

### Frontend pages (`src/pages/`)
| Page | Function |
|------|----------|
| `Index` | Home / landing screen |
| `Auth` | Sign up, login, and guest sign-in |
| `Consent` | User consent capture |
| `Analyze` | Capture/upload an outfit and run AI analysis |
| `ScanHistory` | History of previous outfit scans |
| `Account` | User profile, credits, and subscription |
| `PrivacyPolicy` / `TermsConditions` | Legal pages |
| `NotFound` | 404 fallback |

### Core libraries (`src/lib/`)
| Module | Responsibility |
|--------|----------------|
| `platform.ts` | iOS/Android/web platform detection & logic |
| `guest.ts` | Persistent device ID + guest sign-in / quota tracking |
| `connectivity.ts` | Network/internet connectivity checks |
| `imageCompression.ts` | Compress outfit images before upload |
| `NotificationService.ts` | Push notification registration & handling |
| `utils.ts` | Shared utilities |

### Backend (Supabase edge functions — `supabase/functions/`)
| Function | Responsibility |
|----------|----------------|
| `analyze-outfit` | AI analysis of a single outfit |
| `compare-outfits` | AI comparison between outfits |
| `chat-styloren` | Chat-based styling assistant |
| `log-app-open` | Logs app opens (user name if logged in, else device ID + platform) |
| `log-session-start` | Session start tracking |
| `log-hourly-active-users` | Hourly active-user metrics |
| `on-auth-event` | Reacts to auth events |
| `password-reset` | Password reset flow |
| `delete-user` | Account deletion |

### Key integrations
- **Supabase** — authentication, Postgres database, RLS, edge functions
- **RevenueCat** (`@revenuecat/purchases-capacitor`) — credits & subscriptions
- **Capacitor plugins** — Camera, Push Notifications, App Tracking Transparency

---

## Prerequisites

- **Node.js & npm** ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **Android:** Android Studio + JDK 17 + Android SDK
- **iOS:** macOS + Xcode + CocoaPods (`sudo gem install cocoapods`)
- The **`.env` file** — see below

### Environment variables (`.env`)

The `.env` file is **not** committed to git (it is gitignored). **Request it from the
developer / project owner** and place it in the project root. It must contain:

```sh
VITE_SUPABASE_PROJECT_ID="<supabase-project-ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<supabase-publishable-or-anon-key>"
VITE_SUPABASE_URL="https://<supabase-project-ref>.supabase.co"
```

> Without a valid `.env`, the app cannot connect to Supabase and features such as
> authentication, credits, and app logging will not work.

---

## Run on Web (development)

```sh
# 1. Clone and enter the project
git clone <YOUR_GIT_URL>
cd styleai-advisor

# 2. Install dependencies
npm i

# 3. Add the .env file (obtained from the developer) to the project root

# 4. Start the dev server
npm run dev
```

---

## Run on Android

```sh
# 1. Install dependencies and add the .env file (see above)
npm i

# 2. Build the web assets
npm run build

# 3. Sync the build into the native Android project
npx cap sync android

# 4a. Open in Android Studio (then Run on a device/emulator)
npx cap open android

# 4b. — or — build & run directly on a connected device/emulator
npx cap run android
```

---

## Run on iOS (macOS only)

```sh
# 1. Install dependencies and add the .env file (see above)
npm i

# 2. Build the web assets
npm run build

# 3. Sync the build into the native iOS project (installs CocoaPods)
npx cap sync ios

# 4a. Open in Xcode (select a team/signing, then Run)
npx cap open ios

# 4b. — or — build & run directly on a simulator/device
npx cap run ios
```

> After changing web code, re-run `npm run build && npx cap sync <platform>` to push
> the latest assets into the native app.

---

## Production builds & release

Full step-by-step instructions for producing store-ready artifacts (Android AAB and
iOS IPA), signing, and uploading live in **[BUILD_GUIDE.md](./BUILD_GUIDE.md)**.

### Android — automated build script

[`build-android.sh`](./build-android.sh) produces a signed release **AAB** and
auto-handles common build problems:

```sh
./build-android.sh            # auto-fix, bump versionCode, build AAB
./build-android.sh --no-bump  # build without bumping versionCode
```

It auto-increments `versionCode`, ensures the Foojay toolchain resolver,
`minSdkVersion 24`, and `androidx.core` version forcing are in place, builds the
frontend, runs `npx cap sync android`, and compiles `bundleRelease` — retrying with
a clean Gradle cache/daemon if the first attempt fails.
Output: `android/app/build/outputs/bundle/release/app-release.aab`.

### iOS

iOS requires macOS, Xcode, and Apple signing certificates. See the
**[iOS section of BUILD_GUIDE.md](./BUILD_GUIDE.md#ios)** for archive/export steps.

---

## Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
