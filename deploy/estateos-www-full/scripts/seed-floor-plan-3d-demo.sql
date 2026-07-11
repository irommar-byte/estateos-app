-- Demo oferta ze skanem LiDAR (spacer 3D).
-- Ręcznie na produkcji: ustaw @offer_id i uruchom w kliencie MySQL.
-- Plik USDZ musi być dostępny publicznie pod floorPlan3dUrl.

SET @offer_id := 580;
SET @demo_usdz := 'https://estateos.pl/uploads/demo/lidar-demo.usdz';
SET @demo_meta := JSON_OBJECT(
  'source', 'lidar-demo-seed',
  'rooms', JSON_ARRAY(
    JSON_OBJECT('name', 'Salon', 'areaSqm', 24.5),
    JSON_OBJECT('name', 'Sypialnia', 'areaSqm', 14.2),
    JSON_OBJECT('name', 'Kuchnia', 'areaSqm', 9.8)
  ),
  'scanDate', DATE_FORMAT(NOW(), '%Y-%m-%d')
);

UPDATE Offer
SET
  floorPlan3dUrl = @demo_usdz,
  floorPlan3dMeta = @demo_meta,
  updatedAt = NOW()
WHERE id = @offer_id;

SELECT id, title, floorPlan3dUrl, floorPlan3dMeta FROM Offer WHERE id = @offer_id;
