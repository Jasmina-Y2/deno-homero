/**
 * Modelo para el control de límites de anuncios por dispositivo (Hardware / Device ID).
 * Colección Firestore: "device_ad_limits"
 */

export interface DeviceAdLimitDoc {
  /** ID único del dispositivo enviado desde el frontend (IDFV, Android ID, Secure UUID, etc.) */
  deviceId: string;
  /** Fecha del último anuncio visto en formato YYYY-MM-DD para control del ciclo diario */
  fechaUltimoAnuncio: string;
  /** Cantidad de anuncios visualizados en el día actual (máximo 3) */
  anunciosVistosHoy: number;
  /** Conteo total histórico de anuncios vistos en este dispositivo */
  totalAnunciosHistoricos?: number;
  /** UID del último usuario que reclamó una recompensa desde este dispositivo */
  ultimoUid?: string;
  /** Lista de UIDs que han utilizado este dispositivo (auditoría anti-multicuenta) */
  historialUids?: string[];
  /** Fecha de registro inicial del dispositivo (ISO 8601) */
  fechaCreacion?: string;
  /** Fecha de la última actualización (ISO 8601) */
  fechaActualizacion: string;
}

export interface RecompensaDispositivoParams {
  /** UID del usuario que recibirá las monedas */
  uid: string;
  /** Identificador único del dispositivo físico */
  deviceId: string;
  /** Cantidad de monedas a otorgar (por defecto 10, configurable entre 1 y 50) */
  cantidadMonedas?: number;
  /** Identificador único del anuncio (para prevención anti-replay) */
  adId?: string;
  /** Red publicitaria proveedora del anuncio (e.g. "admob", "unity", "applovin") */
  adNetwork?: string;
}

export interface ResultadoRecompensaDispositivo {
  exito: boolean;
  deviceId: string;
  uid: string;
  monedasOtorgadas: number;
  nuevoSaldo: number;
  anunciosVistosHoy: number;
  anunciosRestantes: number;
  fecha: string;
  reciboId?: string;
}

export interface EstadoLimiteDispositivo {
  deviceId: string;
  anunciosVistosHoy: number;
  anunciosRestantes: number;
  limiteAlcanzado: boolean;
  fechaUltimoAnuncio: string;
  totalAnunciosHistoricos: number;
}
