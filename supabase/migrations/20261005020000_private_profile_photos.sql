begin;

-- Photos are private and accessible only to the enabled owner. The server stores
-- a resized JPEG without EXIF, never the original upload.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,204800,array['image/jpeg']);

create function private.can_manage_profile_photo(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select object_name = auth.uid()::text || '/avatar.jpg'
    and exists(select 1 from public.profiles where id=auth.uid() and enabled)
$$;
revoke all on function private.can_manage_profile_photo(text) from public,anon;
grant execute on function private.can_manage_profile_photo(text) to authenticated;

create policy profile_photos_select on storage.objects for select to authenticated
using(bucket_id='profile-photos' and private.can_manage_profile_photo(name));
create policy profile_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='profile-photos' and private.can_manage_profile_photo(name));
create policy profile_photos_update on storage.objects for update to authenticated
using(bucket_id='profile-photos' and private.can_manage_profile_photo(name))
with check(bucket_id='profile-photos' and private.can_manage_profile_photo(name));
create policy profile_photos_delete on storage.objects for delete to authenticated
using(bucket_id='profile-photos' and private.can_manage_profile_photo(name));

commit;
