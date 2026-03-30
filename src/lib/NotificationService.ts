import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export const NotificationService = {
  async init() {
    if (Capacitor.isNativePlatform()) {
      try {
        await this.addListeners();
        await this.registerNotifications();
      } catch (e) {
        console.error('NotificationService init failed:', e);
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
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      throw new Error('User denied permissions!');
    }

    try {
      await PushNotifications.register();
    } catch (e) {
      console.error('Failed to register push notifications. This is likely due to missing google-services.json or Google Play Services.', e);
      // We don't rethrow here to prevent crashing the app boot
    }

  },

  async getDeliveredNotifications() {
    const notificationList = await PushNotifications.getDeliveredNotifications();
    console.info('delivered notifications', notificationList);
  },
};
