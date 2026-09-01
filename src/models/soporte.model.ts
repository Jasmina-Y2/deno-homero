export interface ReporteSoporte {
  id?: string;
  idDoc?: string;
  uid?: string;
  nombreUsuario?: string;
  email?: string;
  categoria: string;
  asunto: string;
  descripcion: string;
  fecha?: string;
  estado?: "pendiente" | "en_revision" | "resuelto" | "rechazado";
  appVersion?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}
