-- =============================================================================
-- Insurance Sales Performance Agent: cleanup
-- Drops everything sql/setup.sql created. Nothing else is touched.
--     snow sql -f sql/cleanup.sql -c <your_connection>
-- =============================================================================
USE ROLE ACCOUNTADMIN;

-- The agent, semantic view, views, tables, stage, and row access policy all live
-- in this database and are dropped with it.
DROP DATABASE IF EXISTS INSURANCE_SALES_DB;
DROP WAREHOUSE IF EXISTS INSURANCE_SALES_WH;
DROP ROLE IF EXISTS INSURANCE_SALES_DEMO_ROLE;
DROP ROLE IF EXISTS INSURANCE_SALES_REP_ROLE;
