-- ============================================================================
-- Migration: Grant table-level UPDATE on predictions to authenticated role
-- Enables PostgREST upsert queries (INSERT ... ON CONFLICT DO UPDATE) from the client.
-- Row Level Security (RLS) policies and before-update triggers enforce user ownership
-- and kickoff locking.
-- ============================================================================

grant update on public.predictions to authenticated;
