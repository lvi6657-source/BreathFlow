import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.breathflow.app',
  appName: 'BreathFlow AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
