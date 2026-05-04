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
    await PushNotifications.addListener('registration', async token => {
      console.info('Push registration success, token: ' + token.value);
      this._currentToken = token.value;
      if (this._userId) {
        await this.saveToken(token.value);
      }
    });

    await PushNotifications.addListener('registrationError', err => {
      console.error('Push registration error: ', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', notification => {
      // Foreground delivery: just log. The OS handles tray display from
      // the FCM payload itself; the app no longer schedules a duplicate
      // local notification.
      console.info('Push notification received in foreground:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.info('Push notification action performed', notification.actionId, notification.inputValue);
    });
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
      // We don't throw here to avoid breaking the app boot
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
