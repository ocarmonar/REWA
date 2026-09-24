-- ============================================================================
-- MIGRACIÓN 002 — Club Deportivo REWA
-- ============================================================================
-- Pegar completo en el SQL Editor de Supabase y ejecutar UNA vez.
-- Es idempotente: ejecutarlo de nuevo no cambia nada.
--
-- Qué corrige (error grave): las funciones de auditoría corrían con los
-- permisos de quien hace el cambio, y la tabla "auditoria" tiene RLS activo
-- con una sola política, de LECTURA. Así, cada cambio auditado hecho desde la
-- app fallaba al intentar escribir su registro de auditoría, y Postgres
-- deshacía el cambio completo: registrar un pago, aplicar un ajuste, editar el
-- costo de una rama, crear/asignar/desactivar profesores o corregir una
-- asistencia devolvían "new row violates row-level security policy".
--
-- SECURITY DEFINER hace que estas funciones escriban en "auditoria" con los
-- permisos de su dueño. Es más seguro que abrir la tabla con una política de
-- INSERT: una función de trigger no se puede llamar directamente, así que
-- nadie puede usarla para inventar registros de auditoría. auth.uid() sigue
-- identificando a quien hizo el cambio. set search_path fija el esquema (buena
-- práctica obligatoria con SECURITY DEFINER).
-- ============================================================================

alter function fn_audit_pagos() security definer set search_path = public;
alter function fn_audit_ajustes() security definer set search_path = public;
alter function fn_audit_profesor_rama() security definer set search_path = public;
alter function fn_audit_ramas() security definer set search_path = public;
alter function fn_audit_profesores() security definer set search_path = public;
alter function fn_audit_asistencia() security definer set search_path = public;

-- Comprobación: las seis filas deben decir "true".
select proname as funcion, prosecdef as security_definer
from pg_proc
where proname in ('fn_audit_pagos','fn_audit_ajustes','fn_audit_profesor_rama',
                  'fn_audit_ramas','fn_audit_profesores','fn_audit_asistencia')
order by proname;
