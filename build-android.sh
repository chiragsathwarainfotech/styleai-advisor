#!/usr/bin/env bash
#
# build-android.sh — Automated Android (AAB) build with auto-fixes.
#
# What it does:
#   1. Auto-increments versionCode in android/app/build.gradle.
#   2. Detects & auto-fixes common build issues:
#        - Missing Foojay toolchain resolver in android/settings.gradle
#        - minSdkVersion below 24 (in app/build.gradle and variables.gradle)
#        - Missing androidx.core version forcing in android/build.gradle
#   3. Builds the web frontend (npm run build).
#   4. Syncs assets into the native project (npx cap sync android).
#   5. Compiles the release AAB (./gradlew clean bundleRelease).
#   6. On Gradle failure: stops the daemon, clears caches, and retries once.
#
# Usage:
#   ./build-android.sh            # full build with version bump
#   ./build-android.sh --no-bump  # build without incrementing versionCode
#
set -uo pipefail

# --- Resolve paths -----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ANDROID_DIR="$SCRIPT_DIR/android"
APP_GRADLE="$ANDROID_DIR/app/build.gradle"
ROOT_GRADLE="$ANDROID_DIR/build.gradle"
SETTINGS_GRADLE="$ANDROID_DIR/settings.gradle"
VARIABLES_GRADLE="$ANDROID_DIR/variables.gradle"

MIN_SDK=24
ANDROIDX_CORE_VERSION="1.13.0"
FOOJAY_VERSION="0.8.0"
BUMP_VERSION=1

for arg in "$@"; do
  case "$arg" in
    --no-bump) BUMP_VERSION=0 ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# --- Logging helpers ---------------------------------------------------------
c_green="\033[0;32m"; c_yellow="\033[1;33m"; c_red="\033[0;31m"; c_blue="\033[0;34m"; c_reset="\033[0m"
info()  { echo -e "${c_blue}[INFO]${c_reset}  $*"; }
ok()    { echo -e "${c_green}[OK]${c_reset}    $*"; }
warn()  { echo -e "${c_yellow}[FIX]${c_reset}   $*"; }
err()   { echo -e "${c_red}[ERROR]${c_reset} $*" >&2; }

require_file() {
  if [[ ! -f "$1" ]]; then
    err "Expected file not found: $1"
    err "Are you running this from the project root with the Android platform added?"
    exit 1
  fi
}

require_file "$APP_GRADLE"
require_file "$ROOT_GRADLE"
require_file "$SETTINGS_GRADLE"

# =============================================================================
# 1. Auto-fixes
# =============================================================================
info "Inspecting Gradle configuration for known issues..."

# --- Fix: Foojay toolchain resolver in settings.gradle -----------------------
fix_foojay() {
  if grep -q "foojay-resolver-convention" "$SETTINGS_GRADLE"; then
    ok "Foojay toolchain resolver present."
    return
  fi
  warn "Foojay toolchain resolver missing — injecting into settings.gradle."
  local tmp; tmp="$(mktemp)"
  {
    echo "plugins {"
    echo "    id 'org.gradle.toolchains.foojay-resolver-convention' version '${FOOJAY_VERSION}'"
    echo "}"
    echo ""
    cat "$SETTINGS_GRADLE"
  } > "$tmp"
  mv "$tmp" "$SETTINGS_GRADLE"
  ok "Foojay resolver added."
}

# --- Fix: minSdkVersion >= 24 ------------------------------------------------
# Handles both "minSdkVersion 23" (app/build.gradle) and
# "minSdkVersion = 23" (variables.gradle).
fix_min_sdk_in() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  # Capture current value (first match) regardless of "=" presence.
  local current
  current="$(grep -Eo "minSdkVersion[[:space:]]*=?[[:space:]]*[0-9]+" "$file" | grep -Eo "[0-9]+" | head -n1)"
  [[ -z "$current" ]] && return 0
  if (( current >= MIN_SDK )); then
    ok "minSdkVersion in $(basename "$file") is $current (>= $MIN_SDK)."
    return
  fi
  warn "minSdkVersion in $(basename "$file") is $current — raising to $MIN_SDK."
  perl -0pi -e "s/(minSdkVersion\s*=?\s*)[0-9]+/\${1}${MIN_SDK}/" "$file"
  ok "minSdkVersion set to $MIN_SDK in $(basename "$file")."
}

# --- Fix: androidx.core resolutionStrategy force in build.gradle -------------
fix_androidx_core() {
  if grep -q "force 'androidx.core:core:" "$ROOT_GRADLE" || \
     grep -q 'force "androidx.core:core:' "$ROOT_GRADLE"; then
    ok "androidx.core version forcing present."
    return
  fi
  warn "androidx.core version forcing missing — appending subprojects block to build.gradle."
  cat >> "$ROOT_GRADLE" <<EOF

// [auto-fix] Force androidx.core to avoid AGP/compileSdk conflicts.
subprojects {
    configurations.all {
        resolutionStrategy {
            force 'androidx.core:core:${ANDROIDX_CORE_VERSION}'
            force 'androidx.core:core-ktx:${ANDROIDX_CORE_VERSION}'
        }
    }
}
EOF
  ok "androidx.core forcing appended."
}

fix_foojay
fix_min_sdk_in "$APP_GRADLE"
fix_min_sdk_in "$VARIABLES_GRADLE"
fix_androidx_core

# =============================================================================
# 2. Auto-increment versionCode
# =============================================================================
bump_version() {
  local current
  current="$(grep -Eo "versionCode[[:space:]]+[0-9]+" "$APP_GRADLE" | grep -Eo "[0-9]+" | head -n1)"
  if [[ -z "$current" ]]; then
    err "Could not find versionCode in $APP_GRADLE"
    exit 1
  fi
  if (( BUMP_VERSION == 0 )); then
    info "Skipping version bump (--no-bump). Current versionCode: $current"
    return
  fi
  local next=$(( current + 1 ))
  perl -0pi -e "s/(versionCode\s+)[0-9]+/\${1}${next}/" "$APP_GRADLE"
  ok "versionCode bumped: $current -> $next"
}
bump_version

# =============================================================================
# 3. Build web frontend
# =============================================================================
info "Building web frontend (npm run build)..."
if ! npm run build; then
  err "Frontend build failed. Fix the errors above and re-run."
  exit 1
fi
ok "Frontend built."

# =============================================================================
# 4. Capacitor sync
# =============================================================================
info "Syncing web assets into Android project (npx cap sync android)..."
if ! npx cap sync android; then
  err "Capacitor sync failed."
  exit 1
fi
ok "Capacitor sync complete."

# =============================================================================
# 5 & 6. Gradle bundleRelease with retry
# =============================================================================
run_gradle() {
  ( cd "$ANDROID_DIR" && ./gradlew clean bundleRelease )
}

clean_gradle_caches() {
  warn "Cleaning Gradle daemon and caches before retry..."
  ( cd "$ANDROID_DIR" && ./gradlew --stop ) || true
  rm -rf "$ANDROID_DIR/.gradle" "$ANDROID_DIR/app/build" "$ANDROID_DIR/build" 2>/dev/null || true
  ok "Project Gradle caches cleared."
}

info "Compiling release AAB (./gradlew clean bundleRelease)..."
if run_gradle; then
  BUILD_OK=1
else
  err "Gradle build failed — attempting auto-recovery."
  clean_gradle_caches
  info "Retrying Gradle build with --refresh-dependencies..."
  if ( cd "$ANDROID_DIR" && ./gradlew clean bundleRelease --refresh-dependencies ); then
    BUILD_OK=1
  else
    BUILD_OK=0
  fi
fi

AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
if [[ "${BUILD_OK:-0}" == "1" && -f "$AAB_PATH" ]]; then
  echo ""
  ok "Build succeeded!"
  ok "AAB: $AAB_PATH"
  ls -lh "$AAB_PATH"
else
  err "Build failed even after auto-recovery."
  err "Check the Gradle output above. Common manual steps:"
  err "  - Ensure JDK 17 is active (java -version)"
  err "  - Verify android/keystore/credentials exists for release signing"
  exit 1
fi
