# Jedalnicek - Architecture & Implementation Plan

## 1. VERIFIED FACTS ABOUT KOSIK.SK

### Technology Stack
- **Frontend**: Vue.js SPA (Vite build, client-side rendered)
- **Shared codebase**: with kosik.cz (Czech sister site)
- **Search provider**: Constructor.io (external) + internal Elasticsearch
- **Auth providers**: Email/password, Facebook, Apple, Google (social SSO)
- **Auth system**: Custom auth service at `auth-eoc.kosik.group`

### API Base
All API endpoints are prefixed with:
```
https://www.kosik.sk/api/front/
```
Responses are JSON. Error responses include structured `status`, `type`, `title`, `detail` fields.

### Suggest/Search API (NO AUTH REQUIRED)
```
GET /api/front/suggest/v2?query={term}
```
Returns:
```json
{
  "products": {
    "items": [
      {
        "id": 19868,
        "name": "Aro Kokosove mlieko",
        "cleanName": "Kokosove mlieko",
        "brand": { "id": 119, "name": "Aro", "url": "/b119-aro" },
        "price": 1.99,
        "unit": "ks",
        "url": "/p19868-aro-kokosove-mlieko",
        "productQuantity": { "prefix": "cca", "value": 400.0, "unit": "g" },
        "pricePerUnit": { "price": 4.975, "unit": "kg" },
        "maxInCart": 50,
        "availability": [
          { "date": "2026-10-07", "quantity": 100 }
        ],
        "isSale": false,
        "percentageDiscount": 0,
        "mainCategory": { "id": 3820, "name": "Trvanlive potraviny" },
        "favorite": false,
        "purchased": false,
        "unitStep": 1.0,
        "vendorId": 1,
        "countryCode": "SVK"
      }
    ]
  },
  "categories": { "items": [...] },
  "brands": { "items": [...] },
  "otherProducts": ...,
  "dataSourceEndpoint": "autocomplete",
  "deliverTodayApplied": false
}
```

### Product URL Pattern
```
/p{id}-{slug}
Example: /p19868-aro-kokosove-mlieko
```

### Category URL Pattern
```
/c{id}-{slug}
Example: /c3085-maso-a-ryby
```

### Cart/Shopping API (AUTH REQUIRED)
```
GET  /api/front/cart                              - get cart contents
POST /api/front/cart                              - modify cart
GET  /api/front/shopping/state/basket             - get basket state
POST /api/front/shopping/state/basket/:id         - update basket item
     /api/front/cart/replacements                 - product replacements
```

### Other Key Endpoints
```
/api/front/product/:productId                     - product details
/api/front/product/slug/:slug                     - product by slug
/api/front/auth/logout                            - logout
/api/front/shopping-list/                         - shopping lists
/api/front/shopping-list/from-cart                - create list from cart
/api/front/shopping-list/:id/add-to-cart          - add list to cart
/api/front/checkout/*                             - checkout (NEVER USE)
```

### Cart Page URL
```
https://www.kosik.sk/basket
```

### Image URLs
```
https://static-new.kosik.sk/k3wCdnContainerk3w-static-ne-sk-prod/images/thumbs/{hash}/WIDTHxHEIGHTx1_{hash}.{ext}
```

### Key Product Fields for Matching
- `id` - stable numeric product ID
- `name` - full product name with brand
- `cleanName` - product name without brand
- `productQuantity` - package size (value + unit)
- `pricePerUnit` - unit price (price + unit like "kg" or "l")
- `price` - selling price
- `availability` - per-day availability with quantities
- `maxInCart` - maximum quantity allowed in cart
- `unitStep` - quantity increment step (usually 1.0)

## 2. ASSUMPTIONS (UNVERIFIED - NEED TESTING WITH AUTH)

| Assumption | Risk | Mitigation |
|---|---|---|
| Cart API accepts product ID + quantity in POST body | Medium | Test with Playwright after login |
| Session persists via cookies (likely httpOnly) | Low | Playwright handles this natively |
| Cart syncs across devices when logged in | Medium | Verify after first login |
| No aggressive anti-bot on API when authenticated | Medium | Use realistic delays, UA headers |
| Shopping list can be converted to cart atomically | Low | API endpoint exists, test it |

## 3. CRITICAL DESIGN DECISION: Hybrid API + Playwright

**Strategy**: Use the REST API directly wherever possible, fall back to Playwright only when needed.

- **Search/suggest**: REST API (no auth needed, faster, more reliable)
- **Cart operations**: Attempt REST API with auth cookies first. If this fails or requires complex session tokens, fall back to Playwright.
- **Authentication**: Playwright for initial login (handles SSO, CAPTCHA). Store session cookies/state. Reuse via REST API or Playwright as needed.
- **Cart verification**: Playwright screenshot for Slack-visible verification.

This hybrid approach is faster, more reliable, and uses fewer resources than pure Playwright.

## 4. ARCHITECTURE

```
                   GitHub Actions (cron)
                        |
                   POST /api/jobs/*
                   (CRON_SECRET)
                        |
                   +----v----+
                   |  Render  |
                   | Fastify  |
                   +----+----+
                        |
          +-------------+-------------+
          |             |             |
    Slack Events    Job Runner    REST API
          |             |          (admin)
          |        +----+----+
          |        |         |
     AI Parser   Shopping   Kosik
     (Claude)    Services   Adapter
          |        |         |
          +--------+---------+
                   |
              Supabase
              (PostgreSQL)
```

### Module Structure
```
jedalnicek/
  src/
    index.ts                  # Fastify app entry
    config/
      env.ts                  # Environment config + validation
      constants.ts            # App constants
    api/
      routes.ts               # Route registration
      jobs.ts                 # Cron job endpoints
      admin.ts                # Admin/management endpoints
      middleware.ts           # Auth, rate limiting
    db/
      client.ts               # Supabase client
      recipes.ts              # Recipe queries
      ingredients.ts          # Ingredient queries
      plans.ts                # Weekly plan queries
      shopping.ts             # Shopping run queries
      products.ts             # Product match queries
      inventory.ts            # Inventory queries
      logs.ts                 # Automation log queries
    slack/
      app.ts                  # Slack app setup
      events.ts               # Event handlers
      messages.ts             # Message formatting
      verification.ts         # Request signature verification
    ai/
      parser.ts               # LLM meal plan parsing
      matcher.ts              # LLM product matching assist
      schemas.ts              # Zod schemas for LLM output
    recipes/
      service.ts              # Recipe CRUD + scaling
      scaling.ts              # Quantity arithmetic
    shopping/
      planner.ts              # Shopping list generation
      splitter.ts             # Mon/Wed/Fri splitting
      merger.ts               # Ingredient merging
      units.ts                # Unit normalization/conversion
    kosik/
      adapter.ts              # KosikAdapter (main interface)
      api-client.ts           # REST API client
      browser.ts              # Playwright browser automation
      session.ts              # Session management
      search.ts               # Product search
      cart.ts                 # Cart operations
      types.ts                # Kosik-specific types
    services/
      meal-plan.ts            # MealPlanService
      shopping-list.ts        # ShoppingListService
      shopping-run.ts         # ShoppingRunService orchestrator
      product-matching.ts     # ProductMatchingService
      notification.ts         # NotificationService (Slack)
      inventory.ts            # InventoryService
    types/
      index.ts                # Shared types
      database.ts             # DB row types
    utils/
      logger.ts               # Structured logging
      retry.ts                # Safe retry logic
      idempotency.ts          # Run deduplication
  supabase/
    migrations/
      001_initial_schema.sql  # Full schema
  .github/
    workflows/
      ci.yml                  # Lint, typecheck, test
      cron.yml                # Scheduled triggers
  tests/
    unit/
    integration/
    mocks/
      kosik-adapter.ts        # Mock Kosik adapter
  Dockerfile
  render.yaml
  .env.example
  package.json
  tsconfig.json
```

## 5. DATABASE SCHEMA

```sql
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
  quantity_per_portion NUMERIC,  -- if set, used for scaling
  optional BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WEEKLY PLANS
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,           -- Monday of the week
  status TEXT NOT NULL DEFAULT 'draft', -- draft, confirmed, active, completed
  raw_message TEXT,                    -- original Slack message
  parsed_plan JSONB,                  -- AI-parsed structure (for debugging)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_start)
);

-- WEEKLY PLAN ITEMS
CREATE TABLE weekly_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- 'recipe' or 'extra'
  recipe_id UUID REFERENCES recipes(id),
  ingredient_id UUID REFERENCES ingredients(id), -- for extras
  day_start TEXT NOT NULL,             -- 'monday', 'wednesday', 'friday'
  day_end TEXT NOT NULL,               -- 'tuesday', 'thursday', 'sunday'
  portions INTEGER DEFAULT 1,
  quantity NUMERIC,                    -- for extras
  unit TEXT,                           -- for extras
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INVENTORY
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  status TEXT NOT NULL DEFAULT 'buy_if_needed',
  -- 'always_buy', 'have_at_home', 'buy_if_needed'
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
  unit_price_unit TEXT,               -- 'kg', 'l', etc.
  preferred BOOLEAN NOT NULL DEFAULT false,
  match_confidence TEXT NOT NULL DEFAULT 'medium',
  -- 'high', 'medium', 'low'
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ingredient_id, kosik_product_id)
);

-- SHOPPING RUNS
CREATE TABLE shopping_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES weekly_plans(id),
  run_day TEXT NOT NULL,               -- 'monday', 'wednesday', 'friday'
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending, processing, cart_prepared, partial, failed, cancelled
  items_total INTEGER DEFAULT 0,
  items_added INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  items_substituted INTEGER DEFAULT 0,
  estimated_total NUMERIC,
  cart_snapshot JSONB,                 -- what the agent put in the cart
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, run_date)           -- idempotency
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
  package_quantity INTEGER DEFAULT 1,  -- how many packages
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending, added, substituted, skipped, failed
  substitution_reason TEXT,
  original_product_name TEXT,          -- if substituted
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
  -- started, completed, failed
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
```

## 6. REQUIRED EXTERNAL ACCOUNTS & SECRETS

| Secret | Purpose | Where to get |
|---|---|---|
| `SUPABASE_URL` | Database | Provided: mmgjjdbwfxjdhazcqgzo.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | DB admin access | Provided |
| `SLACK_BOT_TOKEN` | Slack API (xoxb-...) | Create Slack app at api.slack.com |
| `SLACK_SIGNING_SECRET` | Verify Slack requests | Slack app settings |
| `SLACK_APP_TOKEN` | Socket Mode (optional) | Slack app settings |
| `SLACK_ALLOWED_USER_ID` | Your Slack user ID | Slack profile |
| `LLM_API_KEY` | Claude API for parsing | Anthropic console |
| `CRON_SECRET` | Protect cron endpoints | Generate random 64-char string |
| `KOSIK_EMAIL` | Kosik.sk login email | Your Kosik account |
| `KOSIK_PASSWORD` | Kosik.sk login password | Your Kosik account |

### Slack App Setup Required
1. Create app at api.slack.com
2. Enable **Event Subscriptions** (message.im)
3. Enable **Bot Token Scopes**: chat:write, im:read, im:write, im:history
4. Install to workspace
5. Set Request URL to Render backend: `https://jedalnicek.onrender.com/slack/events`

## 7. IMPLEMENTATION PLAN

### Phase 1: Foundation (DB + Recipes + Slack)
1. Initialize Node.js project with TypeScript, Fastify, Zod
2. Run Supabase migration (full schema above)
3. Implement `db/` layer - all Supabase queries
4. Implement `recipes/service.ts` - CRUD + scaling arithmetic
5. Implement `slack/app.ts` - Bolt/Events API, signature verification
6. Implement `ai/parser.ts` - Claude-based meal plan parsing with Zod validation
7. Implement `services/meal-plan.ts` - parse message -> create weekly plan
8. Wire Sunday reminder job
9. Seed 3-5 starter recipes
10. Test: Slack DM -> parse -> plan summary reply

### Phase 2: Shopping Lists
1. Implement `shopping/planner.ts` - expand recipes to ingredient lists
2. Implement `shopping/splitter.ts` - Mon/Wed/Fri distribution
3. Implement `shopping/merger.ts` - deduplicate + aggregate ingredients
4. Implement `shopping/units.ts` - unit conversion (g<->kg, ml<->l)
5. Implement `services/inventory.ts` - apply have_at_home / always_buy rules
6. Implement `services/shopping-list.ts` - full pipeline
7. Test: plan -> shopping list per day with correct quantities

### Phase 3: Kosik Integration
1. Implement `kosik/api-client.ts` - REST client for suggest API
2. Implement `kosik/browser.ts` - Playwright login, session save/restore
3. Implement `kosik/session.ts` - session management, expiry detection
4. Implement `kosik/search.ts` - product search via suggest API
5. Implement `kosik/cart.ts` - cart read/add/remove via Playwright
6. Implement `kosik/adapter.ts` - unified KosikAdapter interface
7. Implement `services/product-matching.ts` - match ingredients to products
8. Test: search for ingredients, verify product matching logic

### Phase 4: Shopping Runs
1. Implement `services/shopping-run.ts` - full orchestrator
2. Implement idempotency (unique run per plan+date)
3. Implement cart reconciliation (detect existing items)
4. Implement substitution logic
5. Implement confidence thresholds
6. Implement `services/notification.ts` - Slack shopping summaries
7. Wire Mon/Wed/Fri job endpoints
8. Test: full shopping run with mock adapter

### Phase 5: Deployment
1. Create Dockerfile (Node + Playwright + Chromium)
2. Create render.yaml
3. Create GitHub Actions: CI (lint/typecheck/test)
4. Create GitHub Actions: cron workflows
5. Create .env.example
6. Deploy to Render
7. First live test with real Kosik account
8. Security audit: no secrets in logs, proper error handling

## 8. BLOCKERS & RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| Cart API may require session tokens beyond cookies | High | Playwright fallback for all cart ops |
| Kosik may rate-limit or block automated requests | Medium | Realistic delays, UA rotation, single-user pattern |
| Kosik may change API/frontend without notice | Medium | Adapter pattern isolates changes |
| Product search may not find exact ingredients | Low | AI-assisted query reformulation |
| Kosik may use CAPTCHA on login | Medium | Manual login trigger, long session persistence |
| Playwright on Render needs specific Docker setup | Low | Use official Playwright Docker base |

## 9. WHAT TO BUILD FIRST

Start with Phase 1. The most valuable early milestone is:

**Sunday Slack DM -> I reply with meals -> system creates a plan and replies with summary.**

This validates the Slack integration, AI parsing, and recipe system without touching Kosik at all.
