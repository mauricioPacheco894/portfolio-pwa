-- Migración: copia fiel del SQL vivo de public.get_portfolio_positions
-- en el proyecto Supabase "portfolio" (ref xmgbvjkmkzhrndezozbu),
-- leído con pg_get_functiondef() el 2026-11-11. Sin cambios funcionales.
-- Asume que ya existen el tipo position_summary y las tablas
-- transactions y asset_prices.

-- get_portfolio_positions
-- Fuente: pg_get_functiondef() leído vía Supabase Management API el 2026-11-11
-- Proyecto: portfolio (xmgbvjkmkzhrndezozbu). Sin cambios; copia fiel del SQL vivo.
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
      select ticker, type, quantity, price_per_unit, fees, fx_rate
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

    if r.type = 'BUY' then
       if (t_shares + r.quantity) > 0 then
         t_avg_price := ((t_shares * t_avg_price) + (r.quantity * r.price_per_unit)) / (t_shares + r.quantity);
       end if;

       t_shares := t_shares + r.quantity;
       t_invested_mxn := t_invested_mxn + (r.quantity * r.price_per_unit * coalesce(r.fx_rate, 1)) + coalesce(r.fees, 0);

    elsif r.type = 'SELL' then
       if t_shares > 0 then
         t_invested_mxn := t_invested_mxn - (t_invested_mxn * (r.quantity / t_shares));
       end if;
       t_shares := t_shares - r.quantity;
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
$function$
