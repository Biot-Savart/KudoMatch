-- Phase 15 prediction deletion lock contract
begin;
select plan(5);

select has_function('private', 'fn_validate_prediction_delete', 'Prediction delete lock trigger function exists');
select has_trigger('public', 'predictions', 'trg_validate_prediction_delete', 'Prediction delete lock trigger is installed');
select ok(
  position('request.jwt.claim.role' in pg_get_functiondef(p.oid)) > 0,
  'Delete lock distinguishes authenticated requests from service-role maintenance'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname = 'fn_validate_prediction_delete';
select ok(
  position('now()' in pg_get_functiondef(p.oid)) > 0 and
  position('locks_at' in pg_get_functiondef(p.oid)) > 0,
  'Delete lock checks the market lock timestamp'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname = 'fn_validate_prediction_delete';
select ok(
  exists (
    select 1 from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'predictions' and p.polname = 'predictions_delete_own'
  ),
  'Ownership remains enforced by RLS'
);

select * from finish();
rollback;
