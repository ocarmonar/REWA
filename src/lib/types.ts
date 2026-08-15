// Tipos alineados con supabase/schema.sql

export type RolUsuario = "administrador" | "gerente" | "profesor";
export type EstadoEstudiante = "activo" | "inactivo" | "lesionado" | "retirado";
export type TipoAsignacionProfesor = "principal" | "asistente" | "suplente";
export type DiaSemana =
  | "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";
export type EstadoHorario = "activo" | "suspendido";
export type EstadoSesion =
  | "programada" | "realizada" | "cancelada" | "reprogramada" | "sin_registro" | "registro_completado";
export type EstadoAsistencia = "presente" | "falta" | "tarde" | "justificado" | "permiso" | "lesionado";
export type TipoJustificacion = "medica" | "familiar" | "academica" | "personal" | "otra";
export type EstadoMensualidad = "pendiente" | "parcial" | "pagado" | "vencido" | "exonerado" | "anulado";
export type TipoAjuste = "descuento" | "beca" | "exoneracion";
export type ValorTipoAjuste = "porcentaje" | "monto";
export type MetodoPago = "efectivo" | "transferencia" | "deposito" | "tarjeta" | "otro";

export interface Campus {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  fecha_creacion: string;
}

export interface Rama {
  id: string;
  nombre: string;
  descripcion: string | null;
  monto_mensual_base: number;
  activo: boolean;
  fecha_creacion: string;
}

export interface Usuario {
  id: string;
  auth_user_id: string | null;
  nombres: string;
  apellidos: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  fecha_creacion: string;
}

export interface Profesor {
  id: string;
  usuario_id: string | null;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  fecha_registro: string;
}

export interface ProfesorRama {
  id: string;
  profesor_id: string;
  rama_id: string;
  campus_id: string;
  tipo: TipoAsignacionProfesor;
  activo: boolean;
  asignado_por: string | null;
  fecha_creacion: string;
}

export interface Estudiante {
  id: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  campus_principal_id: string;
  estado: EstadoEstudiante;
  contacto_telefono: string | null;
  contacto_email: string | null;
  representante_nombre: string;
  representante_telefono: string;
  representante_email: string | null;
  curso: string | null;
  foto_url: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  observaciones_medicas: string | null;
  fecha_registro: string;
}

export interface EstudianteRama {
  id: string;
  estudiante_id: string;
  rama_id: string;
  campus_id: string;
  fecha_inscripcion: string;
  estado: EstadoEstudiante;
}

export interface Horario {
  id: string;
  rama_id: string;
  campus_id: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  profesor_id: string;
  estado: EstadoHorario;
}

export interface Sesion {
  id: string;
  horario_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoSesion;
  observacion_general: string | null;
  motivo_cancelacion: string | null;
  usuario_cancelacion: string | null;
  fecha_cancelacion: string | null;
  sesion_origen_id: string | null;
}

export interface Asistencia {
  id: string;
  sesion_id: string;
  estudiante_id: string;
  estado: EstadoAsistencia;
  observacion_individual: string | null;
  usuario_registro: string;
  fecha_registro: string;
  corregido: boolean;
}

export interface Justificacion {
  id: string;
  estudiante_id: string;
  sesion_id: string | null;
  fecha: string;
  rama_id: string;
  tipo: TipoJustificacion;
  motivo: string;
  observacion: string | null;
  adjunto_nombre: string | null;
  adjunto_url: string | null;
  usuario_id: string;
  fecha_creacion: string;
}

export interface Mensualidad {
  id: string;
  estudiante_id: string;
  rama_id: string;
  periodo_mes: number;
  periodo_anio: number;
  monto_base: number;
  total_descuentos: number;
  total_becas: number;
  total_exoneraciones: number;
  total_a_pagar: number;
  total_pagado: number;
  saldo: number;
  estado: EstadoMensualidad;
  estado_efectivo?: EstadoMensualidad; // proviene de v_mensualidades
  fecha_limite: string;
  observacion: string | null;
  creado_por: string;
  fecha_creacion: string;
}

export interface AjusteMensualidad {
  id: string;
  mensualidad_id: string;
  tipo: TipoAjuste;
  valor_tipo: ValorTipoAjuste;
  valor: number;
  motivo: string;
  usuario_id: string;
  fecha: string;
  estado: "activo" | "anulado";
}

export interface Pago {
  id: string;
  mensualidad_id: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: MetodoPago;
  referencia: string | null;
  comprobante_nombre: string | null;
  comprobante_url: string | null;
  observacion: string | null;
  estado: "activo" | "anulado";
  motivo_anulacion: string | null;
  usuario_registro: string;
  fecha_registro: string;
  usuario_anulacion: string | null;
  fecha_anulacion: string | null;
}

export interface Kpis {
  estudiantes_activos: number;
  profesores_activos: number;
  sesiones_hoy: number;
  sesiones_sin_registro_hoy: number;
  pagos_pendientes_monto: number;
  pagos_vencidos_monto: number;
  recaudacion_mes_actual: number;
}
