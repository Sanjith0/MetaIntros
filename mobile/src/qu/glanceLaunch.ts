import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import captureModule from '../../modules/glance-capture';
import { API_BASE } from './api';

/** Where the web build of this same app lives (it has Glance at /#/glance). */
const WEB_APP = /^https?:/.test(API_BASE) ? API_BASE : 'https://queueup-expo.vercel.app';

/**
 * True in Expo Go: Glance's native capture (camera, face recognition, microphone) needs the iPhone development
 * build, which Expo Go doesn't contain. The browser version captures through the phone's camera instead.
 */
export const glanceNeedsBrowser = Platform.OS !== 'web' && !captureModule;

/** Open a Glance route: in-app on the web and in the dev build; in an in-app browser sheet from Expo Go. */
export function openGlance(path: string) {
  if (!glanceNeedsBrowser) { router.push(path as never); return; }
  void WebBrowser.openBrowserAsync(`${WEB_APP}/#${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    dismissButtonStyle: 'done',
  });
}
