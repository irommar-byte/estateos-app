-- Minimalna liczba pokoi z ankiety / nauki Intelligence.
ALTER TABLE `AgencyClientBuyerPreference`
  ADD COLUMN `minRooms` INT NULL AFTER `maxArea`,
  ADD COLUMN `maxRooms` INT NULL AFTER `minRooms`;
