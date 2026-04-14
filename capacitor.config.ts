import type { CapacitorConfig } from '@capacitor/cli';

console.log('--- CAPACITOR CONFIG LOADING ---');
console.log('Platform check - process.argv:', process.argv);

const config: CapacitorConfig = {
  appId: 'app.lovable.styleai', // DEFAULT (matches Android)
  appName: 'Styloren',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

// Override the App ID when running/syncing for iOS
if (process.argv.includes('ios') || process.cwd().includes('ios')) {
  console.log('DETECTED iOS PLATFORM - SETTING appId to com.styloren.app');
  config.appId = 'com.styloren.app';
} else {
  console.log('DEFAULT/ANDROID PLATFORM - appId is app.lovable.styleai');
}

export default config;
