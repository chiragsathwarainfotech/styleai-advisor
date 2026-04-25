import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const NotificationService = {
  _userId: null as string | null,
  _currentToken: null as string | null,

  async init() {
    console.log('[Push Diagnostics] init started, isNative:', Capacitor.isNativePlatform());
    if (Capacitor.isNativePlatform()) {
      try {
        // Request Local Notification permissions too for foreground display
        await LocalNotifications.requestPermissions();
        
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

    await PushNotifications.addListener('pushNotificationReceived', async notification => {
      console.info('Push notification received in foreground: ', notification);
      
      // Manually show local notification so it appears in the tray while app is open
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: notification.title || 'Notification',
              body: notification.body || '',
              id: Math.floor(Math.random() * 10000),
              extra: notification.data,
              smallIcon: 'res://ic_stat_name', // Ensure this exists or use default
              schedule: { at: new Date(Date.now() + 100) }
            }
          ]
        });
      } catch (e) {
        console.error('[Push] Error scheduling local notification:', e);
      }
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
