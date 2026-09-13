export type EstadoCompraApp =
  | "pendiente"
  | "concluido"
  | "problema"
  | "reembolsado"
  | "cancelado";

export type TipoItemCompra = "monedas" | "suscripcion" | "paquete_monedas" | "otro";

export interface InfoUsuarioCompra {
  uid: string;
  nombre?: string;
  email?: string;
  photoURL?: string;
}

export interface CompraApp {
  id: string;
  idUsuario: string;
  idCompraRevenueCat?: string | null;
  transactionIdStore?: string | null;
  originalTransactionId?: string | null;
  store?: "PLAY_STORE" | "APP_STORE" | "STRIPE" | "PROMOTIONAL" | string;
  entorno?: "PRODUCTION" | "SANDBOX" | string;
  productId: string;
  tipoItem: TipoItemCompra;
  cantidadMonedas?: number;
  precio?: number | null;
  moneda?: string;
  estado: EstadoCompraApp;
  motivoProblema?: string | null;
  detalleError?: string | null;
  reembolsado: boolean;
  fechaReembolso?: string | null;
  motivoReembolso?: string | null;
  saldoAnterior?: number;
  nuevoSaldo?: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaConclusion?: string | null;
  usuario?: InfoUsuarioCompra;
  rawEvent?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface CrearCompraAppDto {
  idUsuario: string;
  productId: string;
  tipoItem?: TipoItemCompra;
  cantidadMonedas?: number;
  idCompraRevenueCat?: string | null;
  transactionIdStore?: string | null;
  originalTransactionId?: string | null;
  store?: string;
  entorno?: string;
  precio?: number | null;
  moneda?: string;
  rawEvent?: Record<string, unknown> | null;
}

export interface FiltroComprasApp {
  idUsuario?: string;
  estado?: EstadoCompraApp | string;
  tipoItem?: string;
  limite?: number;
  desdeFecha?: string;
  hastaFecha?: string;
}
