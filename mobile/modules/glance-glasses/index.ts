import { requireOptionalNativeModule } from 'expo-modules-core';

export type GlassesState = { configured: boolean; registered: boolean; cameraAllowed: boolean; streaming: boolean; status: string };
type Subscription = { remove(): void };

export type GlanceGlassesModule = {
  getState(): GlassesState;
  refresh(): Promise<GlassesState>;
  register(): Promise<void>;
  allowCamera(): Promise<void>;
  handleURL(url: string): Promise<void>;
  start(): Promise<void>;
  stop(): void;
  addListener(event: 'onFrame', listener: (e: { data: string }) => void): Subscription;
  addListener(event: 'onFailure', listener: (e: { message: string }) => void): Subscription;
  addListener(event: 'onPause', listener: (e: { paused: boolean }) => void): Subscription;
  addListener(event: 'onState', listener: (e: GlassesState) => void): Subscription;
};

// Optional: builds without the module (Expo Go, older installs) just have no glasses option.
export default requireOptionalNativeModule<GlanceGlassesModule>('GlanceGlasses');
