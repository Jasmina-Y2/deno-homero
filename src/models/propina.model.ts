export interface EnviarPropinaDto {
  idOyente: string;
  idCreador: string;
  cantidadMonedas: number;
  tipoSticker: string;
  idHistoria?: string;
  publicacionId?: string;
  texto?: string;
}

export interface ReciboTransaccion {
  id: string;
  idOyente?: string;
  idCreador?: string;
  idUsuario?: string;
  idHistoria?: string;
  publicacionId?: string;
  cantidadMonedas: number;
  tipoSticker?: string;
  tipo: "propina" | "recompensa_anuncio" | "recarga";
  fecha: string;
  estado: "completado" | "fallido";
  saldoAnteriorOyente?: number;
  nuevoSaldoOyente?: number;
  saldoAnteriorCreador?: number;
  nuevoSaldoCreador?: number;
  adId?: string;
  adNetwork?: string;
  [key: string]: any;
}

export interface ContraparteInfo {
  uid: string;
  nombre: string;
  photoURL?: string;
}

export interface HistorialMovimientoDto {
  id: string;
  tipoMovimiento: "gasto" | "ganancia" | "recompensa";
  tipo: string;
  cantidadMonedas: number;
  tipoSticker?: string;
  fecha: string;
  estado: string;
  contraparte?: ContraparteInfo;
  descripcion: string;
}

export interface ItemRankingCreador {
  posicion: number;
  idCreador: string;
  nombre: string;
  photoURL?: string;
  descripcion?: string;
  totalMonedas: number;
  totalPropinasRecibidas: number;
}

export interface RecompensaAnuncioDto {
  idUsuario: string;
  adId: string;
  cantidadMonedas?: number;
  adNetwork?: string;
}
