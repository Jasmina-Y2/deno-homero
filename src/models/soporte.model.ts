export interface MensajeTicket {
  id: string;
  remitente: "usuario" | "soporte" | "admin" | string;
  autorId?: string;
  autorNombre: string;
  texto: string;
  fecha: string;
  comprobanteUrl?: string;
  imagenUrl?: string;
  adjuntoUrl?: string;
  [key: string]: any;
}

export interface MetadataSoporte {
  mensajes?: MensajeTicket[];
  ultimoMensaje?: string;
  ultimoRemitente?: "usuario" | "soporte" | "admin" | string;
  ultimaFecha?: string;
  comprobanteUrl?: string;
  montoRetiro?: number | string;
  monedasRetiro?: number | string;
  metodoPago?: string;
  datosPago?: string;
  [key: string]: any;
}

export interface ReporteSoporte {
  id?: string;
  idDoc?: string;
  uid?: string;
  nombreUsuario?: string;
  email?: string;
  categoria: string;
  asunto: string;
  descripcion: string;
  userAgent?: string;
  plataforma?: string;
  fecha?: string;
  estado?: "pendiente" | "en_revision" | "resuelto" | "rechazado" | "respondido" | "cerrado" | string;
  respuesta?: string;
  fechaRespuesta?: string;
  respondidoPor?: string;
  appVersion?: string;
  metadata?: MetadataSoporte;
  comprobanteUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

