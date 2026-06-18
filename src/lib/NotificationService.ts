import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';

// Topics the admin panel (route.js) broadcasts to.
const TOPICS = {
  ios: 'ios_users',
  android: 'android_users',
} as const;

export const NotificationService = {
  async init() {
    console.log('[Push Diagnostics] init started, isNative:', Capacitor.isNativePlatform());
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      console.log('[Push Diagnostics] adding listeners...');
      await this.addListeners();
      console.log('[Push Diagnostics] registering notifications...');
      await this.registerNotifications();
      console.log('[Push Diagnostics] subscribing to topic...');
      await this.subscribeToPlatformTopic();
      console.log('[Push Diagnostics] initialization complete');
    } catch (e) {
      console.error('[Push Diagnostics] NotificationService init failed:', e);
    }
  },

  async addListeners() {
    // FCM token issued / refreshed
    await FirebaseMessaging.addListener('tokenReceived', event => {
      console.info('Push registration success, token: ' + event.token);
    });

    // Foreground notification
    await FirebaseMessaging.addListener('notificationReceived', event => {
      console.info('Push notification received: ', event.notification);
    });

    // User tapped a notification
    await FirebaseMessaging.addListener('notificationActionPerformed', event => {
      console.info('Push notification action performed', event.actionId, event.notification);
    });
  },

  async registerNotifications() {
    console.log('[Push Diagnostics] checking permissions...');
    let permStatus = await FirebaseMessaging.checkPermissions();
    console.log('[Push Diagnostics] initial permStatus:', permStatus);

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      console.log('[Push Diagnostics] prompting for permissions...');
      permStatus = await FirebaseMessaging.requestPermissions();
      console.log('[Push Diagnostics] new permStatus:', permStatus);
    }

    if (permStatus.receive !== 'granted') {
      console.log('[Push Diagnostics] User denied permissions!');
      throw new Error('User denied permissions!');
    }

    try {
      // Triggers APNs/FCM registration and resolves with the FCM token.
      const { token } = await FirebaseMessaging.getToken();
      console.log('[Push Diagnostics] FCM token acquired:', token);
    } catch (e) {
      console.error('[Push Diagnostics] Failed to get FCM token:', e);
      // Don't rethrow — topic subscription can still proceed once registered.
    }
  },

  async subscribeToPlatformTopic() {
    const platform = Capacitor.getPlatform();
    const topic = platform === 'ios' ? TOPICS.ios : TOPICS.android;
    try {
      await FirebaseMessaging.subscribeToTopic({ topic });
      console.log('[Push Diagnostics] subscribed to topic:', topic);
    } catch (e) {
      console.error('[Push Diagnostics] Failed to subscribe to topic:', topic, e);
    }
  },

  async unsubscribeFromPlatformTopic() {
    const platform = Capacitor.getPlatform();
    const topic = platform === 'ios' ? TOPICS.ios : TOPICS.android;
    try {
      await FirebaseMessaging.unsubscribeFromTopic({ topic });
      console.log('[Push Diagnostics] unsubscribed from topic:', topic);
    } catch (e) {
      console.error('[Push Diagnostics] Failed to unsubscribe from topic:', topic, e);
    }
  },

  async getDeliveredNotifications() {
    const { notifications } = await FirebaseMessaging.getDeliveredNotifications();
    console.info('delivered notifications', notifications);
  },
};
