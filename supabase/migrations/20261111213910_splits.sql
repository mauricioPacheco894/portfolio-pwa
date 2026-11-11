-- Split adjustments for portfolio history and positions
--
-- Problem: prices from Yahoo Finance are split-adjusted (post-split), while
-- the transactions table records pre-split quantities. When a stock splits,
-- every historical price is divided by the split ratio, so a position held
-- across the split is undervalued by that ratio. VGT did an 8:1 split on
-- 2026-04-21 and its history was undervalued 8x until this fix; SNDK has a
-- split coming next week.
--
-- Fix: record split events in `splits` and express every quantity in
-- post-split shares (quantity x split_factor) before multiplying by the
-- (split-adjusted) price. Cash totals (invested / cost basis) are
-- split-invariant, so they are left untouched.
--
-- This migration only changes function definitions. It must be applied to
-- the database after merge for the fix to take effect. The app code that
-- reads `splits` degrades gracefully (no splits) until the migration is
-- applied.

-- ---------------------------------------------------------------------------
-- Split events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  split_date date NOT NULL,
  ratio numeric NOT NULL CHECK (ratio > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker, split_date)
);

COMMENT ON TABLE public.splits IS
  'Stock split events. One row per split per ticker string as recorded in transactions (VGT and VGT:BMV are two listings of the same security and need one row each). Split events are public market facts, not user data.';

-- Splits are public reference data: any authenticated user may read them.
-- Writes go through the service role (edge functions), which bypasses RLS.
ALTER TABLE public.splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.splits;
CREATE POLICY "Public read access" ON public.splits
  FOR SELECT TO authenticated USING (true);

-- Cumulative split factor for a ticker as of a given date.
-- Returns the product of the ratios of every split that happened AFTER
-- p_date, i.e. the factor that converts a quantity held on p_date into
-- post-split shares (the unit Yahoo prices are quoted in).
CREATE OR REPLACE FUNCTION public.split_factor(p_ticker text, p_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_factor numeric := 1;
  r record;
BEGIN
  FOR r IN
    SELECT ratio
    FROM public.splits
    WHERE ticker = p_ticker
      AND split_date > p_date
    ORDER BY split_date
  LOOP
    v_factor := v_factor * r.ratio;
  END LOOP;
  RETURN v_factor;
END;
$function$;

COMMENT ON FUNCTION public.split_factor(text, date) IS
  'Cumulative split factor: product of the ratios of the splits of p_ticker after p_date. Multiply a quantity held on p_date by this factor to express it in post-split shares.';

-- VGT 8:1 split on 2026-04-21 (Yahoo split event). Seeding both listings
-- corrects the VGT history retroactively: no stored price needs rewriting,
-- the factor alone restores the pre-split quantities to post-split shares.
INSERT INTO public.splits (ticker, split_date, ratio) VALUES
  ('VGT', '2026-04-21', 8),
  ('VGT:BMV', '2026-04-21', 8)
ON CONFLICT (ticker, split_date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- get_portfolio_positions: quantities in post-split shares
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_portfolio_positions(p_portfolio_id uuid)
 RETURNS SETOF position_summary
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  r record;
  t_shares numeric;
  t_avg_price numeric;
  t_invested_mxn numeric;
  v_ticker text;
  v_qty numeric;
  v_price numeric;

  pos_map jsonb := '{}'::jsonb;
  ticker_list text[] := array[]::text[];
  item jsonb;

  prices_map jsonb;
  currencies_map jsonb;

  v_current_price numeric;
  v_total_invested numeric;
  v_current_value numeric;
  v_unrealized_pnl numeric;
  v_pnl_percent numeric;
  v_currency text;
begin
  select
    jsonb_object_agg(ticker, price),
    jsonb_object_agg(ticker, currency)
  into prices_map, currencies_map
  from asset_prices;

  for r in (
      select ticker, type, quantity, price_per_unit, fees, fx_rate, date AS tx_date
      from transactions
      where portfolio_id = p_portfolio_id
      order by date asc, created_at asc
  ) loop

    if pos_map ? r.ticker then
       item := pos_map -> r.ticker;
       t_shares := (item ->> 's')::numeric;
       t_avg_price := (item ->> 'a')::numeric;
       t_invested_mxn := coalesce((item ->> 'mxn')::numeric, 0);
    else
       t_shares := 0; t_avg_price := 0; t_invested_mxn := 0;
    end if;

    -- Express this transaction in post-split shares. Yahoo prices are
    -- split-adjusted, so quantities must be too; otherwise a split
    -- understates the position by the split ratio. Cash totals are
    -- split-invariant (qty x price is unchanged), so invested_mxn is
    -- unaffected by the conversion.
    v_qty := r.quantity * public.split_factor(r.ticker, r.tx_date::date);
    v_price := r.price_per_unit / public.split_factor(r.ticker, r.tx_date::date);

    if r.type = 'BUY' then
       if (t_shares + v_qty) > 0 then
         t_avg_price := ((t_shares * t_avg_price) + (v_qty * v_price)) / (t_shares + v_qty);
       end if;

       t_shares := t_shares + v_qty;
       t_invested_mxn := t_invested_mxn + (v_qty * v_price * coalesce(r.fx_rate, 1)) + coalesce(r.fees, 0);

    elsif r.type = 'SELL' then
       if t_shares > 0 then
         t_invested_mxn := t_invested_mxn - (t_invested_mxn * (v_qty / t_shares));
       end if;
       t_shares := t_shares - v_qty;
       if t_shares <= 0.000001 then
          t_invested_mxn := 0;
       end if;
    end if;

    pos_map := jsonb_set(pos_map, array[r.ticker], jsonb_build_object('s', t_shares, 'a', t_avg_price, 'mxn', t_invested_mxn));

    if not (ticker_list @> array[r.ticker]) then
      ticker_list := ticker_list || r.ticker;
    end if;
  end loop;

  foreach v_ticker in array ticker_list loop
      item := pos_map -> v_ticker;
      t_shares := (item ->> 's')::numeric;
      t_avg_price := (item ->> 'a')::numeric;
      t_invested_mxn := coalesce((item ->> 'mxn')::numeric, 0);

      if t_shares > 0.000001 then
          v_current_price := coalesce((prices_map ->> v_ticker)::numeric, 0);
          v_currency := coalesce(currencies_map ->> v_ticker, 'USD');

          v_total_invested := t_shares * t_avg_price;
          v_current_value := t_shares * v_current_price;
          v_unrealized_pnl := v_current_value - v_total_invested;

          if v_total_invested > 0 then
            v_pnl_percent := (v_unrealized_pnl / v_total_invested) * 100;
          else
            v_pnl_percent := 0;
          end if;

          return next row(
            v_ticker, t_shares, t_avg_price, v_total_invested, v_current_value,
            v_unrealized_pnl, v_pnl_percent, v_currency, t_invested_mxn
          )::public.position_summary;
      end if;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------------
-- get_realized_pnl: quantities in post-split shares
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_realized_pnl(p_portfolio_id uuid)
 RETURNS TABLE(ticker text, total_sold_amount numeric, total_cost_basis numeric, realized_pnl numeric, currency text, total_cost_basis_mxn numeric, total_sold_amount_mxn numeric, realized_pnl_mxn numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
    r record;
    t_avg_price numeric := 0;
    t_shares numeric := 0;
    t_invested_mxn numeric := 0;
    v_qty numeric;
    v_price numeric;
    costs_map jsonb := '{}'::jsonb;
    results_map jsonb := '{}'::jsonb;
    ticker_item jsonb;
begin
    for r in (
        select t.ticker, t.type, t.quantity, t.price_per_unit, t.fees, t.fx_rate, t.date AS tx_date, a.currency
        from transactions t
        left join asset_prices a on t.ticker = a.ticker
        where t.portfolio_id = p_portfolio_id
        order by t.date asc, t.created_at asc
    ) loop
        if costs_map ? r.ticker then
            ticker_item := costs_map -> r.ticker;
            t_shares := (ticker_item ->> 's')::numeric;
            t_avg_price := (ticker_item ->> 'a')::numeric;
            t_invested_mxn := coalesce((ticker_item ->> 'mxn')::numeric, 0);
        else
            t_shares := 0; t_avg_price := 0; t_invested_mxn := 0;
        end if;

        -- Express this transaction in post-split shares (see
        -- get_portfolio_positions). Cost basis and proceeds are computed
        -- in the same post-split unit, so a sell after a split matches
        -- the pre-split buys that funded it.
        v_qty := r.quantity * public.split_factor(r.ticker, r.tx_date::date);
        v_price := r.price_per_unit / public.split_factor(r.ticker, r.tx_date::date);

        if r.type = 'BUY' then
            if (t_shares + v_qty) > 0 then
               t_avg_price := ((t_shares * t_avg_price) + (v_qty * v_price)) / (t_shares + v_qty);
            end if;
            t_shares := t_shares + v_qty;
            t_invested_mxn := t_invested_mxn + (v_qty * v_price * coalesce(r.fx_rate, 1)) + coalesce(r.fees, 0);

            costs_map := jsonb_set(costs_map, array[r.ticker], jsonb_build_object('s', t_shares, 'a', t_avg_price, 'mxn', t_invested_mxn));

        elsif r.type = 'SELL' then
            declare
                v_sale_net numeric := (v_qty * v_price);
                v_cost_basis numeric := v_qty * t_avg_price;
                v_realized_gain numeric := v_sale_net - v_cost_basis;

                v_sale_net_mxn numeric := (v_qty * v_price * coalesce(r.fx_rate, 1)) - coalesce(r.fees, 0);
                v_cost_basis_mxn numeric := case when t_shares > 0 then t_invested_mxn * (v_qty / t_shares) else 0 end;
                v_realized_gain_mxn numeric := v_sale_net_mxn - v_cost_basis_mxn;

                res_item jsonb := coalesce(results_map -> r.ticker, '{"sold": 0, "cost": 0, "pnl": 0, "sold_mxn": 0, "cost_mxn": 0, "pnl_mxn": 0}'::jsonb);
            begin
                results_map := jsonb_set(results_map, array[r.ticker], jsonb_build_object(
                    'sold', (res_item ->> 'sold')::numeric + v_sale_net,
                    'cost', (res_item ->> 'cost')::numeric + v_cost_basis,
                    'pnl', (res_item ->> 'pnl')::numeric + v_realized_gain,
                    'curr', coalesce(r.currency, 'USD'),
                    'sold_mxn', (res_item ->> 'sold_mxn')::numeric + v_sale_net_mxn,
                    'cost_mxn', (res_item ->> 'cost_mxn')::numeric + v_cost_basis_mxn,
                    'pnl_mxn', (res_item ->> 'pnl_mxn')::numeric + v_realized_gain_mxn
                ));
            end;
            if t_shares > 0 then
                t_invested_mxn := t_invested_mxn - (t_invested_mxn * (v_qty / t_shares));
            end if;
            t_shares := t_shares - v_qty;
            costs_map := jsonb_set(costs_map, array[r.ticker], jsonb_build_object('s', t_shares, 'a', t_avg_price, 'mxn', t_invested_mxn));
        end if;
    end loop;

    return query
    select
        key,
        (value ->> 'sold')::numeric,
        (value ->> 'cost')::numeric,
        (value ->> 'pnl')::numeric,
        (value ->> 'curr')::text,
        (value ->> 'cost_mxn')::numeric,
        (value ->> 'sold_mxn')::numeric,
        (value ->> 'pnl_mxn')::numeric
    from jsonb_each(results_map);
end;
$function$;

-- ---------------------------------------------------------------------------
-- get_portfolio_history: quantities in post-split shares; no invented FX rate
-- ---------------------------------------------------------------------------

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
        SELECT SUM(
          (CASE WHEN t.type = 'BUY' THEN t.quantity ELSE -t.quantity END)
          * public.split_factor(t.ticker, t.date::date)
        )
        FROM transactions t
        WHERE t.portfolio_id = p_portfolio_id
          AND t.ticker = ut.ticker
          AND t.date::date <= bd.d
      ), 0) AS shares,
      -- Calculate net cash flow (invested amount) up to this date.
      -- Cash totals are split-invariant, so net_cash uses the raw
      -- quantities and prices (no split factor).
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
      -- Last known USD-MXN rate. There is no invented fallback: if no
      -- rate is known yet for this date, the day is excluded below
      -- instead of silently converting at a made-up rate.
      (SELECT hp.close_price FROM historical_prices hp WHERE hp.ticker = 'USD-MXN' AND hp.date <= ds.curr_date ORDER BY hp.date DESC LIMIT 1) AS usd_mxn_rate
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
  WHERE dp.usd_mxn_rate IS NOT NULL
  GROUP BY dp.curr_date
  ORDER BY dp.curr_date ASC;
END;
$function$;
