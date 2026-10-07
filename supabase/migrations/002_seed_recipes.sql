-- Seed starter recipes and ingredients

-- INGREDIENTS
INSERT INTO ingredients (canonical_name, aliases, default_unit, category) VALUES
  ('kuracie prsia', ARRAY['chicken breast', 'kuracie', 'chicken'], 'g', 'meat'),
  ('ryza', ARRAY['rice', 'basmati', 'jasminova ryza'], 'g', 'dry_food'),
  ('kokosove mlieko', ARRAY['coconut milk', 'kokosove mleko'], 'plechovka', 'dry_food'),
  ('cibula', ARRAY['onion', 'cipula'], 'ks', 'vegetables'),
  ('cesnak', ARRAY['garlic', 'cesnok'], 'stucik', 'vegetables'),
  ('kari korenie', ARRAY['curry seasoning', 'curry powder', 'kari'], 'lzicka', 'dry_food'),
  ('losos', ARRAY['salmon', 'lososos filet'], 'g', 'fish'),
  ('zemiaky', ARRAY['potatoes', 'brambory'], 'g', 'vegetables'),
  ('olivovy olej', ARRAY['olive oil', 'olej'], 'lzica', 'dry_food'),
  ('sol', ARRAY['salt'], 'lzicka', 'dry_food'),
  ('cierny korenie', ARRAY['black pepper', 'pepper', 'korenie'], 'lzicka', 'dry_food'),
  ('citron', ARRAY['lemon', 'citron'], 'ks', 'fruit'),
  ('cestoviny', ARRAY['pasta', 'spagety', 'penne', 'fusilli'], 'g', 'dry_food'),
  ('tuniakova konzerva', ARRAY['canned tuna', 'tuniak', 'tuna'], 'plechovka', 'fish'),
  ('paradajkova omacka', ARRAY['tomato sauce', 'passata', 'paradajky'], 'ml', 'dry_food'),
  ('parmezanovy syr', ARRAY['parmesan', 'parmezan', 'parmigiano'], 'g', 'dairy'),
  ('maslo', ARRAY['butter'], 'g', 'dairy'),
  ('vajcia', ARRAY['eggs', 'vajicka'], 'ks', 'dairy'),
  ('mlieko', ARRAY['milk', 'mleko'], 'l', 'dairy'),
  ('chlieb', ARRAY['bread', 'pecivo'], 'ks', 'bakery'),
  ('banany', ARRAY['bananas', 'banan'], 'ks', 'fruit'),
  ('mineralna voda', ARRAY['mineral water', 'mineralka'], 'ks', 'drinks'),
  ('paprika', ARRAY['bell pepper', 'pepper'], 'ks', 'vegetables'),
  ('brokolica', ARRAY['broccoli'], 'ks', 'vegetables'),
  ('smotana na varenie', ARRAY['cooking cream', 'smotana'], 'ml', 'dairy');

-- RECIPES

-- 1. Chicken Curry
WITH r AS (
  INSERT INTO recipes (name, aliases, default_portions, instructions)
  VALUES ('Chicken Curry', ARRAY['kuracie kari', 'curry', 'kari'], 2,
    'Opraz cibulu, pridaj kari, kuracie, kokosove mlieko. Var 20 min. Podavaj s ryzou.')
  RETURNING id
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, quantity_per_portion)
SELECT r.id, i.id, v.quantity, v.unit, v.qpp
FROM r, (VALUES
  ('kuracie prsia', 500, 'g', 250),
  ('ryza', 250, 'g', 125),
  ('kokosove mlieko', 1, 'plechovka', NULL),
  ('cibula', 1, 'ks', NULL),
  ('cesnak', 2, 'stucik', 1),
  ('kari korenie', 2, 'lzicka', 1),
  ('olivovy olej', 1, 'lzica', NULL),
  ('sol', 1, 'lzicka', NULL)
) AS v(name, quantity, unit, qpp)
JOIN ingredients i ON i.canonical_name = v.name;

-- 2. Losos so zemiakmi
WITH r AS (
  INSERT INTO recipes (name, aliases, default_portions, instructions)
  VALUES ('Losos so zemiakmi', ARRAY['salmon with potatoes', 'losos', 'salmon'], 2,
    'Opec lososa na panvici, zemiaky uvar. Podavaj s citronom a olivovym olejom.')
  RETURNING id
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, quantity_per_portion)
SELECT r.id, i.id, v.quantity, v.unit, v.qpp
FROM r, (VALUES
  ('losos', 400, 'g', 200),
  ('zemiaky', 600, 'g', 300),
  ('olivovy olej', 2, 'lzica', 1),
  ('citron', 1, 'ks', NULL),
  ('sol', 1, 'lzicka', NULL),
  ('cierny korenie', 1, 'lzicka', NULL)
) AS v(name, quantity, unit, qpp)
JOIN ingredients i ON i.canonical_name = v.name;

-- 3. Cestoviny s tuniakom
WITH r AS (
  INSERT INTO recipes (name, aliases, default_portions, instructions)
  VALUES ('Cestoviny s tuniakom', ARRAY['pasta with tuna', 'tuniak cestoviny', 'tuna pasta'], 2,
    'Uvar cestoviny. Na panvici opraz cesnak, pridaj paradajkovu omacku a tuniaka. Zmiesaj.')
  RETURNING id
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, quantity_per_portion)
SELECT r.id, i.id, v.quantity, v.unit, v.qpp
FROM r, (VALUES
  ('cestoviny', 400, 'g', 200),
  ('tuniakova konzerva', 2, 'plechovka', 1),
  ('paradajkova omacka', 400, 'ml', 200),
  ('cesnak', 3, 'stucik', NULL),
  ('olivovy olej', 2, 'lzica', 1),
  ('parmezanovy syr', 50, 'g', 25),
  ('sol', 1, 'lzicka', NULL)
) AS v(name, quantity, unit, qpp)
JOIN ingredients i ON i.canonical_name = v.name;

-- 4. Kuracie s brokolicou
WITH r AS (
  INSERT INTO recipes (name, aliases, default_portions, instructions)
  VALUES ('Kuracie s brokolicou', ARRAY['chicken broccoli', 'kuracie brokolica'], 2,
    'Opraz kuracie, pridaj brokolicu a smotanu. Podavaj s ryzou.')
  RETURNING id
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, quantity_per_portion)
SELECT r.id, i.id, v.quantity, v.unit, v.qpp
FROM r, (VALUES
  ('kuracie prsia', 500, 'g', 250),
  ('brokolica', 1, 'ks', NULL),
  ('smotana na varenie', 200, 'ml', 100),
  ('ryza', 250, 'g', 125),
  ('cesnak', 2, 'stucik', 1),
  ('olivovy olej', 1, 'lzica', NULL),
  ('sol', 1, 'lzicka', NULL),
  ('cierny korenie', 1, 'lzicka', NULL)
) AS v(name, quantity, unit, qpp)
JOIN ingredients i ON i.canonical_name = v.name;

-- 5. Losos s ryzou
WITH r AS (
  INSERT INTO recipes (name, aliases, default_portions, instructions)
  VALUES ('Losos s ryzou', ARRAY['salmon rice', 'losos ryza'], 2,
    'Opec lososa, uvar ryzu. Podavaj so zeleninou.')
  RETURNING id
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, quantity_per_portion)
SELECT r.id, i.id, v.quantity, v.unit, v.qpp
FROM r, (VALUES
  ('losos', 400, 'g', 200),
  ('ryza', 250, 'g', 125),
  ('paprika', 1, 'ks', NULL),
  ('cibula', 1, 'ks', NULL),
  ('olivovy olej', 2, 'lzica', 1),
  ('sol', 1, 'lzicka', NULL)
) AS v(name, quantity, unit, qpp)
JOIN ingredients i ON i.canonical_name = v.name;

-- DEFAULT SHOPPING PREFERENCES
INSERT INTO shopping_preferences (key, value) VALUES
  ('preferred_brands', '[]'::jsonb),
  ('blocked_brands', '[]'::jsonb),
  ('max_acceptable_price', '50'::jsonb),
  ('prefer_cheapest_per_unit', 'true'::jsonb),
  ('allow_substitutions', 'true'::jsonb),
  ('max_substitution_price_diff', '2'::jsonb),
  ('min_match_confidence', '"medium"'::jsonb);
