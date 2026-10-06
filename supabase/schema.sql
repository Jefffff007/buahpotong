-- Jalankan seluruh file ini di Supabase Dashboard > SQL Editor > New query > Run.
-- Kalau sebelumnya sudah pernah menjalankan versi lama file ini, aman untuk
-- dijalankan ulang (pakai "drop policy if exists" dan "on conflict").

-- 1) Tabel pesanan
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nama text not null,
  lantai text not null,
  buah text[] not null,
  bukti_path text not null, -- path file di storage, BUKAN url publik
  status text not null default 'baru' check (status in ('baru','selesai'))
);

-- Kalau kolom lama "bukti_url" masih ada dari setup sebelumnya, pindahkan
-- isinya lalu hapus (aman dijalankan meski kolomnya tidak ada).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='orders' and column_name='bukti_url') then
    execute 'alter table public.orders rename column bukti_url to bukti_path';
  end if;
end $$;

alter table public.orders enable row level security;

-- Pembeli (anon/tanpa login) HANYA boleh membuat pesanan baru.
-- Mereka tidak bisa membaca, mengubah, atau menghapus pesanan siapa pun,
-- termasuk pesanan mereka sendiri.
drop policy if exists "orders_select_anon" on public.orders;
drop policy if exists "orders_update_anon" on public.orders;
drop policy if exists "orders_delete_anon" on public.orders;

drop policy if exists "orders_insert_anon" on public.orders;
create policy "orders_insert_anon" on public.orders
  for insert to anon with check (true);

-- Dashboard (hanya kamu, setelah login) boleh membaca, mengubah status,
-- dan menghapus pesanan.
drop policy if exists "orders_select_auth" on public.orders;
create policy "orders_select_auth" on public.orders
  for select to authenticated using (true);

drop policy if exists "orders_update_auth" on public.orders;
create policy "orders_update_auth" on public.orders
  for update to authenticated using (true) with check (true);

drop policy if exists "orders_delete_auth" on public.orders;
create policy "orders_delete_auth" on public.orders
  for delete to authenticated using (true);

-- Aktifkan realtime agar dashboard update otomatis tanpa refresh
alter publication supabase_realtime add table public.orders;

-- 2) Storage bucket untuk screenshot bukti pembayaran.
-- public=false: file TIDAK bisa diakses lewat link biasa oleh siapa pun.
-- Hanya dashboard yang sudah login yang bisa minta "signed url" sementara.
insert into storage.buckets (id, name, public)
values ('bukti-bayar', 'bukti-bayar', false)
on conflict (id) do update set public = false;

-- Pembeli (anon) hanya boleh mengunggah, tidak boleh membaca/mendaftar isi folder.
drop policy if exists "bukti_bayar_select_anon" on storage.objects;
drop policy if exists "bukti_bayar_insert_anon" on storage.objects;
create policy "bukti_bayar_insert_anon" on storage.objects
  for insert to anon with check (bucket_id = 'bukti-bayar');

-- Hanya kamu (setelah login) yang boleh melihat/mengunduh bukti pembayaran.
drop policy if exists "bukti_bayar_select_auth" on storage.objects;
create policy "bukti_bayar_select_auth" on storage.objects
  for select to authenticated using (bucket_id = 'bukti-bayar');
