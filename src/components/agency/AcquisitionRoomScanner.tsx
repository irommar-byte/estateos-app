import React from 'react';
import PropertyRoomScanWorkspace from '../roomScan/PropertyRoomScanWorkspace';
import type { PropertyRoomScan, WholePropertyScan } from '../../types/roomScan';

export type RoomItem = PropertyRoomScan;

export default function AcquisitionRoomScanner({
  rooms,
  planImages,
  onChangeRooms,
  onChangePlanImages,
  wholeScan,
  onChangeWholeScan,
  isDark,
  disabled,
  autoOpen,
}: {
  rooms: RoomItem[];
  planImages: string[];
  onChangeRooms: (rooms: RoomItem[]) => void;
  onChangePlanImages: (images: string[]) => void;
  wholeScan?: WholePropertyScan | null;
  onChangeWholeScan?: (scan: WholePropertyScan | null) => void;
  isDark?: boolean;
  disabled?: boolean;
  autoOpen?: boolean;
}) {
  return (
    <PropertyRoomScanWorkspace
      rooms={rooms}
      onChangeRooms={onChangeRooms}
      wholeScan={wholeScan}
      onChangeWholeScan={onChangeWholeScan}
      planImages={planImages}
      onChangePlanImages={onChangePlanImages}
      isDark={isDark}
      disabled={disabled}
      autoOpen={autoOpen}
    />
  );
}
