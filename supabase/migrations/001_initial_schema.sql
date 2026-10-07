-- Jedalnicek: Grocery Shopping Automation Schema

-- INGREDIENTS (canonical)
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  default_unit TEXT NOT NULL DEFAULT 'ks',
  category TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RECIPES
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  default_portions INTEGER NOT NULL DEFAULT 2,
  instructions TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RECIPE_INGREDIENTS
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  quantity_per_portion NUMERIC,
  optional BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WEEKLY PLANS
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  raw_message TEXT,
  parsed_plan JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_start)
);

-- WEEKLY PLAN ITEMS
CREATE TABLE weekly_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  recipe_id UUID REFERENCES recipes(id),
  ingredient_id UUID REFERENCES ingredients(id),
  day_start TEXT NOT NULL,
  day_end TEXT NOT NULL,
  portions INTEGER DEFAULT 1,
  quantity NUMERIC,
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INVENTORY
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  status TEXT NOT NULL DEFAULT 'buy_if_needed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ingredient_id)
);

-- PRODUCT MATCHES (Kosik products mapped to ingredients)
CREATE TABLE product_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  kosik_product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT,
  package_value NUMERIC,
  package_unit TEXT,
  last_price NUMERIC,
  last_unit_price NUMERIC,
  unit_price_unit TEXT,
  preferred BOOLEAN NOT NULL DEFAULT false,
  match_confidence TEXT NOT NULL DEFAULT 'medium',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ingredient_id, kosik_product_id)
);

-- SHOPPING RUNS
CREATE TABLE shopping_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id),
  run_day TEXT NOT NULL,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_total INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  items_substituted INTEGER DEFAULT 0,
  estimated_total NUMERIC,
  cart_snapshot JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, run_date)
);

-- SHOPPING RUN ITEMS
CREATE TABLE shopping_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES shopping_runs(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  required_quantity NUMERIC NOT NULL,
  required_unit TEXT NOT NULL,
  product_match_id UUID REFERENCES product_matches(id),
  kosik_product_id INTEGER,
  product_name TEXT,
  package_quantity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  substitution_reason TEXT,
  original_product_name TEXT,
  price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SHOPPING PREFERENCES
CREATE TABLE shopping_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUTOMATION LOGS
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,
  run_id UUID,
  status TEXT NOT NULL DEFAULT 'started',
  error TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- INDEXES
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_weekly_plan_items_plan ON weekly_plan_items(plan_id);
CREATE INDEX idx_product_matches_ingredient ON product_matches(ingredient_id);
CREATE INDEX idx_product_matches_kosik ON product_matches(kosik_product_id);
CREATE INDEX idx_shopping_runs_plan ON shopping_runs(plan_id);
CREATE INDEX idx_shopping_run_items_run ON shopping_run_items(run_id);
CREATE INDEX idx_automation_logs_job ON automation_logs(job, started_at);
CREATE INDEX idx_weekly_plans_week ON weekly_plans(week_start);
