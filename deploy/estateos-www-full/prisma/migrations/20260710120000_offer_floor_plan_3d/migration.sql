-- LiDAR room scan: 3D model (USDZ) + metadata JSON for interactive floor plan
ALTER TABLE `Offer` ADD COLUMN `floorPlan3dUrl` VARCHAR(191) NULL;
ALTER TABLE `Offer` ADD COLUMN `floorPlanScanMeta` TEXT NULL;
