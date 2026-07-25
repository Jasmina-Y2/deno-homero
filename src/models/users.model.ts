export interface DatosUsuario {
  uid: string;
  email: string;
  fechaRegistro?: string;
  metodo?: string; // "google", "facebook", "email", etc.
  [key: string]: any;
}
