import React from 'react';
import { Image, Platform, View, type ImageStyle, type StyleProp } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * An SVG string drawn as an image. The web build keeps a plain <img> with a data URI (cheap, cached by the browser);
 * iOS and Android (Expo Go) can't decode SVG data URIs, so they draw it with react-native-svg.
 */
export function SvgImage({ xml, width, height, style }: { xml: string; width: number | `${number}%`; height: number; style?: StyleProp<ImageStyle> }) {
  if (Platform.OS === 'web') {
    const uri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
    return <Image source={{ uri }} style={[{ width, height } as ImageStyle, style]} />;
  }
  return <View style={[{ width, height } as ImageStyle, style]}><SvgXml xml={xml} width="100%" height="100%" /></View>;
}
