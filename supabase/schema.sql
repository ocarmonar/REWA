-- ============================================================================
-- CLUB DEPORTIVO REWA - ESQUEMA DE BASE DE DATOS (Supabase / PostgreSQL)
-- ============================================================================
-- Convenciones:
--   - Todas las tablas usan uuid como PK (gen_random_uuid()).
--   - "Estado" (no eliminado) se maneja con columnas activo/estado, nunca DELETE.
--   - "vencido" en mensualidades es DERIVADO (ver vista v_mensualidades), no se
--     guarda como fuente de verdad para no depender de un cron.
-- ============================================================================

create extension if not exists "pgcrypto";

-- El club opera en hora de Ecuador (supuesto S1). Sin esto, current_date/now()
-- usan la zona horaria por defecto de Supabase (UTC), que va 5 horas adelantada:
-- "sesiones_hoy", el estado "vencido" y las fechas por defecto (fecha_pago,
-- fecha_inscripcion, etc.) quedarían mal calculados durante la tarde/noche.
-- SET afecta esta sesión (para que el resto de este script ya corra correcto);
-- ALTER DATABASE persiste el cambio para todas las conexiones futuras de la app.
set timezone = 'America/Guayaquil';
alter database postgres set timezone to 'America/Guayaquil';

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
create type rol_usuario as enum ('administrador', 'gerente', 'profesor');
create type estado_estudiante as enum ('activo', 'inactivo', 'lesionado', 'retirado');
create type tipo_asignacion_profesor as enum ('principal', 'asistente', 'suplente');
create type dia_semana as enum ('lunes','martes','miercoles','jueves','viernes','sabado','domingo');
create type estado_horario as enum ('activo', 'suspendido');
create type estado_sesion as enum ('programada','realizada','cancelada','reprogramada','sin_registro','registro_completado');
create type estado_asistencia as enum ('presente','falta','tarde','justificado','permiso','lesionado');
create type tipo_justificacion as enum ('medica','familiar','academica','personal','otra');
create type estado_mensualidad as enum ('pendiente','parcial','pagado','vencido','exonerado','anulado');
create type tipo_ajuste as enum ('descuento','beca','exoneracion');
create type valor_tipo_ajuste as enum ('porcentaje','monto');
create type estado_ajuste as enum ('activo','anulado');
create type metodo_pago as enum ('efectivo','transferencia','deposito','tarjeta','otro');
create type estado_pago as enum ('activo','anulado');
create type resultado_importacion_fila as enum ('creado','actualizado','error','duplicado');

-- ----------------------------------------------------------------------------
-- CAMPUS
-- ----------------------------------------------------------------------------
create table campus (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RAMAS DEPORTIVAS
-- ----------------------------------------------------------------------------
create table ramas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                 -- Fútbol, Básquetbol, Vóleybol, Natación
  descripcion text,
  monto_mensual_base numeric(10,2) not null default 0,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- USUARIOS (vinculado 1:1 opcional con auth.users de Supabase)
-- ----------------------------------------------------------------------------
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,             -- referencia a auth.users(id) cuando exista Supabase Auth
  nombres text not null,
  apellidos text not null,
  email text not null unique,
  rol rol_usuario not null,
  activo boolean not null default true,
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PROFESORES
-- ----------------------------------------------------------------------------
create table profesores (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  nombres text not null,
  apellidos text not null,
  telefono text,
  email text,
  activo boolean not null default true,
  fecha_registro timestamptz not null default now()
);

create table profesor_rama (
  id uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references profesores(id),
  rama_id uuid not null references ramas(id),
  campus_id uuid not null references campus(id),
  tipo tipo_asignacion_profesor not null default 'principal',
  activo boolean not null default true,
  asignado_por uuid references usuarios(id),
  fecha_creacion timestamptz not null default now(),
  unique (profesor_id, rama_id, campus_id, tipo)
);

-- ----------------------------------------------------------------------------
-- ESTUDIANTES
-- ----------------------------------------------------------------------------
create table estudiantes (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date not null,
  campus_principal_id uuid not null references campus(id),
  estado estado_estudiante not null default 'activo',
  contacto_telefono text,
  contacto_email text,
  representante_nombre text not null,
  representante_telefono text not null,
  representante_email text,
  curso text,
  foto_url text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  observaciones_medicas text,           -- sensible: visibilidad restringida vía RLS/app
  fecha_registro timestamptz not null default now()
);

create table estudiante_rama (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id),
  rama_id uuid not null references ramas(id),
  campus_id uuid not null references campus(id),
  fecha_inscripcion date not null default current_date,
  estado estado_estudiante not null default 'activo',
  unique (estudiante_id, rama_id)
);

-- ----------------------------------------------------------------------------
-- HORARIOS Y SESIONES
-- ----------------------------------------------------------------------------
create table horarios (
  id uuid primary key default gen_random_uuid(),
  rama_id uuid not null references ramas(id),
  campus_id uuid not null references campus(id),
  dia dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null,
  profesor_id uuid not null references profesores(id),
  estado estado_horario not null default 'activo',
  fecha_creacion timestamptz not null default now(),
  check (hora_fin > hora_inicio),
  unique (rama_id, campus_id, dia, hora_inicio)
);

create table sesiones (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references horarios(id),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,
  estado estado_sesion not null default 'programada',
  observacion_general text,
  motivo_cancelacion text,
  usuario_cancelacion uuid references usuarios(id),
  fecha_cancelacion timestamptz,
  sesion_origen_id uuid references sesiones(id), -- si esta sesion es producto de una reprogramacion
  fecha_creacion timestamptz not null default now(),
  unique (horario_id, fecha)
);

-- ----------------------------------------------------------------------------
-- ASISTENCIA
-- ----------------------------------------------------------------------------
create table asistencias (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references sesiones(id),
  estudiante_id uuid not null references estudiantes(id),
  estado estado_asistencia not null,
  observacion_individual text,
  usuario_registro uuid not null references usuarios(id),
  fecha_registro timestamptz not null default now(),
  corregido boolean not null default false,
  usuario_correccion uuid references usuarios(id),
  fecha_correccion timestamptz,
  unique (sesion_id, estudiante_id)
);

-- ----------------------------------------------------------------------------
-- JUSTIFICACIONES
-- ----------------------------------------------------------------------------
create table justificaciones (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id),
  sesion_id uuid references sesiones(id),
  fecha date not null default current_date,
  rama_id uuid not null references ramas(id),
  tipo tipo_justificacion not null,
  motivo text not null,
  observacion text,
  adjunto_nombre text,
  adjunto_url text,
  usuario_id uuid not null references usuarios(id),
  fecha_creacion timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- MENSUALIDADES Y PAGOS
-- ----------------------------------------------------------------------------
create table mensualidades (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references estudiantes(id),
  rama_id uuid not null references ramas(id),
  periodo_mes int not null check (periodo_mes between 1 and 12),
  periodo_anio int not null check (periodo_anio between 2020 and 2100),
  monto_base numeric(10,2) not null,
  total_descuentos numeric(10,2) not null default 0,
  total_becas numeric(10,2) not null default 0,
  total_exoneraciones numeric(10,2) not null default 0,
  total_a_pagar numeric(10,2) not null default 0,
  total_pagado numeric(10,2) not null default 0,
  saldo numeric(10,2) not null default 0,
  estado estado_mensualidad not null default 'pendiente',
  fecha_limite date not null,
  observacion text,
  creado_por uuid not null references usuarios(id),
  fecha_creacion timestamptz not null default now(),
  unique (estudiante_id, rama_id, periodo_mes, periodo_anio)
);

create table ajustes_mensualidad (
  id uuid primary key default gen_random_uuid(),
  mensualidad_id uuid not null references mensualidades(id),
  tipo tipo_ajuste not null,
  valor_tipo valor_tipo_ajuste not null,
  valor numeric(10,2) not null check (valor >= 0),
  motivo text not null,
  usuario_id uuid not null references usuarios(id),
  fecha timestamptz not null default now(),
  estado estado_ajuste not null default 'activo'
);

create table pagos (
  id uuid primary key default gen_random_uuid(),
  mensualidad_id uuid not null references mensualidades(id),
  monto numeric(10,2) not null check (monto > 0),
  fecha_pago date not null default current_date,
  metodo_pago metodo_pago not null,
  referencia text,
  comprobante_nombre text,
  comprobante_url text,
  observacion text,
  estado estado_pago not null default 'activo',
  motivo_anulacion text,
  usuario_registro uuid not null references usuarios(id),
  fecha_registro timestamptz not null default now(),
  usuario_anulacion uuid references usuarios(id),
  fecha_anulacion timestamptz
);

-- ----------------------------------------------------------------------------
-- IMPORTACION DE ESTUDIANTES
-- ----------------------------------------------------------------------------
create table importaciones_estudiantes (
  id uuid primary key default gen_random_uuid(),
  nombre_archivo text not null,
  usuario_id uuid not null references usuarios(id),
  fecha timestamptz not null default now(),
  total_filas int not null default 0,
  total_creados int not null default 0,
  total_actualizados int not null default 0,
  total_errores int not null default 0,
  estado text not null default 'procesado'
);

create table importacion_detalle (
  id uuid primary key default gen_random_uuid(),
  importacion_id uuid not null references importaciones_estudiantes(id),
  fila_numero int not null,
  datos_originales jsonb not null,
  resultado resultado_importacion_fila not null,
  mensaje_error text
);

-- ----------------------------------------------------------------------------
-- AUDITORIA (polimórfica, genérica para todos los módulos)
-- ----------------------------------------------------------------------------
create table auditoria (
  id uuid primary key default gen_random_uuid(),
  tabla_afectada text not null,
  registro_id uuid not null,
  accion text not null,               -- crear, editar, anular, corregir, exonerar, etc.
  valor_anterior jsonb,
  valor_nuevo jsonb,
  usuario_id uuid references usuarios(id),
  fecha timestamptz not null default now()
);

create index idx_auditoria_tabla_registro on auditoria (tabla_afectada, registro_id);
create index idx_sesiones_fecha on sesiones (fecha);
create index idx_asistencias_sesion on asistencias (sesion_id);
create index idx_mensualidades_periodo on mensualidades (periodo_anio, periodo_mes);
create index idx_mensualidades_estudiante on mensualidades (estudiante_id);
create index idx_estudiante_rama_estudiante on estudiante_rama (estudiante_id);

-- ============================================================================
-- FUNCIONES Y TRIGGERS DE NEGOCIO
-- ============================================================================

-- Recalcula total_a_pagar, total_pagado, saldo y estado de una mensualidad.
-- Se invoca tras cualquier cambio en ajustes_mensualidad o pagos.
create or replace function fn_recalcular_mensualidad(p_mensualidad_id uuid)
returns void as $$
declare
  v_monto_base numeric(10,2);
  v_desc numeric(10,2) := 0;
  v_beca numeric(10,2) := 0;
  v_exo numeric(10,2) := 0;
  v_total_a_pagar numeric(10,2);
  v_total_pagado numeric(10,2) := 0;
  v_saldo numeric(10,2);
  v_estado estado_mensualidad;
  v_estado_actual estado_mensualidad;
  v_tiene_exoneracion_total boolean := false;
begin
  select monto_base, estado into v_monto_base, v_estado_actual
  from mensualidades where id = p_mensualidad_id for update;

  if v_estado_actual = 'anulado' then
    return; -- una mensualidad anulada no se recalcula
  end if;

  -- suma de ajustes activos por tipo
  select coalesce(sum(case when valor_tipo = 'monto' then valor
                           else round(v_monto_base * valor / 100.0, 2) end), 0)
    into v_desc
    from ajustes_mensualidad
    where mensualidad_id = p_mensualidad_id and tipo = 'descuento' and estado = 'activo';

  select coalesce(sum(case when valor_tipo = 'monto' then valor
                           else round(v_monto_base * valor / 100.0, 2) end), 0)
    into v_beca
    from ajustes_mensualidad
    where mensualidad_id = p_mensualidad_id and tipo = 'beca' and estado = 'activo';

  select coalesce(sum(case when valor_tipo = 'monto' then valor
                           else round(v_monto_base * valor / 100.0, 2) end), 0)
    into v_exo
    from ajustes_mensualidad
    where mensualidad_id = p_mensualidad_id and tipo = 'exoneracion' and estado = 'activo';

  select exists (
    select 1 from ajustes_mensualidad
    where mensualidad_id = p_mensualidad_id and tipo = 'exoneracion'
      and estado = 'activo' and valor_tipo = 'porcentaje' and valor >= 100
  ) into v_tiene_exoneracion_total;

  v_total_a_pagar := greatest(v_monto_base - v_desc - v_beca - v_exo, 0);

  select coalesce(sum(monto), 0) into v_total_pagado
    from pagos where mensualidad_id = p_mensualidad_id and estado = 'activo';

  if v_tiene_exoneracion_total or v_total_a_pagar = 0 then
    v_total_a_pagar := 0;
    v_saldo := 0;
    v_estado := 'exonerado';
  else
    v_saldo := greatest(v_total_a_pagar - v_total_pagado, 0);
    if v_saldo = 0 then
      v_estado := 'pagado';
    elsif v_total_pagado > 0 then
      v_estado := 'parcial';
    else
      v_estado := 'pendiente';
    end if;
  end if;

  update mensualidades
     set total_descuentos = v_desc,
         total_becas = v_beca,
         total_exoneraciones = v_exo,
         total_a_pagar = v_total_a_pagar,
         total_pagado = v_total_pagado,
         saldo = v_saldo,
         estado = v_estado
   where id = p_mensualidad_id;
end;
$$ language plpgsql;

-- Trigger: un abono no puede exceder el saldo pendiente (PAG-11).
-- En UPDATE se compara contra el saldo "restituyendo" el monto anterior del
-- propio pago, para no bloquear una edición que no cambia el monto.
create or replace function fn_validar_pago_no_excede_saldo()
returns trigger as $$
declare
  v_saldo numeric(10,2);
  v_saldo_disponible numeric(10,2);
begin
  if new.estado = 'activo' then
    select saldo into v_saldo from mensualidades where id = new.mensualidad_id;
    if TG_OP = 'INSERT' then
      if new.monto > v_saldo then
        raise exception 'El abono (%) excede el saldo pendiente (%)', new.monto, v_saldo;
      end if;
    elsif TG_OP = 'UPDATE' then
      v_saldo_disponible := v_saldo + coalesce(old.monto, 0);
      if new.monto > v_saldo_disponible then
        raise exception 'El abono editado (%) excede el saldo disponible (%)', new.monto, v_saldo_disponible;
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_validar_pago
before insert or update on pagos
for each row execute function fn_validar_pago_no_excede_saldo();

create or replace function fn_after_pago_change()
returns trigger as $$
begin
  perform fn_recalcular_mensualidad(coalesce(new.mensualidad_id, old.mensualidad_id));
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_pagos_recalcular
after insert or update or delete on pagos
for each row execute function fn_after_pago_change();

create or replace function fn_after_ajuste_change()
returns trigger as $$
begin
  perform fn_recalcular_mensualidad(coalesce(new.mensualidad_id, old.mensualidad_id));
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_ajustes_recalcular
after insert or update or delete on ajustes_mensualidad
for each row execute function fn_after_ajuste_change();

-- Red de seguridad: recalcula al crear la mensualidad, para que total_a_pagar/saldo
-- sean correctos por diseño de la base de datos y no dependan de que la aplicación
-- los calcule bien al insertar (defensa en profundidad).
create or replace function fn_after_mensualidad_insert()
returns trigger as $$
begin
  perform fn_recalcular_mensualidad(new.id);
  return new;
end;
$$ language plpgsql;

create trigger trg_mensualidad_recalcular_insert
after insert on mensualidades
for each row execute function fn_after_mensualidad_insert();

-- Auditoría automática para pagos (PAG-15/PAG-16/PAG-17)
create or replace function fn_audit_pagos()
returns trigger as $$
begin
  insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
  values (
    'pagos',
    coalesce(new.id, old.id),
    case TG_OP when 'INSERT' then 'crear' when 'UPDATE' then
      (case when new.estado = 'anulado' and old.estado <> 'anulado' then 'anular' else 'editar' end)
    else 'eliminar' end,
    to_jsonb(old), to_jsonb(new),
    coalesce(new.usuario_registro, old.usuario_registro)
  );
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_audit_pagos
after insert or update on pagos
for each row execute function fn_audit_pagos();

-- Auditoría automática para ajustes (descuentos/becas/exoneraciones)
create or replace function fn_audit_ajustes()
returns trigger as $$
begin
  insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
  values ('ajustes_mensualidad', coalesce(new.id, old.id),
          case TG_OP when 'INSERT' then 'crear' else 'editar' end,
          to_jsonb(old), to_jsonb(new), coalesce(new.usuario_id, old.usuario_id));
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_audit_ajustes
after insert or update on ajustes_mensualidad
for each row execute function fn_audit_ajustes();

-- Auditoría automática de asignaciones profesor-rama-campus (RAM-02)
create or replace function fn_audit_profesor_rama()
returns trigger as $$
begin
  insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
  values ('profesor_rama', coalesce(new.id, old.id),
          case TG_OP when 'INSERT' then 'crear' when 'DELETE' then 'eliminar' else 'editar' end,
          to_jsonb(old), to_jsonb(new), coalesce(new.asignado_por, old.asignado_por));
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger trg_audit_profesor_rama
after insert or update or delete on profesor_rama
for each row execute function fn_audit_profesor_rama();

-- El Gerente solo puede modificar monto_mensual_base de una rama, nunca
-- nombre/descripcion/activo (RLS no distingue columnas, así que se refuerza
-- aquí). El Administrador no tiene esta restricción.
create or replace function fn_restringir_gerente_ramas()
returns trigger as $$
begin
  if fn_rol_actual() = 'gerente' then
    if new.nombre is distinct from old.nombre
       or new.descripcion is distinct from old.descripcion
       or new.activo is distinct from old.activo then
      raise exception 'El Gerente solo puede modificar el costo de la mensualidad (monto_mensual_base).';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_restringir_gerente_ramas
before update on ramas
for each row execute function fn_restringir_gerente_ramas();

-- Auditoría automática de cambios de costo por mensualidad (PAG-03/AUD-01)
create or replace function fn_audit_ramas()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' and old.monto_mensual_base is distinct from new.monto_mensual_base then
    insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
    values (
      'ramas', new.id, 'editar_costo',
      jsonb_build_object('monto_mensual_base', old.monto_mensual_base),
      jsonb_build_object('monto_mensual_base', new.monto_mensual_base),
      (select id from usuarios where auth_user_id = auth.uid())
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_audit_ramas
after update on ramas
for each row execute function fn_audit_ramas();

-- Auditoría automática de alta/desactivación de profesores (PRO-01/03)
create or replace function fn_audit_profesores()
returns trigger as $$
begin
  insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
  values (
    'profesores', new.id,
    case
      when TG_OP = 'INSERT' then 'crear'
      when old.activo = true and new.activo = false then 'desactivar'
      when old.activo = false and new.activo = true then 'activar'
      else 'editar'
    end,
    to_jsonb(old), to_jsonb(new),
    (select id from usuarios where auth_user_id = auth.uid())
  );
  return new;
end;
$$ language plpgsql;

create trigger trg_audit_profesores
after insert or update on profesores
for each row execute function fn_audit_profesores();

-- Auditoría automática para correcciones de asistencia (ASI-07)
create or replace function fn_audit_asistencia()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' and old.estado is distinct from new.estado then
    insert into auditoria (tabla_afectada, registro_id, accion, valor_anterior, valor_nuevo, usuario_id)
    values ('asistencias', new.id, 'corregir', to_jsonb(old), to_jsonb(new), new.usuario_correccion);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_audit_asistencia
after update on asistencias
for each row execute function fn_audit_asistencia();

-- ============================================================================
-- VISTAS
-- ============================================================================

-- Mensualidades con estado "vencido" derivado en lectura (no persistido)
create or replace view v_mensualidades as
select m.*,
  case
    when m.estado in ('pagado','exonerado','anulado') then m.estado
    when m.saldo > 0 and m.fecha_limite < current_date then 'vencido'::estado_mensualidad
    else m.estado
  end as estado_efectivo
from mensualidades m;

-- Panel de KPIs (REP-01)
create or replace view v_kpis as
select
  (select count(*) from estudiantes where estado = 'activo') as estudiantes_activos,
  (select count(*) from profesores where activo = true) as profesores_activos,
  (select count(*) from sesiones where fecha = current_date) as sesiones_hoy,
  (select count(*) from sesiones where fecha = current_date and estado in ('sin_registro','programada')) as sesiones_sin_registro_hoy,
  (select coalesce(sum(saldo),0) from v_mensualidades where estado_efectivo in ('pendiente','parcial')) as pagos_pendientes_monto,
  (select coalesce(sum(saldo),0) from v_mensualidades where estado_efectivo = 'vencido') as pagos_vencidos_monto,
  (select coalesce(sum(total_pagado),0) from mensualidades
     where periodo_mes = extract(month from current_date) and periodo_anio = extract(year from current_date)) as recaudacion_mes_actual;

-- Cartera pendiente por estudiante (PAG-23)
create or replace view v_cartera_pendiente as
select e.id as estudiante_id, e.nombres, e.apellidos, r.nombre as rama, m.periodo_mes, m.periodo_anio,
       m.saldo, m.fecha_limite, m.estado_efectivo
from v_mensualidades m
join estudiantes e on e.id = m.estudiante_id
join ramas r on r.id = m.rama_id
where m.estado_efectivo in ('pendiente','parcial','vencido');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table campus enable row level security;
alter table ramas enable row level security;
alter table usuarios enable row level security;
alter table profesores enable row level security;
alter table profesor_rama enable row level security;
alter table estudiantes enable row level security;
alter table estudiante_rama enable row level security;
alter table horarios enable row level security;
alter table sesiones enable row level security;
alter table asistencias enable row level security;
alter table justificaciones enable row level security;
alter table mensualidades enable row level security;
alter table ajustes_mensualidad enable row level security;
alter table pagos enable row level security;
alter table auditoria enable row level security;

-- Helper: rol del usuario autenticado actual
create or replace function fn_rol_actual() returns rol_usuario as $$
  select rol from usuarios where auth_user_id = auth.uid();
$$ language sql stable;

-- p.activo = true es a propósito: un profesor desactivado (PRO-03) pierde de
-- inmediato todo permiso que dependa de esta función (asistencia, sesiones,
-- justificaciones, estudiantes de sus grupos) sin tener que tocar cada policy.
create or replace function fn_profesor_id_actual() returns uuid as $$
  select p.id from profesores p join usuarios u on u.id = p.usuario_id
  where u.auth_user_id = auth.uid() and p.activo = true;
$$ language sql stable;

-- Lectura general: todo usuario autenticado con fila en "usuarios" puede leer catálogos
create policy p_campus_select on campus for select using (fn_rol_actual() is not null);
create policy p_ramas_select on ramas for select using (fn_rol_actual() is not null);
create policy p_usuarios_select on usuarios for select using (fn_rol_actual() is not null);
create policy p_profesores_select on profesores for select using (fn_rol_actual() is not null);
create policy p_profesor_rama_select on profesor_rama for select using (fn_rol_actual() is not null);
create policy p_estudiante_rama_select on estudiante_rama for select using (fn_rol_actual() is not null);
create policy p_horarios_select on horarios for select using (fn_rol_actual() is not null);
create policy p_sesiones_select on sesiones for select using (fn_rol_actual() is not null);
create policy p_justificaciones_select on justificaciones for select using (fn_rol_actual() is not null);

-- Escritura de catálogos (campus/ramas): solo Administrador
create policy p_campus_write on campus for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');
create policy p_ramas_write on ramas for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');

-- Costo de mensualidad (monto_mensual_base): Administrador Y Gerente pueden
-- modificarlo, por decisión explícita del cliente. RLS solo puede restringir a
-- nivel de FILA, no de columna, así que el trigger fn_restringir_gerente_ramas
-- (más abajo) bloquea que el Gerente cambie nombre/descripcion/activo por esta
-- vía: solo puede tocar monto_mensual_base. El resto de gestión de ramas
-- (crear, renombrar, desactivar) sigue siendo exclusivo de Administrador.
create policy p_ramas_write_costo on ramas for update
  using (fn_rol_actual() = 'gerente') with check (fn_rol_actual() = 'gerente');

-- Usuarios/horarios: gestión (CRUD) solo Administrador (AUTH-03, HOR-*)
create policy p_usuarios_write on usuarios for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');
create policy p_horarios_write on horarios for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');

-- Profesores (PRO-01/03): Administrador Y Gerente pueden agregar y desactivar
-- profesores, por decisión explícita del cliente (amplía el "No" original de
-- PRO-* para este caso puntual). Nunca se borra físicamente (RN-14): "eliminar"
-- = poner activo=false, igual que estudiantes/pagos/asignaciones.
create policy p_profesores_write on profesores for all
  using (fn_rol_actual() in ('administrador', 'gerente')) with check (fn_rol_actual() in ('administrador', 'gerente'));

-- Asignación profesor-rama-campus (RAM-02): Administrador Y Gerente pueden asignar,
-- por decisión explícita del cliente (amplía el "No" original de la matriz de roles
-- para este caso puntual; el resto de gestión de ramas/horarios sigue solo-Admin).
create policy p_profesor_rama_write on profesor_rama for all
  using (fn_rol_actual() in ('administrador', 'gerente')) with check (fn_rol_actual() in ('administrador', 'gerente'));

-- Estudiantes: lectura completa (incluye datos sensibles como observaciones_medicas)
-- solo para Admin/Gerente y para el Profesor sobre estudiantes de SUS grupos
-- (mejora Parte A, punto 4: protección de datos de menores). Alta/edición: solo Administrador.
create policy p_estudiantes_select on estudiantes for select
  using (
    fn_rol_actual() in ('administrador', 'gerente')
    or (
      fn_rol_actual() = 'profesor' and exists (
        select 1 from estudiante_rama er join profesor_rama pr
          on pr.rama_id = er.rama_id and pr.campus_id = er.campus_id
        where er.estudiante_id = estudiantes.id
          and pr.profesor_id = fn_profesor_id_actual() and pr.activo
      )
    )
  );
create policy p_estudiantes_write on estudiantes for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');
create policy p_estudiante_rama_write on estudiante_rama for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');

-- Sesiones: Administrador gestiona todo (cancelar/reprogramar, HOR-*/SES-*);
-- el profesor puede actualizar el estado de sus propias sesiones como efecto
-- colateral de pasar asistencia (p.ej. marcarla "registro_completado").
create policy p_sesiones_admin on sesiones for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');
create policy p_sesiones_profesor_update on sesiones for update
  using (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from horarios h join profesor_rama pr
        on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where h.id = sesiones.horario_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  )
  with check (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from horarios h join profesor_rama pr
        on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where h.id = sesiones.horario_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  );

-- Justificaciones: Admin y Gerente sin restricción (sección 2: "Justificar faltas" = Sí para ambos);
-- Profesor solo para estudiantes de sus grupos (JUS-01/RN-12).
create policy p_justificaciones_admin on justificaciones for all
  using (fn_rol_actual() in ('administrador', 'gerente')) with check (fn_rol_actual() in ('administrador', 'gerente'));
create policy p_justificaciones_profesor on justificaciones for insert
  with check (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from estudiante_rama er join profesor_rama pr
        on pr.rama_id = er.rama_id and pr.campus_id = er.campus_id
      where er.estudiante_id = justificaciones.estudiante_id
        and er.rama_id = justificaciones.rama_id
        and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  );

-- Pagos: solo Admin y Gerente (RN-01, RN-02, RN-03)
create policy p_mensualidades_all on mensualidades for all
  using (fn_rol_actual() in ('administrador','gerente'))
  with check (fn_rol_actual() in ('administrador','gerente'));
create policy p_ajustes_all on ajustes_mensualidad for all
  using (fn_rol_actual() in ('administrador','gerente'))
  with check (fn_rol_actual() in ('administrador','gerente'));
create policy p_pagos_all on pagos for all
  using (fn_rol_actual() in ('administrador','gerente'))
  with check (fn_rol_actual() in ('administrador','gerente'));

-- Asistencia: Admin escribe todo; Profesor solo en sesiones de sus horarios asignados
create policy p_asistencias_admin on asistencias for all
  using (fn_rol_actual() = 'administrador') with check (fn_rol_actual() = 'administrador');
create policy p_asistencias_profesor on asistencias for all
  using (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from sesiones s join horarios h on h.id = s.horario_id
      join profesor_rama pr on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where s.id = asistencias.sesion_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  )
  with check (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from sesiones s join horarios h on h.id = s.horario_id
      join profesor_rama pr on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where s.id = asistencias.sesion_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  );
create policy p_asistencias_gerente_ro on asistencias for select
  using (fn_rol_actual() = 'gerente');

-- Auditoría: solo lectura para Administrador
create policy p_auditoria_admin on auditoria for select using (fn_rol_actual() = 'administrador');

-- ============================================================================
-- ALMACENAMIENTO DE ARCHIVOS (comprobantes de pago, adjuntos de justificación)
-- ============================================================================
-- Bucket privado (no accesible por URL pública directa): las descargas se
-- hacen con URLs firmadas de corta duración generadas por la aplicación.
insert into storage.buckets (id, name, public)
values ('documentos-rewa', 'documentos-rewa', false)
on conflict (id) do nothing;

-- Cualquier usuario autenticado con fila en "usuarios" puede subir un archivo
-- (la tabla que referencia ese archivo —pagos o justificaciones— ya tiene su
-- propia política de quién puede crear esa fila). La lectura queda restringida
-- a Admin/Gerente y a quien subió el archivo (el profesor viendo su propio
-- adjunto de justificación).
create policy p_storage_subir on storage.objects for insert
  with check (bucket_id = 'documentos-rewa' and fn_rol_actual() is not null);

create policy p_storage_leer on storage.objects for select
  using (
    bucket_id = 'documentos-rewa'
    and (fn_rol_actual() in ('administrador', 'gerente') or owner = auth.uid())
  );
