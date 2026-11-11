-- Migración: copia fiel del SQL vivo de public.get_realized_pnl
-- en el proyecto Supabase "portfolio" (ref xmgbvjkmkzhrndezozbu),
-- leído con pg_get_functiondef() el 2026-11-11. Sin cambios funcionales.
-- Asume que ya existen las tablas transactions y asset_prices.

-- get_realized_pnl
-- Fuente: pg_get_functiondef() leído vía Supabase Management API el 2026-11-11
-- Proyecto: portfolio (xmgbvjkmkzhrndezozbu). Sin cambios; copia fiel del SQL vivo.
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
    costs_map jsonb := '{}'::jsonb;
    results_map jsonb := '{}'::jsonb;
    ticker_item jsonb;
begin
    for r in (
        select t.ticker, t.type, t.quantity, t.price_per_unit, t.fees, t.fx_rate, a.currency
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

        if r.type = 'BUY' then
            if (t_shares + r.quantity) > 0 then
               t_avg_price := ((t_shares * t_avg_price) + (r.quantity * r.price_per_unit)) / (t_shares + r.quantity);
            end if;
            t_shares := t_shares + r.quantity;
            t_invested_mxn := t_invested_mxn + (r.quantity * r.price_per_unit * coalesce(r.fx_rate, 1)) + coalesce(r.fees, 0);

            costs_map := jsonb_set(costs_map, array[r.ticker], jsonb_build_object('s', t_shares, 'a', t_avg_price, 'mxn', t_invested_mxn));

        elsif r.type = 'SELL' then
            declare
                v_sale_net numeric := (r.quantity * r.price_per_unit);
                v_cost_basis numeric := r.quantity * t_avg_price;
                v_realized_gain numeric := v_sale_net - v_cost_basis;

                v_sale_net_mxn numeric := (r.quantity * r.price_per_unit * coalesce(r.fx_rate, 1)) - coalesce(r.fees, 0);
                v_cost_basis_mxn numeric := case when t_shares > 0 then t_invested_mxn * (r.quantity / t_shares) else 0 end;
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
                t_invested_mxn := t_invested_mxn - (t_invested_mxn * (r.quantity / t_shares));
            end if;
            t_shares := t_shares - r.quantity;
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
$function$
