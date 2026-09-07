export type EstadoPago = "pendiente" | "en_proceso" | "completado" | "rechazado" | "cancelado";

export interface InfoUsuarioPago {
  uid: string;
  nombre: string;
  photoURL?: string;
  email?: string;
  telefono?: string;
  descripcion?: string;
}

export interface SolicitarRetiroDto {
  idUsuario: string;
  idDestino?: string;
  cantidadMonedas: number;
  monto?: number;
  moneda?: string;
  metodoPago?: string;
  detallesPago?: Record<string, any> | string;
  correoPago?: string;
  cuentaDestino?: string;
  nombreBeneficiario?: string;
  documentoIdentidad?: string;
  telefono?: string;
  nota?: string;
  [key: string]: any;
}

export interface Pago {
  id: string;
  idUsuario: string;
  idDestino: string;
  cantidadMonedas: number;
  monto?: number | null;
  moneda: string;
  metodoPago: string;
  detallesPago?: Record<string, any> | string;
  correoPago?: string;
  cuentaDestino?: string;
  nombreBeneficiario?: string;
  documentoIdentidad?: string;
  telefono?: string;
  nota?: string;
  estado: EstadoPago;
  transactionId: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  comprobanteUrl?: string;
  notaAdmin?: string;
  usuario?: InfoUsuarioPago;
  [key: string]: any;
}

export interface ReciboTransaccionPago {
  id: string;
  idUsuario: string;
  idRemitente: string;
  idOyente: string;
  idDestino: string;
  idCreador: string;
  idDestinatario: string;
  cantidadMonedas: number;
  tipo: "retiro" | "solicitud_retiro" | "pago";
  fecha: string;
  estado: "completado" | "fallido";
  pagoId: string;
  metodoPago?: string;
  saldoAnteriorUsuario: number;
  nuevoSaldoUsuario: number;
  saldoAnteriorHomero: number;
  nuevoSaldoHomero: number;
  descripcion: string;
  [key: string]: any;
}

export interface ResultadoSolicitudRetiro {
  pago: Pago;
  recibo: ReciboTransaccionPago;
  nuevoSaldoUsuario: number;
  nuevoSaldoHomero: number;
}
