export interface EnviarPropinaDto {
  idOyente: string;
  idCreador: string;
  cantidadMonedas: number;
  tipoSticker: string;
}

export interface ReciboTransaccion {
  id: string;
  idOyente: string;
  idCreador: string;
  cantidadMonedas: number;
  tipoSticker: string;
  tipo: "propina";
  fecha: string;
  estado: "completado";
  saldoAnteriorOyente: number;
  nuevoSaldoOyente: number;
  saldoAnteriorCreador?: number;
  nuevoSaldoCreador?: number;
}
