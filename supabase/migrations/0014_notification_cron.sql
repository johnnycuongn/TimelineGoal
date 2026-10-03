-- Push notifications, part 3: the clocks. Needs the Vault entries send_push_url and
-- dispatch_secret (see the plan, Tasks 5 and 6) before it does anything useful.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Triggers have been queueing since 0012, before anything could send. Those notes are
-- stale by now; launch with an empty queue rather than a burst of old news.
update public.notification_outbox
   set cancelled_at = now(), last_error = 'before launch'
 where sent_at is null and cancelled_at is null;

-- Calls send-push only when something is due, so a quiet den costs no invocations.
create or replace function public.dispatch_notifications()
returns bigint
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  fn_url text;
  secret text;
begin
  if not exists (
    select 1 from public.notification_outbox
     where sent_at is null and cancelled_at is null and send_after <= now()
       and (claimed_at is null or claimed_at < now() - interval '2 minutes')
  ) then
    return null;
  end if;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'send_push_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'dispatch_secret';
  if fn_url is null or secret is null then
    raise warning 'send-push is not configured in Vault';
    return null;
  end if;
  return net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end
$$;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;

select cron.schedule('dispatch-notifications', '30 seconds', 'select public.dispatch_notifications()');
select cron.schedule('enqueue-reminders', '*/15 * * * *', 'select public.enqueue_reminders()');
select cron.schedule('prune-notifications', '0 4 * * *', 'select public.prune_notifications()');
