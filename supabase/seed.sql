-- ============================================================================
-- CLUB DEPORTIVO REWA - DATOS SEMILLA
-- 3 campus, 4 ramas, 15 profesores, 60 estudiantes, horarios, sesiones,
-- asistencias y pagos de ejemplo. Ejecutar después de schema.sql.
-- ============================================================================

-- Asegura zona horaria de Ecuador para esta sesión (schema.sql ya lo deja
-- persistente para conexiones futuras, pero por si esta sesión no lo heredó).
set timezone = 'America/Guayaquil';

-- ----------------------------------------------------------------------------
-- 1. CAMPUS
-- ----------------------------------------------------------------------------
insert into campus (id, nombre, direccion) values
  ('11111111-0000-0000-0000-000000000001', 'ISM North', 'Av. Eloy Alfaro N39-115, Quito'),
  ('11111111-0000-0000-0000-000000000002', 'ISM West',  'Av. Occidental y Mariana de Jesús, Quito'),
  ('11111111-0000-0000-0000-000000000003', 'ISM Quito', 'Av. 6 de Diciembre N24-296, Quito');

-- ----------------------------------------------------------------------------
-- 2. RAMAS
-- ----------------------------------------------------------------------------
insert into ramas (id, nombre, descripcion, monto_mensual_base) values
  ('22222222-0000-0000-0000-000000000001', 'Fútbol',      'Escuela formativa de fútbol',      35.00),
  ('22222222-0000-0000-0000-000000000002', 'Básquetbol',  'Escuela formativa de básquetbol',  32.00),
  ('22222222-0000-0000-0000-000000000003', 'Vóleybol',    'Escuela formativa de vóleybol',    30.00),
  ('22222222-0000-0000-0000-000000000004', 'Natación',    'Escuela formativa de natación',    45.00);

-- ----------------------------------------------------------------------------
-- 3. USUARIOS: 3 administradores, 1 gerente, 15 profesores
-- ----------------------------------------------------------------------------
insert into usuarios (id, nombres, apellidos, email, rol) values
  ('33333333-0000-0000-0000-000000000001', 'Andrea', 'Salazar Ponce',   'admin1@rewa.ec',  'administrador'),
  ('33333333-0000-0000-0000-000000000002', 'Diego',  'Vaca Montalvo',   'admin2@rewa.ec',  'administrador'),
  ('33333333-0000-0000-0000-000000000003', 'Mónica', 'Chávez Rivas',    'admin3@rewa.ec',  'administrador'),
  ('33333333-0000-0000-0000-000000000004', 'Fernando','Torres Guerrero','gerente@rewa.ec', 'gerente');

do $$
declare
  v_nombres text[] := array['Carlos','Luis','Andrés','Pablo','Jorge','Iván','Ramiro','Santiago','Marco','Xavier','Patricio','Fabián','Rodrigo','Esteban','Gabriel','María','Paola','Verónica','Cristina','Lorena'];
  v_apellidos text[] := array['Guamán','Cevallos','Andrade','Moreta','Villacís','Cadena','Zambrano','Naranjo','Freire','Espinoza','Coronel','Yépez','Barragán','Muñoz','Pazmiño'];
  v_id uuid;
  v_usuario_id uuid;
  i int;
begin
  for i in 1..15 loop
    v_usuario_id := gen_random_uuid();
    insert into usuarios (id, nombres, apellidos, email, rol)
    values (v_usuario_id, v_nombres[i], v_apellidos[i], 'profe' || i || '@rewa.ec', 'profesor');

    v_id := ('44444444-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    insert into profesores (id, usuario_id, nombres, apellidos, telefono, email)
    values (v_id, v_usuario_id, v_nombres[i], v_apellidos[i],
            '09' || (80000000 + i * 111)::text, 'profe' || i || '@rewa.ec');
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. ASIGNACIÓN PROFESOR-RAMA-CAMPUS (principal/asistente/suplente)
--    15 profesores repartidos entre 4 ramas x 3 campus = 12 combinaciones.
-- ----------------------------------------------------------------------------
do $$
declare
  v_profesores uuid[];
  v_ramas uuid[] := array[
    '22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004'];
  v_campus uuid[] := array[
    '11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000003'];
  v_idx int := 1;
  r int; c int;
begin
  select array_agg(id order by id) into v_profesores from profesores;

  for r in 1..4 loop
    for c in 1..3 loop
      insert into profesor_rama (profesor_id, rama_id, campus_id, tipo)
      values (v_profesores[((v_idx - 1) % 15) + 1], v_ramas[r], v_campus[c], 'principal')
      on conflict (profesor_id, rama_id, campus_id, tipo) do nothing;
      v_idx := v_idx + 1;
      -- cada 3ra combinación añade un asistente adicional
      if c = 1 then
        insert into profesor_rama (profesor_id, rama_id, campus_id, tipo)
        values (v_profesores[((v_idx - 1) % 15) + 1], v_ramas[r], v_campus[c], 'asistente')
        on conflict (profesor_id, rama_id, campus_id, tipo) do nothing;
        v_idx := v_idx + 1;
      end if;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. HORARIOS (fijos por rama/campus)
-- ----------------------------------------------------------------------------
do $$
declare
  v_rama record;
  v_campus record;
  v_profesor_id uuid;
  v_dias dia_semana[] := array['lunes','miercoles','viernes']::dia_semana[];
  v_dia dia_semana;
  v_hora_inicio time;
begin
  for v_rama in select id, nombre from ramas order by id loop
    for v_campus in select id from campus order by id loop
      select profesor_id into v_profesor_id
        from profesor_rama
        where rama_id = v_rama.id and campus_id = v_campus.id and tipo = 'principal'
        limit 1;

      v_hora_inicio := case v_rama.nombre
        when 'Fútbol' then time '15:00'
        when 'Básquetbol' then time '16:30'
        when 'Vóleybol' then time '15:00'
        when 'Natación' then time '07:00'
      end;

      foreach v_dia in array v_dias loop
        insert into horarios (rama_id, campus_id, dia, hora_inicio, hora_fin, profesor_id)
        values (v_rama.id, v_campus.id, v_dia, v_hora_inicio, v_hora_inicio + interval '90 minutes', v_profesor_id)
        on conflict (rama_id, campus_id, dia, hora_inicio) do nothing;
      end loop;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. ESTUDIANTES (60)
-- ----------------------------------------------------------------------------
do $$
declare
  v_nombres text[] := array['Mateo','Sebastián','Emilia','Valentina','Josué','Doménica','Isaac','Camila','Martín','Renata','Julián','Sofía','Nicolás','Antonella','Samuel','Ariana','Emilio','Zoe','Adrián','Mía','David','Salomé','Thiago','Abigail','Joaquín','Victoria','Benjamín','Amelia','Gael','Regina'];
  v_apellidos text[] := array['Rosero','Tapia','Játiva','Benítez','Quishpe','Lema','Sangucho','Vega','Aguirre','Peñafiel','Carrera','Salinas','Bautista','Ortiz','Salazar','Endara','Bravo','Cárdenas','Herrera','Toapanta'];
  v_campus uuid[] := array[
    '11111111-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000003'];
  v_ramas uuid[] := array[
    '22222222-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000002',
    '22222222-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000004'];
  v_estados estado_estudiante[] := array['activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','activo','inactivo','lesionado']::estado_estudiante[];
  v_estudiante_id uuid;
  v_campus_id uuid;
  i int;
  n_ramas int;
  j int;
  v_admin_id uuid := '33333333-0000-0000-0000-000000000001';
begin
  for i in 1..60 loop
    v_campus_id := v_campus[((i - 1) % 3) + 1];
    v_estudiante_id := gen_random_uuid();

    insert into estudiantes (
      id, nombres, apellidos, fecha_nacimiento, campus_principal_id, estado,
      contacto_telefono, contacto_email, representante_nombre, representante_telefono,
      representante_email, curso
    ) values (
      v_estudiante_id,
      v_nombres[((i - 1) % 30) + 1],
      v_apellidos[((i - 1) % 20) + 1] || ' ' || v_apellidos[((i + 3) % 20) + 1],
      (date '2010-01-01' + ((i * 47) % 3650) * interval '1 day')::date,
      v_campus_id,
      v_estados[((i - 1) % 20) + 1],
      '09' || (70000000 + i * 137)::text,
      lower(v_nombres[((i - 1) % 30) + 1]) || '.' || i || '@estudiante.rewa.ec',
      'Representante de ' || v_nombres[((i - 1) % 30) + 1],
      '09' || (60000000 + i * 91)::text,
      'representante' || i || '@correo.com',
      case when i % 4 = 0 then (8 + (i % 5))::text || 'vo EGB' else null end
    );

    -- cada estudiante se inscribe en 1 o 2 ramas
    n_ramas := 1 + (i % 2);
    for j in 1..n_ramas loop
      insert into estudiante_rama (estudiante_id, rama_id, campus_id, fecha_inscripcion)
      values (v_estudiante_id, v_ramas[((i + j - 1) % 4) + 1], v_campus_id,
              current_date - ((i * 3) % 180))
      on conflict (estudiante_id, rama_id) do nothing;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. SESIONES: últimas 3 semanas + próxima semana, según horarios
-- ----------------------------------------------------------------------------
do $$
declare
  v_horario record;
  v_fecha date;
  v_dia_horario int;
  v_dias_map text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
begin
  for v_horario in select * from horarios loop
    v_dia_horario := array_position(v_dias_map, v_horario.dia::text) - 1; -- 0=domingo

    for v_fecha in
      select generate_series(current_date - interval '21 days', current_date + interval '7 days', interval '1 day')::date
    loop
      if extract(dow from v_fecha) = v_dia_horario then
        insert into sesiones (horario_id, fecha, hora_inicio, hora_fin, estado)
        values (
          v_horario.id, v_fecha, v_horario.hora_inicio, v_horario.hora_fin,
          case when v_fecha < current_date then 'realizada'
               when v_fecha = current_date then 'programada'
               else 'programada' end
        )
        on conflict (horario_id, fecha) do nothing;
      end if;
    end loop;
  end loop;

  -- un par de sesiones canceladas de ejemplo
  update sesiones set estado = 'cancelada', motivo_cancelacion = 'Lluvia intensa - cancha inundada',
    usuario_cancelacion = '33333333-0000-0000-0000-000000000001', fecha_cancelacion = fecha - interval '1 day'
  where id in (select id from sesiones where fecha < current_date order by fecha desc limit 2);
end $$;

-- ----------------------------------------------------------------------------
-- 8. ASISTENCIAS de ejemplo para sesiones realizadas
-- ----------------------------------------------------------------------------
do $$
declare
  v_sesion record;
  v_estudiante record;
  v_estados estado_asistencia[] := array['presente','presente','presente','presente','presente','presente','presente','falta','tarde','justificado']::estado_asistencia[];
  v_profesor_usuario uuid;
  k int := 0;
begin
  for v_sesion in
    select s.id as sesion_id, h.rama_id, h.campus_id, h.profesor_id
    from sesiones s join horarios h on h.id = s.horario_id
    where s.estado = 'realizada'
  loop
    select usuario_id into v_profesor_usuario from profesores where id = v_sesion.profesor_id;

    for v_estudiante in
      select er.estudiante_id
      from estudiante_rama er
      where er.rama_id = v_sesion.rama_id and er.campus_id = v_sesion.campus_id and er.estado = 'activo'
    loop
      k := k + 1;
      insert into asistencias (sesion_id, estudiante_id, estado, usuario_registro)
      values (v_sesion.sesion_id, v_estudiante.estudiante_id, v_estados[(k % 10) + 1],
              coalesce(v_profesor_usuario, '33333333-0000-0000-0000-000000000001'))
      on conflict (sesion_id, estudiante_id) do nothing;
    end loop;

    update sesiones set estado = 'registro_completado' where id = v_sesion.sesion_id;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 9. MENSUALIDADES + PAGOS de ejemplo (periodo actual y anterior)
-- ----------------------------------------------------------------------------
do $$
declare
  v_er record;
  v_monto_base numeric(10,2);
  v_mensualidad_id uuid;
  v_es_nueva boolean;
  v_periodo record;
  v_admin_id uuid := '33333333-0000-0000-0000-000000000001';
  v_gerente_id uuid := '33333333-0000-0000-0000-000000000004';
  k int := 0;
begin
  for v_periodo in
    select extract(month from current_date)::int as mes, extract(year from current_date)::int as anio
    union all
    select extract(month from current_date - interval '1 month')::int, extract(year from current_date - interval '1 month')::int
  loop
    for v_er in
      select er.estudiante_id, er.rama_id, r.monto_mensual_base
      from estudiante_rama er
      join ramas r on r.id = er.rama_id
      join estudiantes e on e.id = er.estudiante_id
      where er.estado = 'activo' and e.estado = 'activo'
    loop
      k := k + 1;

      -- DO UPDATE (no-op real) en vez de DO NOTHING: así "returning" siempre
      -- entrega el id de la fila real (existente o nueva). Con DO NOTHING, si
      -- el script se ejecuta dos veces, v_mensualidad_id quedaría con un uuid
      -- que no existe en la tabla y los inserts de ajustes/pagos de abajo
      -- fallarían por violación de llave foránea, abortando todo el script.
      insert into mensualidades (
        id, estudiante_id, rama_id, periodo_mes, periodo_anio, monto_base,
        total_a_pagar, saldo, fecha_limite, creado_por
      ) values (
        gen_random_uuid(), v_er.estudiante_id, v_er.rama_id, v_periodo.mes, v_periodo.anio,
        v_er.monto_mensual_base, v_er.monto_mensual_base, v_er.monto_mensual_base,
        make_date(v_periodo.anio, v_periodo.mes, 5), v_admin_id
      )
      on conflict (estudiante_id, rama_id, periodo_mes, periodo_anio)
      do update set monto_base = mensualidades.monto_base
      returning id, (xmax = 0) into v_mensualidad_id, v_es_nueva;

      -- ajustes/pagos de ejemplo solo si la mensualidad es nueva: evita duplicarlos
      -- (o exceder el saldo y disparar la validación PAG-11) si el script se re-ejecuta.
      if v_es_nueva then
        -- variar el resultado: pagado completo / parcial / pendiente / con ajuste
        if k % 5 = 0 then
          insert into ajustes_mensualidad (mensualidad_id, tipo, valor_tipo, valor, motivo, usuario_id)
          values (v_mensualidad_id, 'beca', 'porcentaje', 20, 'Beca deportiva por desempeño', v_gerente_id);
        elsif k % 7 = 0 then
          insert into ajustes_mensualidad (mensualidad_id, tipo, valor_tipo, valor, motivo, usuario_id)
          values (v_mensualidad_id, 'descuento', 'monto', 5, 'Descuento por hermano inscrito', v_gerente_id);
        elsif k % 11 = 0 then
          insert into ajustes_mensualidad (mensualidad_id, tipo, valor_tipo, valor, motivo, usuario_id)
          values (v_mensualidad_id, 'exoneracion', 'porcentaje', 100, 'Exoneración total - caso socioeconómico', v_admin_id);
        end if;

        if k % 3 = 0 and k % 11 <> 0 then
          insert into pagos (mensualidad_id, monto, fecha_pago, metodo_pago, referencia, usuario_registro)
          select v_mensualidad_id, saldo, current_date - (k % 15), 'efectivo', 'REC-' || k, v_gerente_id
          from mensualidades where id = v_mensualidad_id and saldo > 0;
        elsif k % 4 = 0 and k % 11 <> 0 then
          insert into pagos (mensualidad_id, monto, fecha_pago, metodo_pago, referencia, usuario_registro)
          select v_mensualidad_id, round(saldo / 2, 2), current_date - (k % 10), 'transferencia', 'TRX-' || k, v_gerente_id
          from mensualidades where id = v_mensualidad_id and saldo > 0;
        end if;
      end if;
    end loop;
  end loop;
end $$;
