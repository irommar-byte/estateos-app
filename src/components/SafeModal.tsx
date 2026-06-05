import React from 'react';
import { Modal, type ModalProps } from 'react-native';

type Props = ModalProps & {
  visible: boolean;
};

/**
 * RN Modal z visible={false} na iOS potrafi nadal przechwytywać dotyk całej aplikacji.
 * Montujemy natywny Modal tylko gdy sheet ma być faktycznie otwarty.
 */
export default function SafeModal({ visible, children, ...rest }: Props) {
  if (!visible) return null;
  return (
    <Modal visible {...rest}>
      {children}
    </Modal>
  );
}
