-- Admin replacements for the logos and photos used on the public blog.
-- The site ships with default images; a row here overrides one of them.
create table if not exists public.blog_images (
  key text primary key,
  url text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.blog_images enable row level security;

drop policy if exists "Anyone reads blog images" on public.blog_images;
create policy "Anyone reads blog images" on public.blog_images
  for select to public using (true);

drop policy if exists "Admins manage blog images" on public.blog_images;
create policy "Admins manage blog images" on public.blog_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.blog_images to anon, authenticated;
grant insert, update, delete on public.blog_images to authenticated;
