
create policy "Admins read applicant documents" on storage.objects for select to authenticated
  using (bucket_id = 'application-documents' and public.is_admin(auth.uid()));

create policy "Staff read site media" on storage.objects for select to authenticated
  using (bucket_id = 'site-media' and public.is_staff(auth.uid()));
create policy "Staff upload site media" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_staff(auth.uid()));
create policy "Staff update site media" on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_staff(auth.uid()));
create policy "Staff delete site media" on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_staff(auth.uid()));
