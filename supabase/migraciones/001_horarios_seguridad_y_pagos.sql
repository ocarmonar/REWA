-- ============================================================================
-- MIGRACIÓN 001 — Club Deportivo REWA
-- ============================================================================
-- Pegar completo en el SQL Editor de Supabase y ejecutar UNA vez.
-- Es idempotente: si se vuelve a ejecutar, no rompe nada ni duplica datos.
--
-- Qué corrige:
--   1. Generación de sesiones a partir de los horarios (antes solo existían
--      las sesiones de demostración creadas por seed.sql).
--   2. Las vistas se saltaban RLS y exponían la cartera de deudas.
--   3. Un profesor podía cancelar sus propias sesiones por API.
--   4. Alta de estudiantes atómica (estudiante + inscripción en una rama).
--   5. Ajustes en porcentaje sin tope de 100%.
--   6. "Recaudación del mes" no era lo cobrado en el mes.
--   7. El excedente de un sobrepago desaparecía sin dejar rastro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GENERACIÓN DE SESIONES DESDE LOS HORARIOS
-- ----------------------------------------------------------------------------
-- Crea las sesiones de cada horario activo en el rango de fechas indicado.
-- SECURITY INVOKER (por defecto): las políticas RLS de "sesiones" siguen
-- aplicando, así que esta función no es una puerta trasera. El chequeo de rol
-- solo sirve para dar un mensaje claro en vez de un error críptico de Postgres.
-- Los roles de base de datos permitidos cubren la llamada automática del cron
-- diario (service_role) y la ejecución manual desde el SQL Editor (postgres),
-- que no tienen una sesión de usuario de la app detrás.
create or replace function fn_generar_sesiones(p_desde date, p_hasta date)
returns integer
language plpgsql
as $$
declare
  v_creadas integer := 0;
begin
  if p_hasta < p_desde then
    raise exception 'La fecha final no puede ser anterior a la inicial.';
  end if;
  if p_hasta - p_desde > 400 then
    raise exception 'El rango no puede superar 400 días.';
  end if;
  if fn_rol_actual() is distinct from 'administrador'
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'Solo el administrador puede generar sesiones.';
  end if;

  with dias as (
    select d::date as fecha
    from generate_series(p_desde, p_hasta, interval '1 day') as d
  ),
  nuevas as (
    insert into sesiones (horario_id, fecha, hora_inicio, hora_fin, estado)
    select h.id, dias.fecha, h.hora_inicio, h.hora_fin, 'programada'::estado_sesion
    from horarios h
    join dias
      -- extract(dow) devuelve 0=domingo .. 6=sábado; el array traduce ese
      -- número al enum dia_semana sin depender del idioma del servidor.
      on h.dia = (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado']::dia_semana[])
                 [extract(dow from dias.fecha)::int + 1]
    where h.estado = 'activo'
    on conflict (horario_id, fecha) do nothing
    returning 1
  )
  select count(*) into v_creadas from nuevas;

  return v_creadas;
end;
$$;

-- Mantenimiento diario (lo llama el cron de Vercel): asegura que siempre haya
-- sesiones creadas para los próximos p_dias_adelante días y marca como
-- "sin_registro" las sesiones pasadas a las que nunca se les pasó lista.
create or replace function fn_mantenimiento_sesiones(p_dias_adelante integer default 30)
returns integer
language plpgsql
as $$
declare
  v_creadas integer;
begin
  v_creadas := fn_generar_sesiones(current_date, current_date + p_dias_adelante);

  update sesiones
     set estado = 'sin_registro'
   where fecha < current_date
     and estado = 'programada';

  return v_creadas;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. ALTA DE ESTUDIANTES ATÓMICA (estudiante + inscripción en su rama)
-- ----------------------------------------------------------------------------
-- Antes se insertaba el estudiante y luego, en otra llamada, su inscripción:
-- si la segunda fallaba quedaba un estudiante sin rama (invisible para
-- asistencia y para las mensualidades) y el usuario, al reintentar, lo
-- duplicaba. Dentro de una función todo ocurre en una sola transacción.
-- La importación masiva usa esta misma función, por eso recibe un arreglo.
create or replace function fn_guardar_estudiantes(p_filas jsonb)
returns integer
language plpgsql
as $$
declare
  v_fila jsonb;
  v_id uuid;
  v_rama uuid;
  v_creados integer := 0;
begin
  if fn_rol_actual() is distinct from 'administrador' then
    raise exception 'Solo el administrador puede registrar estudiantes.';
  end if;

  for v_fila in select value from jsonb_array_elements(p_filas) loop
    insert into estudiantes (
      nombres, apellidos, fecha_nacimiento, campus_principal_id,
      contacto_telefono, contacto_email,
      representante_nombre, representante_telefono, representante_email,
      curso, contacto_emergencia_nombre, contacto_emergencia_telefono,
      observaciones_medicas
    ) values (
      v_fila->>'nombres',
      v_fila->>'apellidos',
      (v_fila->>'fecha_nacimiento')::date,
      (v_fila->>'campus_principal_id')::uuid,
      nullif(v_fila->>'contacto_telefono', ''),
      nullif(v_fila->>'contacto_email', ''),
      v_fila->>'representante_nombre',
      v_fila->>'representante_telefono',
      nullif(v_fila->>'representante_email', ''),
      nullif(v_fila->>'curso', ''),
      nullif(v_fila->>'contacto_emergencia_nombre', ''),
      nullif(v_fila->>'contacto_emergencia_telefono', ''),
      nullif(v_fila->>'observaciones_medicas', '')
    )
    returning id into v_id;

    v_rama := nullif(v_fila->>'rama_id', '')::uuid;
    if v_rama is not null then
      insert into estudiante_rama (estudiante_id, rama_id, campus_id)
      values (v_id, v_rama, (v_fila->>'campus_principal_id')::uuid)
      on conflict (estudiante_id, rama_id) do nothing;
    end if;

    v_creados := v_creados + 1;
  end loop;

  return v_creados;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. SALDO A FAVOR (sobrepagos que antes desaparecían)
-- ----------------------------------------------------------------------------
-- Si se registra un pago y después se agrega un descuento/beca, el total a
-- pagar baja por debajo de lo ya pagado. El saldo se recortaba a 0 y ese
-- excedente se perdía de vista. Ahora queda registrado y la app lo muestra.
alter table mensualidades
  add column if not exists saldo_a_favor numeric(10,2) not null default 0;

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
  v_saldo_a_favor numeric(10,2);
  v_estado estado_mensualidad;
  v_estado_actual estado_mensualidad;
  v_tiene_exoneracion_total boolean := false;
begin
  select monto_base, estado into v_monto_base, v_estado_actual
  from mensualidades where id = p_mensualidad_id for update;

  if v_estado_actual = 'anulado' then
    return; -- una mensualidad anulada no se recalcula
  end if;

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

  -- Lo pagado de más queda visible en vez de desaparecer al recortar el saldo.
  v_saldo_a_favor := greatest(v_total_pagado - v_total_a_pagar, 0);

  update mensualidades
     set total_descuentos = v_desc,
         total_becas = v_beca,
         total_exoneraciones = v_exo,
         total_a_pagar = v_total_a_pagar,
         total_pagado = v_total_pagado,
         saldo = v_saldo,
         saldo_a_favor = v_saldo_a_favor,
         estado = v_estado
   where id = p_mensualidad_id;
end;
$$ language plpgsql;

-- Recalcula lo ya existente para que saldo_a_favor quede correcto de entrada.
do $$
declare r record;
begin
  for r in select id from mensualidades where estado <> 'anulado' loop
    perform fn_recalcular_mensualidad(r.id);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. UN AJUSTE EN PORCENTAJE NO PUEDE PASAR DE 100%
-- ----------------------------------------------------------------------------
alter table ajustes_mensualidad drop constraint if exists ck_ajuste_porcentaje_max;
alter table ajustes_mensualidad add constraint ck_ajuste_porcentaje_max
  check (valor_tipo <> 'porcentaje' or valor <= 100);

-- ----------------------------------------------------------------------------
-- 5. VISTAS: "recaudación del mes" real + dejar de saltarse RLS
-- ----------------------------------------------------------------------------
-- Se recrean las tres (hay dependencias entre ellas y v_mensualidades cambió
-- de columnas al agregarse saldo_a_favor).
drop view if exists v_kpis;
drop view if exists v_cartera_pendiente;
drop view if exists v_mensualidades;

create view v_mensualidades as
select m.*,
  case
    when m.estado in ('pagado','exonerado','anulado') then m.estado
    when m.saldo > 0 and m.fecha_limite < current_date then 'vencido'::estado_mensualidad
    else m.estado
  end as estado_efectivo
from mensualidades m;

create view v_cartera_pendiente as
select e.id as estudiante_id, e.nombres, e.apellidos, r.nombre as rama, m.periodo_mes, m.periodo_anio,
       m.saldo, m.fecha_limite, m.estado_efectivo
from v_mensualidades m
join estudiantes e on e.id = m.estudiante_id
join ramas r on r.id = m.rama_id
where m.estado_efectivo in ('pendiente','parcial','vencido');

create view v_kpis as
select
  (select count(*) from estudiantes where estado = 'activo') as estudiantes_activos,
  (select count(*) from profesores where activo = true) as profesores_activos,
  (select count(*) from sesiones where fecha = current_date) as sesiones_hoy,
  (select count(*) from sesiones where fecha = current_date and estado in ('sin_registro','programada')) as sesiones_sin_registro_hoy,
  (select coalesce(sum(saldo),0) from v_mensualidades where estado_efectivo in ('pendiente','parcial')) as pagos_pendientes_monto,
  (select coalesce(sum(saldo),0) from v_mensualidades where estado_efectivo = 'vencido') as pagos_vencidos_monto,
  -- Dinero efectivamente cobrado DENTRO del mes calendario en curso. Antes
  -- sumaba lo pagado sobre las mensualidades del periodo actual sin importar
  -- cuándo entró el dinero: un pago de agosto hecho en septiembre no aparecía
  -- en septiembre, y un pago adelantado sí contaba en un mes que aún no había
  -- ocurrido. Para tesorería, eso es un número engañoso.
  (select coalesce(sum(p.monto),0) from pagos p
    where p.estado = 'activo'
      and p.fecha_pago >= date_trunc('month', current_date)::date
      and p.fecha_pago < (date_trunc('month', current_date) + interval '1 month')::date
  ) as recaudacion_mes_actual;

-- Las vistas, por defecto, se ejecutan con los permisos de su DUEÑO, así que
-- IGNORABAN las políticas RLS de mensualidades/pagos: cualquiera con la llave
-- pública (anon, que viaja en el navegador) podía leer la cartera completa de
-- deudas del club. security_invoker las hace correr con los permisos de quien
-- consulta, y el revoke quita el acceso a las llaves anónimas.
alter view v_mensualidades set (security_invoker = on);
alter view v_cartera_pendiente set (security_invoker = on);
alter view v_kpis set (security_invoker = on);

revoke all on v_mensualidades from anon;
revoke all on v_cartera_pendiente from anon;
revoke all on v_kpis from anon;

-- Se recrearon las vistas, así que se reafirma el acceso de los usuarios con
-- sesión iniciada (lo que ven sigue filtrado por RLS gracias a security_invoker).
grant select on v_mensualidades to authenticated;
grant select on v_cartera_pendiente to authenticated;
grant select on v_kpis to authenticated;

-- ----------------------------------------------------------------------------
-- 6. EL PROFESOR NO PUEDE CANCELAR SESIONES
-- ----------------------------------------------------------------------------
-- La política le permitía actualizar sus sesiones para marcar "registro
-- completado" al pasar lista, pero no limitaba qué columnas tocaba: por API
-- podía dejarlas en 'cancelada'. Cancelar/reprogramar es del administrador.
drop policy if exists p_sesiones_profesor_update on sesiones;
create policy p_sesiones_profesor_update on sesiones for update
  using (
    fn_rol_actual() = 'profesor' and exists (
      select 1 from horarios h join profesor_rama pr
        on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where h.id = sesiones.horario_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  )
  with check (
    fn_rol_actual() = 'profesor'
    and estado in ('programada','realizada','registro_completado','sin_registro')
    and exists (
      select 1 from horarios h join profesor_rama pr
        on pr.rama_id = h.rama_id and pr.campus_id = h.campus_id
      where h.id = sesiones.horario_id and pr.profesor_id = fn_profesor_id_actual() and pr.activo
    )
  );

-- ----------------------------------------------------------------------------
-- 7. PRIMERA CARGA DE SESIONES
-- ----------------------------------------------------------------------------
-- Deja creadas las sesiones de los próximos 30 días para los horarios que ya
-- existan. Si todavía no hay horarios cargados, devuelve 0 y no pasa nada:
-- se generan solas desde la pantalla de Horarios o con el cron diario.
select fn_mantenimiento_sesiones(30) as sesiones_creadas;
