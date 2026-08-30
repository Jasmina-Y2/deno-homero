export interface Notificacion {
  idDoc?: string;
  id?: string;
  uidUsuario: string;
  idDestinatario: string;
  titulo: string;
  mensaje: string;
  tipo?: string;
  data?: Record<string, any>;
  leido: boolean;
  fecha: string;
  fechaCreacion?: string;
}
