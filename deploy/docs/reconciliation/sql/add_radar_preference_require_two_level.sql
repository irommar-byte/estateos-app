-- RadarPreference.requireTwoLevel — parity z aplikacją mobilną (RadarCalibrationModal).
ALTER TABLE "RadarPreference"
  ADD COLUMN IF NOT EXISTS "requireTwoLevel" BOOLEAN NOT NULL DEFAULT false;
