-- =============================================================================
-- Insurance Sales Performance Agent: Snowflake setup
--
-- Run from the repository root after generating the synthetic data:
--     npm run generate
--     snow sql -f sql/setup.sql -c <your_connection>
-- The PUT commands below upload data/csv/*.csv. In a Snowsight worksheet, skip
-- the PUT block and upload the CSV files to @INSURANCE_SALES_DB.SALES.LOAD_STAGE
-- with the Snowsight stage upload UI instead, then run the rest.
--
-- Creates only new objects (one database, one XSMALL warehouse, two roles) and
-- changes nothing that already exists. sql/cleanup.sql removes all of it.
-- Requirements: Enterprise Edition or higher (row access policy), Cortex AI
-- functions and Cortex Agents available in your region (or cross-region
-- inference enabled). Synthetic data only.
-- =============================================================================

USE ROLE ACCOUNTADMIN;

-- ---------------------------------------------------------------------------
-- 1. Warehouse, database, least-privilege roles
-- ---------------------------------------------------------------------------
CREATE WAREHOUSE IF NOT EXISTS INSURANCE_SALES_WH
  WAREHOUSE_SIZE = XSMALL AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE
  COMMENT = 'Insurance Sales Performance Agent example (synthetic data)';

CREATE DATABASE IF NOT EXISTS INSURANCE_SALES_DB
  COMMENT = 'Insurance Sales Performance Agent example (synthetic data)';
CREATE SCHEMA IF NOT EXISTS INSURANCE_SALES_DB.SALES;

-- INSURANCE_SALES_DEMO_ROLE: the app's role. Sees every territory (regional
-- director view). INSURANCE_SALES_REP_ROLE: a field rep who sees only the
-- Southeast Inland territory (row access policy below).
CREATE ROLE IF NOT EXISTS INSURANCE_SALES_DEMO_ROLE COMMENT = 'Insurance sales example: director view';
CREATE ROLE IF NOT EXISTS INSURANCE_SALES_REP_ROLE  COMMENT = 'Insurance sales example: rep view (one territory)';

-- The owner role builds all objects; the DEMO role owns nothing and only reads.
GRANT USAGE ON WAREHOUSE INSURANCE_SALES_WH TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT USAGE ON WAREHOUSE INSURANCE_SALES_WH TO ROLE INSURANCE_SALES_REP_ROLE;
GRANT USAGE ON DATABASE INSURANCE_SALES_DB TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT USAGE ON DATABASE INSURANCE_SALES_DB TO ROLE INSURANCE_SALES_REP_ROLE;
GRANT USAGE ON SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT USAGE ON SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_REP_ROLE;
-- Cortex AI functions (AI_COMPLETE) and Cortex Agents
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE INSURANCE_SALES_REP_ROLE;

-- Let the person running setup use both roles (removed when cleanup drops them).
SET SETUP_USER = CURRENT_USER();
GRANT ROLE INSURANCE_SALES_DEMO_ROLE TO USER IDENTIFIER($SETUP_USER);
GRANT ROLE INSURANCE_SALES_REP_ROLE  TO USER IDENTIFIER($SETUP_USER);

USE WAREHOUSE INSURANCE_SALES_WH;
USE SCHEMA INSURANCE_SALES_DB.SALES;

-- ---------------------------------------------------------------------------
-- 2. Tables and load
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE REPS (
  REP_ID STRING, REP_NAME STRING, TERRITORY STRING, REGION STRING);
CREATE OR REPLACE TABLE DEALERS (
  DEALER_ID STRING, DEALER_NAME STRING, STATE STRING, ZIP STRING, REGION STRING, TERRITORY STRING,
  REP_ID STRING, FRANCHISE_BRAND STRING, TIER STRING, DEALER_GROUP STRING, ONBOARDED_DATE DATE);
CREATE OR REPLACE TABLE PRODUCTS (
  PRODUCT_CODE STRING, PRODUCT_NAME STRING, PREMIUM_BAND STRING, EXPECTED_LOSS_RATIO NUMBER(5,3));
CREATE OR REPLACE TABLE CONTRACTS_SOLD (
  CONTRACT_ID STRING, DEALER_ID STRING, PRODUCT_CODE STRING, SALE_DATE DATE, PREMIUM NUMBER(10,2),
  TERM_MONTHS NUMBER, VEHICLE_CONDITION STRING, FINANCED_FLAG STRING);
CREATE OR REPLACE TABLE CLAIMS (
  CLAIM_ID STRING, CONTRACT_ID STRING, PAID_DATE DATE, PAID_AMOUNT NUMBER(12,2), CAUSE STRING, STATUS STRING);
CREATE OR REPLACE TABLE DEALER_FINANCED_DEALS (
  DEALER_ID STRING, MONTH DATE, FINANCED_DEALS NUMBER);
CREATE OR REPLACE TABLE MARKET_BENCHMARKS (
  STATE STRING, REGION STRING, PRODUCT_CODE STRING, MONTH DATE, MARKET_UNITS NUMBER);

CREATE OR REPLACE FILE FORMAT CSV_FF TYPE = CSV SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"';
CREATE OR REPLACE STAGE LOAD_STAGE FILE_FORMAT = CSV_FF;

-- Snowsight users: skip these PUT commands and upload data/csv/*.csv to LOAD_STAGE instead.
PUT file://data/csv/reps.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/dealers.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/products.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/contracts_sold.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/claims.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/dealer_financed_deals.csv @LOAD_STAGE OVERWRITE = TRUE;
PUT file://data/csv/market_benchmarks.csv @LOAD_STAGE OVERWRITE = TRUE;

COPY INTO REPS FROM @LOAD_STAGE/reps.csv.gz;
COPY INTO DEALERS FROM @LOAD_STAGE/dealers.csv.gz;
COPY INTO PRODUCTS FROM @LOAD_STAGE/products.csv.gz;
COPY INTO CONTRACTS_SOLD FROM @LOAD_STAGE/contracts_sold.csv.gz;
COPY INTO CLAIMS FROM @LOAD_STAGE/claims.csv.gz;
COPY INTO DEALER_FINANCED_DEALS FROM @LOAD_STAGE/dealer_financed_deals.csv.gz;
COPY INTO MARKET_BENCHMARKS FROM @LOAD_STAGE/market_benchmarks.csv.gz;

-- Glossary behind the app's "Matches BI report" links.
CREATE OR REPLACE TABLE METRIC_DEFINITIONS (METRIC STRING, DEFINITION STRING, SEMANTIC_VIEW_METRIC STRING);
INSERT INTO METRIC_DEFINITIONS VALUES
  ('Written premium', 'Sum of contract premium for contracts sold in the period.', 'perf.written_premium'),
  ('Contracts', 'Count of contracts sold in the period.', 'perf.contracts_sold'),
  ('Attach rate', 'Financed contracts sold / financed deals. Per product this is the share of financed deals with that product; across products it can exceed 100% because one deal can carry several products. Also called penetration.', 'perf.attach_rate'),
  ('Loss ratio', 'Claims paid in the period / premium written in the period (paid basis, simplified for sales reporting; not an earned-premium actuarial measure).', 'perf.loss_ratio'),
  ('Claim frequency', 'Paid claims / contracts sold in the period.', 'perf.claim_frequency'),
  ('Claim severity', 'Paid amount / paid claims.', 'perf.claim_severity'),
  ('Market share', 'Our contracts / total market units for the same state, product, and month.', 'share.market_share');

-- ---------------------------------------------------------------------------
-- 3. Row access policy: reps see only their territory (Enterprise Edition)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE TERRITORY_ACCESS (ROLE_NAME STRING, TERRITORY STRING);
INSERT INTO TERRITORY_ACCESS VALUES ('INSURANCE_SALES_REP_ROLE', 'Southeast Inland');

CREATE OR REPLACE ROW ACCESS POLICY TERRITORY_POLICY AS (TERRITORY_COL STRING) RETURNS BOOLEAN ->
  NOT IS_ROLE_IN_SESSION('INSURANCE_SALES_REP_ROLE')
  OR EXISTS (SELECT 1 FROM TERRITORY_ACCESS a
             WHERE a.ROLE_NAME = 'INSURANCE_SALES_REP_ROLE' AND a.TERRITORY = TERRITORY_COL);
ALTER TABLE DEALERS ADD ROW ACCESS POLICY TERRITORY_POLICY ON (TERRITORY);

-- ---------------------------------------------------------------------------
-- 4. Monthly views used by the app and the semantic view
--    Periods: TTM = Dec 2025 - Nov 2026, PRIOR_TTM = Dec 2024 - Nov 2025.
-- ---------------------------------------------------------------------------
-- One row per dealer x product x month (full grid, so every metric shares a grain).
CREATE OR REPLACE VIEW DEALER_PRODUCT_MONTHLY AS
WITH grid AS (
  SELECT d.DEALER_ID, p.PRODUCT_CODE, f.MONTH, f.FINANCED_DEALS
  FROM DEALER_FINANCED_DEALS f
  JOIN DEALERS d ON d.DEALER_ID = f.DEALER_ID
  CROSS JOIN PRODUCTS p
), sales AS (
  SELECT DEALER_ID, PRODUCT_CODE, DATE_TRUNC('MONTH', SALE_DATE) AS MONTH,
         COUNT(*) AS CONTRACTS, SUM(PREMIUM) AS PREMIUM,
         COUNT_IF(FINANCED_FLAG = 'Y') AS FINANCED_CONTRACTS
  FROM CONTRACTS_SOLD GROUP BY 1, 2, 3
), paid AS (
  SELECT c.DEALER_ID, c.PRODUCT_CODE, DATE_TRUNC('MONTH', k.PAID_DATE) AS MONTH,
         COUNT(*) AS CLAIMS, SUM(k.PAID_AMOUNT) AS PAID
  FROM CLAIMS k JOIN CONTRACTS_SOLD c ON c.CONTRACT_ID = k.CONTRACT_ID
  WHERE k.STATUS = 'PAID' GROUP BY 1, 2, 3
)
SELECT g.DEALER_ID, g.PRODUCT_CODE, g.MONTH,
       CASE WHEN g.MONTH >= '2025-12-01' THEN 'TTM'
            WHEN g.MONTH >= '2024-12-01' THEN 'PRIOR_TTM' ELSE 'PRIOR_2' END AS PERIOD,
       g.FINANCED_DEALS,
       COALESCE(s.CONTRACTS, 0) AS CONTRACTS, COALESCE(s.PREMIUM, 0) AS PREMIUM,
       COALESCE(s.FINANCED_CONTRACTS, 0) AS FINANCED_CONTRACTS,
       COALESCE(p.CLAIMS, 0) AS CLAIMS, COALESCE(p.PAID, 0) AS PAID
FROM grid g
LEFT JOIN sales s ON s.DEALER_ID = g.DEALER_ID AND s.PRODUCT_CODE = g.PRODUCT_CODE AND s.MONTH = g.MONTH
LEFT JOIN paid p  ON p.DEALER_ID = g.DEALER_ID AND p.PRODUCT_CODE = g.PRODUCT_CODE AND p.MONTH = g.MONTH;

-- Paid claims by cause.
CREATE OR REPLACE VIEW CLAIM_CAUSES_MONTHLY AS
SELECT c.DEALER_ID, c.PRODUCT_CODE, DATE_TRUNC('MONTH', k.PAID_DATE) AS MONTH,
       CASE WHEN k.PAID_DATE >= '2025-12-01' THEN 'TTM'
            WHEN k.PAID_DATE >= '2024-12-01' THEN 'PRIOR_TTM' ELSE 'PRIOR_2' END AS PERIOD,
       k.CAUSE, COUNT(*) AS CLAIMS, SUM(k.PAID_AMOUNT) AS PAID
FROM CLAIMS k
JOIN CONTRACTS_SOLD c ON c.CONTRACT_ID = k.CONTRACT_ID
JOIN DEALERS d ON d.DEALER_ID = c.DEALER_ID
WHERE k.STATUS = 'PAID'
GROUP BY 1, 2, 3, 4, 5;

-- Market share by state x product x month.
CREATE OR REPLACE VIEW MARKET_SHARE_MONTHLY AS
SELECT m.STATE, m.REGION, m.PRODUCT_CODE, m.MONTH,
       CASE WHEN m.MONTH >= '2025-12-01' THEN 'TTM'
            WHEN m.MONTH >= '2024-12-01' THEN 'PRIOR_TTM' ELSE 'PRIOR_2' END AS PERIOD,
       COALESCE(SUM(dp.CONTRACTS), 0) AS OUR_UNITS, ANY_VALUE(m.MARKET_UNITS) AS MARKET_UNITS
FROM MARKET_BENCHMARKS m
LEFT JOIN (SELECT dpm.*, d.STATE FROM DEALER_PRODUCT_MONTHLY dpm JOIN DEALERS d ON d.DEALER_ID = dpm.DEALER_ID) dp
  ON dp.STATE = m.STATE AND dp.PRODUCT_CODE = m.PRODUCT_CODE AND dp.MONTH = m.MONTH
GROUP BY 1, 2, 3, 4, 5;

-- ---------------------------------------------------------------------------
-- 5. Semantic view with synonyms and verified queries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE SEMANTIC VIEW INSURANCE_SALES_SV
  TABLES (
    dealers AS INSURANCE_SALES_DB.SALES.DEALERS PRIMARY KEY (DEALER_ID)
      WITH SYNONYMS ('dealerships', 'accounts', 'stores') COMMENT = 'Dealers that sell our products',
    reps AS INSURANCE_SALES_DB.SALES.REPS PRIMARY KEY (REP_ID)
      WITH SYNONYMS ('sales reps', 'account executives', 'AEs') COMMENT = 'Field sales reps',
    products AS INSURANCE_SALES_DB.SALES.PRODUCTS PRIMARY KEY (PRODUCT_CODE)
      COMMENT = 'Dealer-distributed insurance products',
    perf AS INSURANCE_SALES_DB.SALES.DEALER_PRODUCT_MONTHLY PRIMARY KEY (DEALER_ID, PRODUCT_CODE, MONTH)
      WITH SYNONYMS ('sales', 'performance') COMMENT = 'Monthly sales, financed deals, and paid claims by dealer and product',
    causes AS INSURANCE_SALES_DB.SALES.CLAIM_CAUSES_MONTHLY PRIMARY KEY (DEALER_ID, PRODUCT_CODE, MONTH, CAUSE)
      COMMENT = 'Monthly paid claims by cause',
    share AS INSURANCE_SALES_DB.SALES.MARKET_SHARE_MONTHLY PRIMARY KEY (STATE, PRODUCT_CODE, MONTH)
      WITH SYNONYMS ('market', 'benchmarks') COMMENT = 'Monthly market share by state and product'
  )
  RELATIONSHIPS (
    dealer_rep AS dealers (REP_ID) REFERENCES reps,
    perf_dealer AS perf (DEALER_ID) REFERENCES dealers,
    perf_product AS perf (PRODUCT_CODE) REFERENCES products,
    causes_dealer AS causes (DEALER_ID) REFERENCES dealers,
    causes_product AS causes (PRODUCT_CODE) REFERENCES products,
    share_product AS share (PRODUCT_CODE) REFERENCES products
  )
  FACTS (
    perf.premium AS PREMIUM,
    perf.contract_count AS CONTRACTS,
    perf.financed_contract_count AS FINANCED_CONTRACTS,
    perf.financed_deal_count AS FINANCED_DEALS,
    perf.claim_count AS CLAIMS,
    perf.paid_amount AS PAID,
    perf.product_key AS PRODUCT_CODE,
    causes.cause_claim_count AS CLAIMS,
    causes.cause_paid_amount AS PAID,
    share.our_unit_count AS OUR_UNITS,
    share.market_unit_count AS MARKET_UNITS
  )
  DIMENSIONS (
    dealers.dealer_id AS DEALER_ID,
    perf.dealer_id AS DEALER_ID,
    perf.product_code AS PRODUCT_CODE,
    dealers.dealer_name AS DEALER_NAME WITH SYNONYMS ('dealer', 'dealership name'),
    dealers.dealer_state AS STATE WITH SYNONYMS ('state') COMMENT = 'Two-letter US state code, e.g. TX, GA',
    dealers.zip AS ZIP COMMENT = 'Five-digit ZIP code; the first three digits identify an area cluster',
    dealers.dealer_region AS REGION WITH SYNONYMS ('region') COMMENT = 'Southeast, Northeast, Midwest, South Central, West',
    dealers.territory AS TERRITORY,
    dealers.franchise_brand AS FRANCHISE_BRAND,
    dealers.tier AS TIER COMMENT = 'Platinum, Gold, or Silver',
    dealers.dealer_group AS DEALER_GROUP WITH SYNONYMS ('group', 'dealer group') COMMENT = 'Dealer group or Independent',
    reps.rep_name AS REP_NAME WITH SYNONYMS ('rep', 'AE'),
    reps.rep_id AS REP_ID,
    dealers.rep_id AS REP_ID,
    products.product_code AS PRODUCT_CODE COMMENT = 'VSC, GAP, TW (tire and wheel), APP (appearance), KEY (key replacement)',
    products.product_name AS PRODUCT_NAME WITH SYNONYMS ('product', 'line'),
    products.expected_loss_ratio AS EXPECTED_LOSS_RATIO,
    perf.month AS MONTH COMMENT = 'First day of the month; data covers Dec 2023 to Nov 2026',
    perf.period AS PERIOD WITH SYNONYMS ('year', 'this year', 'last year')
      COMMENT = 'TTM = this year (Dec 2025-Nov 2026); PRIOR_TTM = last year (Dec 2024-Nov 2025); PRIOR_2 = two years ago',
    causes.cause AS CAUSE WITH SYNONYMS ('claim cause', 'component'),
    causes.dealer_id AS DEALER_ID,
    causes.product_code AS PRODUCT_CODE,
    causes.cause_month AS MONTH,
    causes.month AS MONTH,
    causes.cause_period AS PERIOD COMMENT = 'TTM, PRIOR_TTM, PRIOR_2 by paid date',
    share.share_state AS STATE COMMENT = 'Two-letter US state code',
    share.product_code AS PRODUCT_CODE,
    share.share_region AS REGION,
    share.share_month AS MONTH,
    share.month AS MONTH,
    share.state AS STATE,
    share.share_period AS PERIOD COMMENT = 'TTM, PRIOR_TTM, PRIOR_2'
  )
  METRICS (
    perf.written_premium AS SUM(perf.premium) WITH SYNONYMS ('premium', 'written premium', 'revenue'),
    perf.contracts_sold AS SUM(perf.contract_count) WITH SYNONYMS ('volume', 'units', 'contracts sold'),
    perf.paid_claims AS SUM(perf.claim_count),
    perf.claims_paid_amount AS SUM(perf.paid_amount) WITH SYNONYMS ('losses', 'paid losses'),
    perf.loss_ratio AS SUM(perf.paid_amount) / NULLIF(SUM(perf.premium), 0)
      WITH SYNONYMS ('LR', 'loss ratio') COMMENT = 'Claims paid / premium written in the same period',
    perf.claim_frequency AS SUM(perf.claim_count) / NULLIF(SUM(perf.contract_count), 0)
      WITH SYNONYMS ('frequency') COMMENT = 'Paid claims / contracts sold',
    perf.claim_severity AS SUM(perf.paid_amount) / NULLIF(SUM(perf.claim_count), 0)
      WITH SYNONYMS ('severity', 'average claim') COMMENT = 'Paid amount per paid claim',
    perf.attach_rate AS SUM(perf.financed_contract_count)
        / NULLIF(SUM(perf.financed_deal_count) / COUNT(DISTINCT perf.product_key), 0)
      WITH SYNONYMS ('penetration', 'attach', 'take rate')
      COMMENT = 'Financed contracts / financed deals; can exceed 1 across all products',
    causes.cause_claims AS SUM(causes.cause_claim_count),
    causes.cause_paid AS SUM(causes.cause_paid_amount),
    share.market_share AS SUM(share.our_unit_count) / NULLIF(SUM(share.market_unit_count), 0)
      WITH SYNONYMS ('share', 'market share') COMMENT = 'Our contracts / total market units'
  )
  COMMENT = 'Insurance sales performance (synthetic): premium, volume, attach rate, loss ratio, market share'
  AI_SQL_GENERATION 'Use PERIOD = ''TTM'' for "this year" and PERIOD = ''PRIOR_TTM'' for "last year". Express rates as percentages with one decimal. Compare TTM vs PRIOR_TTM when asked why something changed, and break changes down by dealer. When listing dealers by loss ratio, include only dealers with at least 20000 of written premium in the period. For dealer "areas" or "clusters", group dealers by LEFT(ZIP, 3). Names ending in "Group" or "Auto Group" are values of DEALER_GROUP, not DEALER_NAME. Data ends in Nov 2026: compute "last N months" back from 2026-11-01, not from CURRENT_DATE.'
  AI_VERIFIED_QUERIES (
    southeast_volume_by_dealer AS (
      QUESTION 'Why is Southeast volume down this year?'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT d.dealer_name, d.dealer_state,
             SUM(IFF(p.period = ''PRIOR_TTM'', p.contract_count, 0)) AS contracts_last_year,
             SUM(IFF(p.period = ''TTM'', p.contract_count, 0)) AS contracts_this_year,
             contracts_this_year - contracts_last_year AS change,
             change / NULLIF(contracts_last_year, 0) AS pct_change
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE d.dealer_region = ''Southeast'' AND p.period IN (''TTM'', ''PRIOR_TTM'')
           GROUP BY 1, 2 ORDER BY change ASC LIMIT 10'
    ),
    gap_loss_ratio_above_80 AS (
      QUESTION 'Which dealers have GAP loss ratio above 80%?'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT d.dealer_name, d.dealer_state, SUM(p.premium) AS written_premium, SUM(p.paid_amount) AS claims_paid,
             SUM(p.paid_amount) / NULLIF(SUM(p.premium), 0) AS loss_ratio
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE p.product_key = ''GAP'' AND p.period = ''TTM''
           GROUP BY 1, 2 HAVING SUM(p.premium) >= 20000 AND loss_ratio > 0.8
           ORDER BY loss_ratio DESC'
    ),
    vsc_share_texas AS (
      QUESTION 'What is our VSC share in Texas vs last year?'
      ONBOARDING_QUESTION TRUE
      SQL 'SELECT s.share_period, SUM(s.our_unit_count) AS our_units, SUM(s.market_unit_count) AS market_units,
             SUM(s.our_unit_count) / NULLIF(SUM(s.market_unit_count), 0) AS market_share
           FROM __share AS s
           WHERE s.share_state = ''TX'' AND s.product_code = ''VSC'' AND s.share_period IN (''TTM'', ''PRIOR_TTM'')
           GROUP BY 1 ORDER BY 1 DESC'
    ),
    premium_by_region AS (
      QUESTION 'Written premium by region this year vs last year'
      SQL 'SELECT d.dealer_region,
             SUM(IFF(p.period = ''PRIOR_TTM'', p.premium, 0)) AS premium_last_year,
             SUM(IFF(p.period = ''TTM'', p.premium, 0)) AS premium_this_year,
             premium_this_year / NULLIF(premium_last_year, 0) - 1 AS yoy_change
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           GROUP BY 1 ORDER BY yoy_change'
    ),
    loss_ratio_by_product AS (
      QUESTION 'Loss ratio by product this year'
      SQL 'SELECT pr.product_name, SUM(p.paid_amount) / NULLIF(SUM(p.premium), 0) AS loss_ratio,
             ANY_VALUE(pr.expected_loss_ratio) AS expected_loss_ratio
           FROM __perf AS p JOIN __products AS pr ON pr.product_code = p.product_code
           WHERE p.period = ''TTM'' GROUP BY 1 ORDER BY loss_ratio DESC'
    ),
    summit_attach_trend AS (
      QUESTION 'Attach rate trend for Summit Auto Group'
      SQL 'SELECT p.month,
             SUM(p.financed_contract_count) / NULLIF(SUM(p.financed_deal_count) / COUNT(DISTINCT p.product_key), 0) AS attach_rate
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE d.dealer_group = ''Summit Auto Group'' GROUP BY 1 ORDER BY 1'
    ),
    top_dealers_premium AS (
      QUESTION 'Top 10 dealers by written premium this year'
      SQL 'SELECT d.dealer_name, d.dealer_state, SUM(p.premium) AS written_premium
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE p.period = ''TTM'' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10'
    ),
    georgia_gap_frequency_severity AS (
      QUESTION 'Is the Georgia GAP loss ratio increase driven by frequency or severity?'
      SQL 'SELECT p.period, SUM(p.paid_amount) / NULLIF(SUM(p.premium), 0) AS loss_ratio,
             SUM(p.claim_count) / NULLIF(SUM(p.contract_count), 0) AS claim_frequency,
             SUM(p.paid_amount) / NULLIF(SUM(p.claim_count), 0) AS claim_severity
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE d.dealer_state = ''GA'' AND p.product_key = ''GAP'' AND p.period IN (''TTM'', ''PRIOR_TTM'')
           GROUP BY 1 ORDER BY 1 DESC'
    ),
    tire_wheel_claims_by_area AS (
      QUESTION 'Which dealer areas have unusual tire and wheel claim frequency in the last 6 months?'
      SQL 'SELECT LEFT(d.zip, 3) AS zip3, COUNT(DISTINCT d.dealer_id) AS dealers,
             SUM(p.claim_count) AS claims, SUM(p.contract_count) AS contracts,
             SUM(p.claim_count) / NULLIF(SUM(p.contract_count), 0) AS claims_per_contract
           FROM __perf AS p JOIN __dealers AS d ON d.dealer_id = p.dealer_id
           WHERE p.product_key = ''TW'' AND p.month >= ''2026-06-01''
           GROUP BY 1 HAVING SUM(p.contract_count) >= 50 ORDER BY claims_per_contract DESC LIMIT 10'
    ),
    market_share_by_region AS (
      QUESTION 'Market share by region this year vs last year'
      SQL 'SELECT s.share_region,
             SUM(IFF(s.share_period = ''PRIOR_TTM'', s.our_unit_count, 0)) / NULLIF(SUM(IFF(s.share_period = ''PRIOR_TTM'', s.market_unit_count, 0)), 0) AS share_last_year,
             SUM(IFF(s.share_period = ''TTM'', s.our_unit_count, 0)) / NULLIF(SUM(IFF(s.share_period = ''TTM'', s.market_unit_count, 0)), 0) AS share_this_year
           FROM __share AS s
           GROUP BY 1 ORDER BY 1'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Cortex Agent over the semantic view
-- ---------------------------------------------------------------------------
CREATE OR REPLACE AGENT INSURANCE_SALES_AGENT
  COMMENT = 'Insurance Sales Performance Agent example (synthetic data)'
  PROFILE = '{"display_name": "Sales Performance Agent"}'
  FROM SPECIFICATION
  $$
  models:
    orchestration: auto
  orchestration:
    budget:
      seconds: 60
      tokens: 16000
  instructions:
    response: "You help field sales reps for dealer-distributed insurance products (VSC, GAP, tire and wheel, appearance, key replacement) understand why their numbers changed. Answer in 2-4 short sentences, name the specific dealers or segments that drive the change, and show percentages with one decimal. Attach rate across all products counts several products per financed deal, so values above 100% are expected and correct. If a dealer's volume collapsed, its paid loss ratio rises because claims keep arriving on earlier contracts (run-off); say so instead of calling it a frequency problem. You explain data only: never recommend pricing, underwriting, or claims decisions, and never take actions."
    orchestration: "Use the SalesAnalyst tool for every data question. 'This year' means the TTM period and 'last year' means PRIOR_TTM. When asked why a metric changed, compare TTM vs PRIOR_TTM and break it down by dealer. For loss ratio questions, also show claim frequency and claim severity and say which one changed more in relative terms. Data is filtered by a row access policy to the user's territory: if a state, region, or dealer returns no rows or zero of our units, say it is likely outside the user's territory rather than concluding we have no business there."
    sample_questions:
      - question: "Why is Southeast volume down this year?"
      - question: "Which dealers have GAP loss ratio above 80%?"
      - question: "What's our VSC share in Texas vs last year?"
  tools:
    - tool_spec:
        type: "cortex_analyst_text_to_sql"
        name: "SalesAnalyst"
        description: "Answers questions about written premium, contracts, attach rate (penetration), loss ratio, claim frequency and severity, claim causes, and market share by dealer, rep, territory, region, state, product, and month."
  tool_resources:
    SalesAnalyst:
      semantic_view: "INSURANCE_SALES_DB.SALES.INSURANCE_SALES_SV"
      execution_environment:
        type: "warehouse"
        warehouse: "INSURANCE_SALES_WH"
  $$;

-- ---------------------------------------------------------------------------
-- 7. Read-only grants for the app roles
-- ---------------------------------------------------------------------------
GRANT SELECT ON ALL TABLES IN SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT SELECT ON SEMANTIC VIEW INSURANCE_SALES_SV TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT USAGE ON AGENT INSURANCE_SALES_AGENT TO ROLE INSURANCE_SALES_DEMO_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_REP_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA INSURANCE_SALES_DB.SALES TO ROLE INSURANCE_SALES_REP_ROLE;
GRANT SELECT ON SEMANTIC VIEW INSURANCE_SALES_SV TO ROLE INSURANCE_SALES_REP_ROLE;
GRANT USAGE ON AGENT INSURANCE_SALES_AGENT TO ROLE INSURANCE_SALES_REP_ROLE;

-- Sanity check: row counts
SELECT 'DEALERS' AS T, COUNT(*) AS N FROM DEALERS UNION ALL
SELECT 'CONTRACTS_SOLD', COUNT(*) FROM CONTRACTS_SOLD UNION ALL
SELECT 'CLAIMS', COUNT(*) FROM CLAIMS UNION ALL
SELECT 'DEALER_PRODUCT_MONTHLY', COUNT(*) FROM DEALER_PRODUCT_MONTHLY;
