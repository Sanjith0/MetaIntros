import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { API_BASE } from './api';

/** Where the web build of this same app lives (it has Glance at /#/glance). */
const WEB_APP = /^https?:/.test(API_BASE) ? API_BASE : 'https://queueup-expo.vercel.app';

/**
 * True on iOS and Android (Expo Go and the development build alike). Glance's face recognition (face-api +
 * MediaPipe) only runs in the browser build: the native camera has no port of that model yet, and Expo Go has no
 * capture module at all. So phones open Glance in an in-app browser sheet, where the camera scan works.
 */
export const glanceNeedsBrowser = Platform.OS !== 'web';

/** Open a Glance route: in the app on the web; in an in-app browser sheet on phones. */
export function openGlance(path: string) {
  if (!glanceNeedsBrowser) { router.push(path as never); return; }
  void WebBrowser.openBrowserAsync(`${WEB_APP}/#${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: 'done',
  });
}
