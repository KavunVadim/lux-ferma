import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Конфіг нативних застосунків (iOS/Android).
 * Веб-білд (dist) загортається в WebView — один і той самий код, що й на сайті.
 *
 *   npm run build && npx cap add ios     # потрібен Xcode + CocoaPods
 *   npm run build && npx cap add android # потрібен Android Studio + JDK 21
 *   npm run cap:ios / npm run cap:android
 */
const config: CapacitorConfig = {
  appId: 'com.vad.luxferma',
  appName: 'Люкс Ферма',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
