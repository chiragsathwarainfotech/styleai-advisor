#!/usr/bin/env node
/**
 * Re-applies local iOS plugin fixes after `npm install` (which wipes node_modules).
 *
 * Two Capacitor plugins need SPM fixes to build against this app's Capacitor 8 +
 * Firebase (gtm-session-fetcher 5.x) SPM stack:
 *
 *  1) @capacitor-community/apple-sign-in — widen its capacitor-swift-pm range to
 *     allow 8.x (published Package.swift caps at <8.0.0).
 *
 *  2) @codetrix-studio/capacitor-google-auth — ships CocoaPods-only (no
 *     Package.swift) and uses the GoogleSignIn 6.x API. We add an SPM manifest
 *     (GoogleSignIn 8.x) and replace the Obj-C-registered Plugin.swift with a
 *     pure-Swift CAPBridgedPlugin port of the modern GoogleSignIn API, and drop
 *     the Obj-C registration files that SPM can't compile in a Swift target.
 *
 * Runs as a postinstall hook. Safe to run repeatedly; no-op if packages absent.
 */
import { existsSync, copyFileSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "ios-plugin-patches");

const copy = (from, to) => {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`[patch-ios-plugins] wrote ${to.replace(root + "/", "")}`);
};
const remove = (p) => {
  if (existsSync(p)) {
    rmSync(p);
    console.log(`[patch-ios-plugins] removed ${p.replace(root + "/", "")}`);
  }
};

// 1) apple-sign-in
const apple = join(root, "node_modules/@capacitor-community/apple-sign-in");
if (existsSync(apple)) {
  copy(join(src, "apple-sign-in/Package.swift"), join(apple, "Package.swift"));
}

// 2) google-auth
const google = join(root, "node_modules/@codetrix-studio/capacitor-google-auth");
if (existsSync(google)) {
  copy(join(src, "google-auth/Package.swift"), join(google, "Package.swift"));
  copy(join(src, "google-auth/Plugin.swift"), join(google, "ios/Plugin/Plugin.swift"));
  // Obj-C registration is replaced by the Swift CAPBridgedPlugin conformance;
  // SPM cannot mix Obj-C + Swift in one target.
  remove(join(google, "ios/Plugin/Plugin.m"));
  remove(join(google, "ios/Plugin/Plugin.h"));
}
