import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type ModelViewerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  'ios-src'?: string;
  ar?: boolean | string;
  'ar-modes'?: string;
  'camera-controls'?: boolean | string;
  'touch-action'?: string;
  poster?: string;
  alt?: string;
  loading?: string;
  reveal?: string;
  'interaction-prompt'?: string;
  'shadow-intensity'?: string;
  'environment-image'?: string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerProps;
    }
  }
}

export {};
