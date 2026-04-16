import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tadeo.ravesync',
  appName: 'RaveSync',
  webDir: 'dist',
  server: {
    allowNavigation: ['*'],
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: true
  },
  ios: {
    // Allow all web content — needed for InAppBrowser on iOS
    contentInset: 'always',
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  }
};

export default config;
