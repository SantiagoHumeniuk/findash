-- Closes open policies: anyone (even without an account) could read every profile and log,
-- and change any profile's plan or make themselves administrator.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'administrador');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Profiles: each user sees and edits their own row; administrators manage all of them.
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists "Enable update for all users" on public.profiles;
do $$
declare stale record;
begin
  for stale in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'UPDATE')
      and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy %I on public.profiles', stale.policyname);
  end loop;
end $$;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());
create policy "Admins can update all profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- A user may edit their own row, but never their plan, permissions or identity.
-- Edge Functions (service role) and SECURITY DEFINER functions run as other roles and are trusted.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := 'basico';
    new.can_upload_blog := false;
    return new;
  end if;
  if new.role is distinct from old.role
    or new.can_upload_blog is distinct from old.can_upload_blog
    or new.email is distinct from old.email
    or new.id is distinct from old.id
    or new.api_key is distinct from old.api_key
  then
    raise exception 'No podés modificar el plan ni los permisos de tu cuenta.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Blog pages show the author's name and avatar without exposing the rest of the profile.
create or replace view public.public_profiles as
  select
    p.id,
    p.first_name,
    p.last_name,
    p.can_upload_blog,
    jsonb_build_object(
      'avatarIndex', p.onboarding_profile -> 'avatarIndex',
      'avatarImage', p.onboarding_profile -> 'avatarImage'
    ) as onboarding_profile
  from public.profiles p
  where exists (select 1 from public.blogs b where b.user_id = p.id and b.status = 'approved')
    or exists (select 1 from public.blog_comments c where c.user_id = p.id);
grant select on public.public_profiles to anon, authenticated;

-- Logs: only administrators read them; everyone keeps writing through log_event.
do $$
declare stale record;
begin
  for stale in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'logs' and cmd = 'SELECT'
  loop
    execute format('drop policy %I on public.logs', stale.policyname);
  end loop;
end $$;
create policy "Admins can view logs" on public.logs
  for select using (public.is_admin());

-- Suggestions: authors see their own; only administrators change or delete them.
-- The old administrator policy compared against a role name that does not exist ('admin').
do $$
declare stale record;
begin
  for stale in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'suggestions' and cmd in ('SELECT', 'UPDATE', 'ALL')
  loop
    execute format('drop policy %I on public.suggestions', stale.policyname);
  end loop;
end $$;
create policy "Users can view their own suggestions" on public.suggestions
  for select using (auth.uid() = user_id);
create policy "Admins can manage suggestions" on public.suggestions
  for all using (public.is_admin()) with check (public.is_admin());

-- Contact helpers ran with owner rights for any caller; as invoker they obey the admin-only policies.
alter function public.mark_contact_message_as_read(uuid) security invoker;
alter function public.mark_contact_message_as_replied(uuid, text) security invoker;
alter function public.get_contact_messages_stats() security invoker;
