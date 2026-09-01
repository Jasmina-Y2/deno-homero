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
  estado?: "pendiente" | "en_revision" | "resuelto" | "rechazado" | "respondido" | string;
  respuesta?: string;
  fechaRespuesta?: string;
  respondidoPor?: string;
  appVersion?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

