UPDATE mission_trips SET place_id=(SELECT id FROM mission_places WHERE name='NEUQUÉN' ORDER BY id LIMIT 1) WHERE place_id='a7f883c7-46af-4220-8dd1-b7373be15802' AND EXISTS (SELECT 1 FROM mission_places WHERE id='a7f883c7-46af-4220-8dd1-b7373be15802' AND name='NEUQUEN') AND EXISTS (SELECT 1 FROM mission_places WHERE name='NEUQUÉN');
--> statement-breakpoint
DELETE FROM mission_places WHERE id='a7f883c7-46af-4220-8dd1-b7373be15802' AND name='NEUQUEN' AND EXISTS (SELECT 1 FROM mission_places WHERE name='NEUQUÉN');
--> statement-breakpoint
UPDATE mission_trips SET place_id=(SELECT id FROM mission_places WHERE name='CUTRAL CÓ' ORDER BY id LIMIT 1) WHERE place_id='9489bba6-2f3b-46d7-8efb-15fb24985801' AND EXISTS (SELECT 1 FROM mission_places WHERE id='9489bba6-2f3b-46d7-8efb-15fb24985801' AND name='CUTRAL CO') AND EXISTS (SELECT 1 FROM mission_places WHERE name='CUTRAL CÓ');
--> statement-breakpoint
DELETE FROM mission_places WHERE id='9489bba6-2f3b-46d7-8efb-15fb24985801' AND name='CUTRAL CO' AND EXISTS (SELECT 1 FROM mission_places WHERE name='CUTRAL CÓ');
