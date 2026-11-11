-- Migration: faithful copy of the live SQL for public.get_portfolio_history
-- in the Supabase project "portfolio" (ref xmgbvjkmkzhrndezozbu),
-- read with pg_get_functiondef() on 2026-11-11. No functional changes.
-- Assumes the transactions and historical_prices tables already exist.

-- get_portfolio_history
-- Source: pg_get_functiondef() read via the Supabase Management API on 2026-11-11
-- Project: portfolio (xmgbvjkmkzhrndezozbu). No changes; faithful copy of the live SQL.
CREATE OR REPLACE FUNCTION public.get_portfolio_history(p_portfolio_id uuid)
 RETURNS TABLE(history_date date, value_usd numeric, value_mxn numeric, invested_usd numeric, invested_mxn numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_first_tx_date date;
BEGIN
  -- Get first transaction date
  SELECT MIN(t.date::date) INTO v_first_tx_date
  FROM transactions t
  WHERE t.portfolio_id = p_portfolio_id;

  IF v_first_tx_date IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  dates AS (
    SELECT v_first_tx_date AS d
    UNION ALL
    SELECT d + 1
    FROM dates
    WHERE d < current_date
  ),
  business_days AS (
    SELECT d FROM dates
    WHERE extract(isodow from d) < 6
  ),
  daily_shares_safe AS (
    SELECT
      bd.d AS curr_date,
      ut.ticker,
      COALESCE((
        SELECT SUM(CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
        FROM transactions t
        WHERE t.portfolio_id = p_portfolio_id
          AND t.ticker = ut.ticker
          AND t.date::date <= bd.d
      ), 0) AS shares,
      -- Calculate net cash flow (invested amount) up to this date
      COALESCE((
        SELECT SUM(
          CASE
            WHEN t.type = 'BUY' THEN t.quantity * t.price_per_unit
            ELSE -t.quantity * t.price_per_unit
          END
        )
        FROM transactions t
        WHERE t.portfolio_id = p_portfolio_id
          AND t.ticker = ut.ticker
          AND t.date::date <= bd.d
      ), 0) AS net_cash
    FROM business_days bd
    CROSS JOIN (SELECT DISTINCT t2.ticker FROM transactions t2 WHERE t2.portfolio_id = p_portfolio_id) ut
  ),
  daily_prices AS (
    SELECT
      ds.curr_date,
      ds.ticker,
      ds.shares,
      ds.net_cash,
      COALESCE(
        (SELECT hp.close_price FROM historical_prices hp WHERE hp.ticker = ds.ticker AND hp.date <= ds.curr_date ORDER BY hp.date DESC LIMIT 1),
        0
      ) AS raw_price,
      COALESCE(
        (SELECT hp.close_price FROM historical_prices hp WHERE hp.ticker = 'USD-MXN' AND hp.date <= ds.curr_date ORDER BY hp.date DESC LIMIT 1),
        20.0
      ) AS usd_mxn_rate
    FROM daily_shares_safe ds
    -- Only include active records
    WHERE ds.shares > 0 OR ds.net_cash != 0
  )
  SELECT
    dp.curr_date AS history_date,
    SUM(
      CASE
        WHEN dp.ticker LIKE '%:BMV' THEN (dp.shares * dp.raw_price / dp.usd_mxn_rate)
        ELSE (dp.shares * dp.raw_price)
      END
    ) AS value_usd,
    SUM(
      CASE
        WHEN dp.ticker LIKE '%:BMV' THEN (dp.shares * dp.raw_price)
        ELSE (dp.shares * dp.raw_price * dp.usd_mxn_rate)
      END
    ) AS value_mxn,
    SUM(
      CASE
        WHEN dp.ticker LIKE '%:BMV' THEN (dp.net_cash / dp.usd_mxn_rate)
        ELSE dp.net_cash
      END
    ) AS invested_usd,
    SUM(
      CASE
        WHEN dp.ticker LIKE '%:BMV' THEN dp.net_cash
        ELSE (dp.net_cash * dp.usd_mxn_rate)
      END
    ) AS invested_mxn
  FROM daily_prices dp
  GROUP BY dp.curr_date
  ORDER BY dp.curr_date ASC;
END;
$function$
