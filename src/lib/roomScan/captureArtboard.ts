import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import type Svg from 'react-native-svg';

type SvgNode = Svg & {
  toDataURL?: (callback: (base64: string) => void, options?: object) => void;
};

export async function captureSvgToPng(svgRef: RefObject<SvgNode | null>): Promise<string> {
  const node = svgRef.current;
  if (!node?.toDataURL) {
    throw new Error('svg capture target missing');
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((resolve) => setTimeout(resolve, 120));

  const base64 = await new Promise<string>((resolve, reject) => {
    try {
      node.toDataURL((data) => {
        if (!data) {
          reject(new Error('empty svg export'));
          return;
        }
        resolve(data.replace(/^data:image\/png;base64,/, ''));
      });
    } catch (error) {
      reject(error);
    }
  });

  const uri = `${FileSystem.cacheDirectory}floorplan-${Date.now()}.png`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

export async function captureViewToPng(ref: RefObject<View | null>): Promise<string> {
  if (!ref.current) {
    throw new Error('capture target missing');
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((resolve) => setTimeout(resolve, 120));

  return captureRef(ref, {
    format: 'png',
    quality: 0.92,
    result: 'tmpfile',
    snapshotContentContainer: true,
  });
}

export async function captureArtboardToPng(
  svgRef: RefObject<SvgNode | null>,
  viewRef: RefObject<View | null>,
): Promise<string> {
  try {
    return await captureSvgToPng(svgRef);
  } catch {
    return captureViewToPng(viewRef);
  }
}
