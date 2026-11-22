
-- ===== Enums =====
create type public.app_role as enum ('super_admin', 'admin', 'editor');
create type public.member_stage as enum ('registered','pending_approval','approved','sponsorship_approved','waiting_for_flight','alumni','rejected','withdrawn');
create type public.payment_state as enum ('unpaid','pending','paid','failed');
create type public.payment_txn_status as enum ('initiated','queued','success','failed','cancelled');

-- ===== Helpers =====
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== Staff profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and r.role = _role and p.active
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and p.active
  )
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
    where r.user_id = _user_id and p.active and r.role in ('super_admin','admin')
  )
$$;

create policy "Staff read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));
create policy "Read own roles or super admin reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- ===== Applications =====
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  full_name text not null,
  national_id text not null,
  phone text not null,
  email text not null,
  county text not null,
  stage public.member_stage not null default 'registered',
  payment_status public.payment_state not null default 'unpaid',
  public_consent boolean not null default false,
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),
  info_requested text,
  info_requested_at timestamptz,
  applicant_token_hash text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index applications_national_id_key on public.applications (lower(national_id));
create index applications_stage_idx on public.applications (stage);
create index applications_payment_idx on public.applications (payment_status);
create index applications_created_idx on public.applications (created_at desc);
grant select, update on public.applications to authenticated;
grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "Admins read applications" on public.applications for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins update applications" on public.applications for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

create or replace function public.set_application_reference()
returns trigger language plpgsql set search_path = public as $$
declare ref text;
begin
  if new.reference is null or new.reference = '' then
    loop
      ref := 'SS-' || to_char(now(), 'YY') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.applications where reference = ref);
    end loop;
    new.reference := ref;
  end if;
  return new;
end; $$;
create trigger applications_reference before insert on public.applications for each row execute function public.set_application_reference();

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);
create index application_documents_app_idx on public.application_documents (application_id);
grant select on public.application_documents to authenticated;
grant all on public.application_documents to service_role;
alter table public.application_documents enable row level security;
create policy "Admins read documents" on public.application_documents for select to authenticated using (public.is_admin(auth.uid()));

create table public.application_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null,
  author_email text,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index application_notes_app_idx on public.application_notes (application_id);
grant select, insert on public.application_notes to authenticated;
grant all on public.application_notes to service_role;
alter table public.application_notes enable row level security;
create policy "Admins read notes" on public.application_notes for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins add notes" on public.application_notes for insert to authenticated with check (public.is_admin(auth.uid()) and author_id = auth.uid());

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage public.member_stage,
  to_stage public.member_stage not null,
  changed_by uuid,
  changed_by_email text,
  note text,
  created_at timestamptz not null default now()
);
create index status_history_app_idx on public.status_history (application_id, created_at desc);
grant select on public.status_history to authenticated;
grant all on public.status_history to service_role;
alter table public.status_history enable row level security;
create policy "Admins read status history" on public.status_history for select to authenticated using (public.is_admin(auth.uid()));

create table public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_activity_created_idx on public.admin_activity_logs (created_at desc);
grant select on public.admin_activity_logs to authenticated;
grant all on public.admin_activity_logs to service_role;
alter table public.admin_activity_logs enable row level security;
create policy "Admins read activity" on public.admin_activity_logs for select to authenticated using (public.is_admin(auth.uid()));

create or replace function public.log_admin_activity(_action text, _target_type text, _target_id text, _details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Not authorised'; end if;
  insert into public.admin_activity_logs (actor_id, actor_email, action, target_type, target_id, details)
  values (auth.uid(), (select email from public.profiles where id = auth.uid()), _action, _target_type, _target_id, coalesce(_details, '{}'::jsonb));
end; $$;

create or replace function public.change_application_stage(_application_id uuid, _to_stage public.member_stage, _note text default null)
returns public.member_stage language plpgsql security definer set search_path = public as $$
declare current_stage public.member_stage; actor_email text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorised'; end if;
  select stage into current_stage from public.applications where id = _application_id for update;
  if current_stage is null then raise exception 'Application not found'; end if;
  if current_stage = _to_stage then return current_stage; end if;
  select email into actor_email from public.profiles where id = auth.uid();
  update public.applications set stage = _to_stage where id = _application_id;
  insert into public.status_history (application_id, from_stage, to_stage, changed_by, changed_by_email, note)
    values (_application_id, current_stage, _to_stage, auth.uid(), actor_email, nullif(trim(_note), ''));
  insert into public.admin_activity_logs (actor_id, actor_email, action, target_type, target_id, details)
    values (auth.uid(), actor_email, 'application.stage_changed', 'application', _application_id::text,
      jsonb_build_object('from', current_stage, 'to', _to_stage, 'note', _note));
  return _to_stage;
end; $$;

-- ===== Payments =====
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  amount integer not null,
  phone text not null,
  external_reference text not null unique,
  provider_reference text unique,
  checkout_request_id text,
  mpesa_receipt text unique,
  status public.payment_txn_status not null default 'initiated',
  result_desc text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_app_idx on public.payments (application_id, created_at desc);
create index payments_status_idx on public.payments (status);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "Admins read payments" on public.payments for select to authenticated using (public.is_admin(auth.uid()));
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.payment_callbacks (
  id uuid primary key default gen_random_uuid(),
  external_reference text,
  payload jsonb not null,
  verified boolean not null default false,
  processing_result text,
  received_at timestamptz not null default now()
);
create index payment_callbacks_received_idx on public.payment_callbacks (received_at desc);
grant select on public.payment_callbacks to authenticated;
grant all on public.payment_callbacks to service_role;
alter table public.payment_callbacks enable row level security;
create policy "Admins read callbacks" on public.payment_callbacks for select to authenticated using (public.is_admin(auth.uid()));

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  policy_version text not null,
  user_agent text,
  accepted_at timestamptz not null default now()
);
grant select on public.terms_acceptances to authenticated;
grant all on public.terms_acceptances to service_role;
alter table public.terms_acceptances enable row level security;
create policy "Admins read terms acceptances" on public.terms_acceptances for select to authenticated using (public.is_admin(auth.uid()));

-- ===== Testimonials =====
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  role_title text,
  quote text not null,
  photo_url text,
  consent_confirmed boolean not null default false,
  published boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
grant all on public.testimonials to service_role;
alter table public.testimonials enable row level security;
create policy "Public reads published testimonials" on public.testimonials for select to anon, authenticated
  using (published and consent_confirmed);
create policy "Staff read all testimonials" on public.testimonials for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff add testimonials" on public.testimonials for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff edit testimonials" on public.testimonials for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete testimonials" on public.testimonials for delete to authenticated using (public.is_staff(auth.uid()));
create trigger testimonials_touch before update on public.testimonials for each row execute function public.touch_updated_at();

create or replace function public.testimonial_publish_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.published and not new.consent_confirmed then
    raise exception 'Consent must be confirmed before publishing a testimonial';
  end if;
  if not new.published then new.featured := false; end if;
  return new;
end; $$;
create trigger testimonials_guard before insert or update on public.testimonials for each row execute function public.testimonial_publish_guard();

-- ===== Site content =====
create table public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant select on public.site_content to anon;
grant select, insert, update on public.site_content to authenticated;
grant all on public.site_content to service_role;
alter table public.site_content enable row level security;
create policy "Anyone reads site content" on public.site_content for select to anon, authenticated using (true);
create policy "Staff insert site content" on public.site_content for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "Staff update site content" on public.site_content for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create trigger site_content_touch before update on public.site_content for each row execute function public.touch_updated_at();

-- ===== Integration settings (server only) =====
create table public.integration_settings (
  key text primary key,
  public_config jsonb not null default '{}'::jsonb,
  secret_ciphertext text,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
grant all on public.integration_settings to service_role;
alter table public.integration_settings enable row level security;

-- ===== Email =====
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.email_templates to authenticated;
grant all on public.email_templates to service_role;
alter table public.email_templates enable row level security;
create policy "Admins read templates" on public.email_templates for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins add templates" on public.email_templates for insert to authenticated with check (public.is_admin(auth.uid()));
create policy "Admins edit templates" on public.email_templates for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admins delete custom templates" on public.email_templates for delete to authenticated using (public.is_admin(auth.uid()) and slug is null);
create trigger email_templates_touch before update on public.email_templates for each row execute function public.touch_updated_at();

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  category text not null default 'custom',
  status text not null check (status in ('sent','failed','not_configured')),
  error text,
  provider text,
  provider_message_id text,
  sent_by uuid,
  batch_id uuid,
  created_at timestamptz not null default now()
);
create index email_logs_created_idx on public.email_logs (created_at desc);
create index email_logs_app_idx on public.email_logs (application_id);
grant select on public.email_logs to authenticated;
grant all on public.email_logs to service_role;
alter table public.email_logs enable row level security;
create policy "Admins read email logs" on public.email_logs for select to authenticated using (public.is_admin(auth.uid()));

-- ===== Contact messages =====
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
alter table public.contact_messages enable row level security;
create policy "Admins read messages" on public.contact_messages for select to authenticated using (public.is_admin(auth.uid()));
create policy "Admins update messages" on public.contact_messages for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ===== Rate limiting (server only) =====
create table public.rate_limit_hits (
  id bigserial primary key,
  key text not null,
  hit_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on public.rate_limit_hits (key, hit_at desc);
grant all on public.rate_limit_hits to service_role;
grant usage, select on sequence public.rate_limit_hits_id_seq to service_role;
alter table public.rate_limit_hits enable row level security;

create or replace function public.hit_rate_limit(_key text, _max integer, _window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.rate_limit_hits where key = _key and hit_at < now() - make_interval(secs => _window_seconds);
  select count(*) into n from public.rate_limit_hits where key = _key;
  if n >= _max then return false; end if;
  insert into public.rate_limit_hits (key) values (_key);
  return true;
end; $$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- ===== Public directory (safe columns only) =====
create or replace function public.public_display_name(_full_name text)
returns text language sql immutable set search_path = public as $$
  select case
    when array_length(regexp_split_to_array(trim(_full_name), '\s+'), 1) > 1 then
      initcap(split_part(trim(_full_name), ' ', 1)) || ' ' ||
      upper(left((regexp_split_to_array(trim(_full_name), '\s+'))[array_length(regexp_split_to_array(trim(_full_name), '\s+'), 1)], 1)) || '.'
    else initcap(trim(_full_name))
  end
$$;

create or replace function public.public_directory(_list text)
returns table (display_name text, county text, listed_since timestamptz)
language sql stable security definer set search_path = public as $$
  select public.public_display_name(a.full_name), a.county, coalesce(a.paid_at, a.created_at)
  from public.applications a
  where a.public_consent and a.payment_status = 'paid'
    and case _list
      when 'members' then a.stage not in ('rejected','withdrawn')
      when 'sponsorship' then a.stage = 'sponsorship_approved'
      when 'flight' then a.stage = 'waiting_for_flight'
      when 'alumni' then a.stage = 'alumni'
      else false end
  order by coalesce(a.paid_at, a.created_at) desc
  limit 2000
$$;
grant execute on function public.public_directory(text) to anon, authenticated;

create or replace function public.public_directory_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members', count(*) filter (where stage not in ('rejected','withdrawn')),
    'sponsorship', count(*) filter (where stage = 'sponsorship_approved'),
    'flight', count(*) filter (where stage = 'waiting_for_flight'),
    'alumni', count(*) filter (where stage = 'alumni'))
  from public.applications where public_consent and payment_status = 'paid'
$$;
grant execute on function public.public_directory_counts() to anon, authenticated;

create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Not authorised'; end if;
  select jsonb_build_object(
    'total', (select count(*) from public.applications),
    'paid', (select count(*) from public.applications where payment_status = 'paid'),
    'pending', (select count(*) from public.applications where stage = 'pending_approval'),
    'approved', (select count(*) from public.applications where stage = 'approved'),
    'sponsorship', (select count(*) from public.applications where stage = 'sponsorship_approved'),
    'flight', (select count(*) from public.applications where stage = 'waiting_for_flight'),
    'alumni', (select count(*) from public.applications where stage = 'alumni'),
    'rejected', (select count(*) from public.applications where stage in ('rejected','withdrawn')),
    'revenue', (select coalesce(sum(amount), 0) from public.payments where status = 'success'),
    'unread_messages', (select count(*) from public.contact_messages where not handled)
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_overview() to authenticated;

-- ===== Seed: editable site content & default email templates =====
insert into public.site_content (key, value) values
('home', jsonb_build_object(
  'eyebrow', 'Sponsored work travel · Kenya to Canada',
  'headline', 'Your journey to working in Canada starts with one honest step.',
  'subheadline', 'Steve Safari connects committed Kenyan applicants with sponsored work opportunities in Canada — with clear stages, transparent records and one fixed registration fee of KES 500.',
  'cta_label', 'Register for KES 500',
  'hero_image', ''
)),
('about', jsonb_build_object(
  'title', 'About Steve Safari',
  'intro', 'Steve Safari is a Kenyan programme that guides applicants through every step of pursuing sponsored employment in Canada — from registration and document review to sponsorship matching and travel preparation.',
  'body', 'We believe the road abroad should be transparent. Every applicant pays one registration fee of KES 500 and can track their application at any time. Progress through our stages depends on eligibility, document review and the decisions of sponsors and Canadian authorities — never on extra payments to us.',
  'mission', 'To give hard-working Kenyans a clear, honest and well-guided path to sponsored work in Canada.',
  'image', ''
)),
('contact', jsonb_build_object(
  'phone', '+254 700 000 000',
  'email', 'hello@stevesafari.co.ke',
  'whatsapp', '+254 700 000 000',
  'address', 'Nairobi, Kenya',
  'hours', 'Monday – Friday, 8:00am – 5:00pm EAT'
)),
('social', jsonb_build_object('facebook', '', 'instagram', '', 'x', '', 'tiktok', '', 'youtube', '', 'linkedin', '')),
('programmes', jsonb_build_object('items', jsonb_build_array(
  jsonb_build_object('title', 'Registration & review', 'description', 'Submit your details and pay the one-time KES 500 fee. Our team reviews every application and supporting document.'),
  jsonb_build_object('title', 'Sponsorship matching', 'description', 'Approved members are considered for sponsorship by partner employers in Canada, subject to their own selection.'),
  jsonb_build_object('title', 'Travel preparation', 'description', 'Members with confirmed sponsorship move to the flight waiting list and receive guidance on documents and departure.'),
  jsonb_build_object('title', 'Alumni network', 'description', 'Members who have completed the programme join our alumni and help guide the next group of applicants.')
)))
on conflict (key) do nothing;

insert into public.email_templates (slug, name, subject, body) values
('registration_received', 'Registration received', 'We received your Steve Safari registration ({{reference}})', 'Hello {{first_name}},

Thank you for registering with Steve Safari. Your reference number is {{reference}}.

To complete your registration, please pay the one-time registration fee of KES 500 via M-Pesa. You can check your status at any time on our website using your reference number and national ID.

Registration does not guarantee sponsorship, flights, visas or programme acceptance.

Steve Safari'),
('payment_confirmed', 'Payment confirmed', 'Payment received — KES 500 ({{reference}})', 'Hello {{first_name}},

We have confirmed your KES 500 registration payment. M-Pesa receipt: {{receipt}}.

Your application is now pending review. We will contact you as it progresses.

Steve Safari'),
('approved', 'Application approved', 'Your Steve Safari application has been approved', 'Hello {{first_name}},

Good news — your application ({{reference}}) has been approved. You are now an approved member and will be considered for sponsorship opportunities.

Steve Safari'),
('rejected', 'Application not approved', 'Update on your Steve Safari application', 'Hello {{first_name}},

Thank you for your interest in Steve Safari. After review, we are unable to approve your application ({{reference}}) at this time.

{{message}}

Steve Safari'),
('sponsorship_approved', 'Sponsorship approved', 'Your sponsorship has been approved', 'Hello {{first_name}},

Congratulations — your sponsorship has been approved. Our team will be in touch with the next steps.

Steve Safari'),
('waiting_for_flight', 'Added to flight waiting list', 'You are on the Steve Safari flight waiting list', 'Hello {{first_name}},

You have been added to the flight waiting list. We will share travel details as soon as they are confirmed.

Steve Safari'),
('alumni', 'Welcome to the alumni', 'Welcome to the Steve Safari alumni', 'Hello {{first_name}},

Congratulations on completing the programme. You are now part of the Steve Safari alumni network.

Steve Safari'),
('info_requested', 'Additional information requested', 'More information needed for your application ({{reference}})', 'Hello {{first_name}},

To continue reviewing your application, we need the following:

{{message}}

Please reply to this email or contact us using the details on our website.

Steve Safari');
