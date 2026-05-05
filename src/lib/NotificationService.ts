import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const NotificationService = {
  _userId: null as string | null,
  _currentToken: null as string | null,

  async init() {
    console.log('[Push Diagnostics] init started, isNative:', Capacitor.isNativePlatform());
    if (Capacitor.isNativePlatform()) {
      try {
        console.log('[Push Diagnostics] adding listeners...');
        await this.addListeners();
        console.log('[Push Diagnostics] registering notifications...');
        await this.registerNotifications();
        console.log('[Push Diagnostics] initialization complete');
      } catch (e) {
        console.error('[Push Diagnostics] NotificationService init failed:', e);
      }
    }
  },

  async setUserId(userId: string | null) {
    this._userId = userId;
    if (userId && this._currentToken) {
      await this.saveToken(this._currentToken);
    }
  },

  async addListeners() {
    // On iOS, the token from @capacitor/push-notifications is a raw APNs
    // device token, which our webhook (FCM v1) cannot deliver to. Instead
    // we ask Firebase Messaging for the FCM registration token — Firebase
    // exchanges the APNs token internally and returns an FCM token that
    // our webhook already knows how to send to.
    //
    // On Android, @capacitor/push-notifications already returns an FCM
    // token via Google Play Services, so we use it as-is.
    await PushNotifications.addListener('registration', async (token) => {
      const platform = Capacitor.getPlatform();
      console.info(`[Push] registration event on ${platform}`);

      if (platform === 'ios') {
        try {
          const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
          const result = await FirebaseMessaging.getToken();
          if (!result?.token) throw new Error('Firebase Messaging returned no token');
          console.info('[Push] iOS FCM token acquired');
          this._currentToken = result.token;
          if (this._userId) await this.saveToken(result.token);
        } catch (e) {
          console.error('[Push] Failed to acquire iOS FCM token:', e);
          // Fall back to APNs-shaped token so something is saved — webhook
          // will fail to deliver but at least we have visibility.
          this._currentToken = token.value;
          if (this._userId) await this.saveToken(token.value);
        }
      } else {
        console.info('[Push] Android FCM token acquired');
        this._currentToken = token.value;
        if (this._userId) await this.saveToken(token.value);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error: ', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground delivery: just log. The OS handles tray display from
      // the FCM payload itself.
      console.info('Push notification received in foreground:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.info('Push notification action performed', notification.actionId, notification.inputValue);
    });

    // Listen for FCM token refreshes on iOS (Firebase issues a new token
    // periodically or when APNs token rotates).
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        await FirebaseMessaging.addListener('tokenReceived', async (event) => {
          if (!event?.token || event.token === this._currentToken) return;
          console.info('[Push] iOS FCM token refreshed');
          this._currentToken = event.token;
          if (this._userId) await this.saveToken(event.token);
        });
      } catch (e) {
        console.warn('[Push] Could not attach Firebase tokenReceived listener:', e);
      }
    }
  },

  async saveToken(token: string) {
    if (!this._userId) return;

    try {
      const platform = Capacitor.getPlatform();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await supabase.functions.invoke('register-push-token', {
        body: { token, platform },
      });

      if (response.error) {
        console.error('[Push Diagnostics] Error saving token via Edge Function:', response.error);
      } else {
        console.log('[Push Diagnostics] Token saved to DB successfully via Edge Function');
      }
    } catch (e) {
      console.error('[Push Diagnostics] unexpected error in saveToken:', e);
    }
  },

  async registerNotifications() {
    console.log('[Push Diagnostics] checking permissions...');
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[Push Diagnostics] initial permStatus:', permStatus);

    if (permStatus.receive === 'prompt') {
      console.log('[Push Diagnostics] prompting for permissions...');
      permStatus = await PushNotifications.requestPermissions();
      console.log('[Push Diagnostics] new permStatus:', permStatus);
    }

    if (permStatus.receive !== 'granted') {
      console.log('[Push Diagnostics] User denied permissions!');
      return;
    }

    try {
      console.log('[Push Diagnostics] calling PushNotifications.register()...');
      await PushNotifications.register();
      console.log('[Push Diagnostics] registration call successful!');
    } catch (e) {
      console.error('[Push Diagnostics] Failed to register push notifications:', e);
    }
  },

  async getDeliveredNotifications() {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    console.info('delivered notifications', notificationList);
  },
};
