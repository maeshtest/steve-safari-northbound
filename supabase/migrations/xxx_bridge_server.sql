-- Create app_settings table if it doesn't exist
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 1. Function to validate the bridge token
create or replace function public.bridge_ok(_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return _token is not null and length(_token) >= 32 and exists (
    select 1 from public.app_settings
    where key = 'server.bridge'
      and value->>'hash' = encode(digest(_token, 'sha256'), 'hex')
  );
end;
$$;

-- 2. Function for Super Admins to generate the key
create or replace function public.admin_generate_server_key()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_token text;
begin
  -- Replace this with your actual role check
  select public.get_my_staff_role() into v_role;
  if v_role is distinct from 'super_admin' then
    raise exception 'Only a Super Admin can generate the bridge key';
  end if;

  -- Generate a secure token (hlsk_ prefix)
  v_token := 'hlsk_' || encode(gen_random_bytes(32), 'hex');

  -- Store the hash in app_settings
  insert into public.app_settings (key, value)
  values ('server.bridge', jsonb_build_object('hash', encode(digest(v_token, 'sha256'), 'hex')))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return v_token;
end;
$$;

-- 3. Example Protected RPC: Read Setting
create or replace function public.bridge_setting(_token text, _key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  if not public.bridge_ok(_token) then
    raise exception 'Invalid server key';
  end if;

  -- Whitelist allowed settings so external sites can't read arbitrary data
  if _key not in ('email.resend', 'payments.payhero') then
    raise exception 'Setting not allowed';
  end if;

  select value into v_value from public.app_settings where key = _key;
  return v_value;
end;
$$;
