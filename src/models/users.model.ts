export interface PerfilUsuario {
  name: string;
  email: string;
  photoURL: string;
  descripcion: string;
  rol: "usuario" | "creador" | "admin" | string;
  verificado: boolean;
  marco_perfil_id?: string | number | null;
}

export interface SuscripcionItem {
  entitlementId: string; // ej: "lector_vip", "creador_estelar"
  productId: string; // ej: "homero_lector_vip:lector-vip-mensual"
  activo: boolean;
  fechaSuscripcion: string | null;
  fechaVencimiento: string | null;
  diasDuracion: number;
  autoRenovacion: boolean;
}

export interface BilleteraUsuario {
  walletBalance: number;
  elevensLab: number;
  mesRecargaFreeElevenLabs: string;
}

export interface ActividadDiariaUsuario {
  anunciosVistosHoy: number;
  fechaUltimoAnuncio: string;
  dia_racha: number;
  fechaUltimaRacha: string | null;
}

export interface SistemaUsuario {
  fcmToken: string;
  ultimoDeviceId: string;
  bovedaPin: string;
  metodo: string;
  ADMIN: boolean;
  activo: boolean;
  fechaRegistro: string;
  fechaActualizacion: string;
}

export interface UsuarioDocumento {
  uid: string;
  perfil: PerfilUsuario;
  suscripciones: SuscripcionItem[];
  billetera: BilleteraUsuario;
  actividadDiaria: ActividadDiariaUsuario;
  sistema: SistemaUsuario;
}

export interface DatosUsuario {
  uid: string;
  email?: string;
  name?: string;
  photoURL?: string;
  descripcion?: string;
  rol?: string;
  verificado?: boolean;
  fechaRegistro?: string;
  metodo?: string;
  perfil?: Partial<PerfilUsuario>;
  suscripciones?: SuscripcionItem[];
  billetera?: Partial<BilleteraUsuario>;
  actividadDiaria?: Partial<ActividadDiariaUsuario>;
  sistema?: Partial<SistemaUsuario>;
  [key: string]: any;
}
