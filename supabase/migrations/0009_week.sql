-- A week between a day and a month. On its own because Postgres will not let a new enum
-- value be used in the transaction that adds it; 0010_climb.sql teaches the rules about it.
-- BEFORE 'month' keeps the enum in length order, which is what lets goals_validate say
-- "a parent's horizon is longer than its child's" as a plain `>`.
alter type public.horizon add value if not exists 'week' before 'month';
