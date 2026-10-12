create extension if not exists pgcrypto;

create table if not exists public.propiedades (
    id uuid primary key default gen_random_uuid(),
    titulo text not null check (char_length(titulo) between 3 and 150),
    tipo text not null check (tipo in ('Casa', 'Departamento', 'Local comercial', 'Edificio', 'Terreno', 'Terreno Ejidal')),
    estado text not null check (estado in ('Jalisco', 'Ciudad de México', 'Nuevo León', 'Estado de México', 'Guanajuato')),
    ubicacion text not null check (char_length(ubicacion) between 3 and 200),
    precio numeric(14,2) not null check (precio > 0),
    superficie numeric(12,2) not null check (superficie > 0),
    documento text not null check (documento in ('Escritura Pública RPP', 'Certificado Parcelario RAN')),
    descripcion text not null check (char_length(descripcion) between 10 and 5000),
    imagen_url text check (imagen_url is null or imagen_url like 'https://%'),
    vendedor_nombre text not null check (char_length(vendedor_nombre) between 3 and 120),
    vendedor_rfc text not null check (vendedor_rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
    vendedor_tel text not null check (vendedor_tel ~ '^[0-9]{10}$'),
    vendedor_tipo text not null check (vendedor_tipo in ('Vendedor/Propietario', 'Comprador')),
    status text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
    created_at timestamptz not null default now(),
    revisada_at timestamptz
);

create index if not exists propiedades_status_idx on public.propiedades (status, created_at desc);

alter table public.propiedades enable row level security;

revoke all on public.propiedades from anon, authenticated;
grant insert on public.propiedades to anon, authenticated;

drop policy if exists "publicar_pendientes" on public.propiedades;
create policy "publicar_pendientes"
    on public.propiedades
    for insert
    to anon, authenticated
    with check (status = 'pendiente');

create or replace view public.propiedades_publicas as
select
    id,
    titulo,
    tipo,
    estado,
    ubicacion,
    precio,
    superficie,
    documento,
    descripcion,
    imagen_url,
    vendedor_nombre,
    vendedor_tel,
    created_at
from public.propiedades
where status = 'aprobada';

grant select on public.propiedades_publicas to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "subir_fotos" on storage.objects;
create policy "subir_fotos"
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'fotos');
