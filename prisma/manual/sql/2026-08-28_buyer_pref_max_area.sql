-- Metraż „do” z /szukam — parity z buyer intake (minArea + maxArea).
ALTER TABLE `AgencyClientBuyerPreference`
  ADD COLUMN `maxArea` DOUBLE NULL AFTER `minArea`;
