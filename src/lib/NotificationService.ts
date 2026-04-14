import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const NotificationService = {
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

  async addListeners() {
    await PushNotifications.addListener('registration', token => {
      console.info('Push registration success, token: ' + token.value);
      // For verification purposes, show a visual sign
      // window.alert('Push registration successful!');
    });

    await PushNotifications.addListener('registrationError', err => {
      console.error('Push registration error: ', err.error);
      // window.alert('Push registration failed. See console.');
    });



    await PushNotifications.addListener('pushNotificationReceived', notification => {
      console.info('Push notification received: ', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.info('Push notification action performed', notification.actionId, notification.inputValue);
    });
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
      throw new Error('User denied permissions!');
    }

    try {
      console.log('[Push Diagnostics] calling PushNotifications.register()...');
      await PushNotifications.register();
      console.log('[Push Diagnostics] registration call successful!');
    } catch (e) {
      console.error('[Push Diagnostics] Failed to register push notifications:', e);
      // We don't rethrow here to prevent crashing the app boot
    }
  },

  async getDeliveredNotifications() {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    console.info('delivered notifications', notificationList);
  },
};
