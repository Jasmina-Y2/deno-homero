import { db } from "../config/firebase.ts";
import {
  DeviceAdLimitDoc,
  EstadoLimiteDispositivo,
  RecompensaDispositivoParams,
  ResultadoRecompensaDispositivo,
} from "../models/deviceAdLimit.model.ts";
import { ReciboTransaccion } from "../models/propina.model.ts";
import { obtenerDocRefUsuario } from "./propina.service.ts";

/** Límite diario de anuncios permitidos por dispositivo físico */
export const MAX_ANUNCIOS_POR_DISPOSITIVO_DIA = 3;

/** Cantidad de monedas otorgadas por defecto por anuncio */
export const MONEDAS_POR_DEFECTO = 10;

/** Nombre de la colección en Firestore para control de dispositivos */
export const COLECCION_DEVICE_AD_LIMITS = "device_ad_limits";

/**
 * Obtiene la fecha actual en formato "YYYY-MM-DD" en UTC
 * para garantizar consistencia horaria global entre clientes y servidor.
 */
export const obtenerFechaHoyUTC = (): string => {
  return new Date().toISOString().split("T")[0];
};

/**
 * Consulta el estado actual de anuncios para un dispositivo sin ejecutar transacciones de escritura.
 * 
 * @param deviceId Identificador único del dispositivo (hardware/app UUID)
 * @returns Estado del dispositivo con conteos y anuncios restantes para hoy
 */
export const consultarEstadoLimiteDispositivoService = async (
  deviceId: string,
): Promise<EstadoLimiteDispositivo> => {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    throw new Error("El identificador del dispositivo (deviceId) es requerido");
  }

  const cleanDeviceId = deviceId.trim();
  const deviceRef = db.collection(COLECCION_DEVICE_AD_LIMITS).doc(cleanDeviceId);
  const docSnap = await deviceRef.get();

  const hoyStr = obtenerFechaHoyUTC();

  if (!docSnap.exists) {
    return {
      deviceId: cleanDeviceId,
      anunciosVistosHoy: 0,
      anunciosRestantes: MAX_ANUNCIOS_POR_DISPOSITIVO_DIA,
      limiteAlcanzado: false,
      fechaUltimoAnuncio: hoyStr,
      totalAnunciosHistoricos: 0,
    };
  }

  const data = docSnap.data() as DeviceAdLimitDoc;
  const fechaUltimo = data.fechaUltimoAnuncio || "";
  const esMismoDia = fechaUltimo === hoyStr;

  const anunciosVistosHoy = esMismoDia ? Math.max(0, Number(data.anunciosVistosHoy || 0)) : 0;
  const anunciosRestantes = Math.max(0, MAX_ANUNCIOS_POR_DISPOSITIVO_DIA - anunciosVistosHoy);

  return {
    deviceId: cleanDeviceId,
    anunciosVistosHoy,
    anunciosRestantes,
    limiteAlcanzado: anunciosVistosHoy >= MAX_ANUNCIOS_POR_DISPOSITIVO_DIA,
    fechaUltimoAnuncio: fechaUltimo,
    totalAnunciosHistoricos: Number(data.totalAnunciosHistoricos || 0),
  };
};

/**
 * Valida el límite de anuncios por dispositivo físico y ejecuta una Transacción Atómica en Firestore.
 * 
 * Garantiza:
 * 1. Límite estricto de 3 anuncios diarios por Hardware/DeviceId (independientemente del UID que lo pida).
 * 2. Reseteo automático del contador al cambiar de día (formato YYYY-MM-DD).
 * 3. Prevención de condiciones de carrera (Race Conditions) ejecutando lecturas antes de escrituras dentro de db.runTransaction().
 * 4. Atomicidad: Incrementa contador en "device_ad_limits/{deviceId}" y suma saldo en "users/{uid}".
 * 
 * @param params Parámetros requeridos: uid del usuario y deviceId del dispositivo
 * @returns Resultado con el nuevo saldo, conteo actualizado y recibo
 */
export const validarYProcesarRecompensaDispositivoService = async (
  params: RecompensaDispositivoParams,
): Promise<ResultadoRecompensaDispositivo> => {
  const { uid, deviceId, cantidadMonedas, adId, adNetwork } = params;

  // --- 1. Validaciones previas de formato de entrada ---
  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    throw new Error("El identificador del usuario (uid) es requerido");
  }

  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    throw new Error("El identificador del dispositivo (deviceId) es requerido");
  }

  const cleanUid = uid.trim();
  const cleanDeviceId = deviceId.trim();
  const cleanAdId = adId ? adId.trim() : undefined;

  // Si se envió adId, validar anti-replay preventivo fuera de la transacción
  if (cleanAdId) {
    const existingSnap = await db.collection("transactions")
      .where("adId", "==", cleanAdId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new Error("Esta recompensa de anuncio ya fue reclamada previamente");
    }
  }

  // Establecer recompensa segura de monedas (mínimo 1, máximo 50, default 10)
  const monedasOtorgadas = Math.min(
    Math.max(Number(cantidadMonedas ?? MONEDAS_POR_DEFECTO), 1),
    50,
  );

  // Obtener referencia al documento del usuario
  const userRef = await obtenerDocRefUsuario(cleanUid);
  // Referencia al documento de límites del dispositivo (ID = deviceId)
  const deviceRef = db.collection(COLECCION_DEVICE_AD_LIMITS).doc(cleanDeviceId);
  const transactionRef = db.collection("transactions").doc();

  const hoyStr = obtenerFechaHoyUTC();
  const ahoraIso = new Date().toISOString();

  // --- 2. Transacción Atómica en Firestore (Evita Race Conditions) ---
  const resultado = await db.runTransaction(async (transaction: any) => {
    // -----------------------------------------------------------------
    // FASE 1: TODAS LAS LECTURAS (Must occur before any write operation)
    // -----------------------------------------------------------------
    const [deviceDocSnap, userDocSnap] = await Promise.all([
      transaction.get(deviceRef),
      transaction.get(userRef),
    ]);

    // Verificar existencia del usuario
    if (!userDocSnap.exists) {
      throw new Error(`Usuario con UID "${cleanUid}" no encontrado en el sistema`);
    }

    const userData = userDocSnap.data() || {};
    const saldoActual = Number(userData.walletBalance ?? 0);
    const nuevoSaldo = (isNaN(saldoActual) ? 0 : saldoActual) + monedasOtorgadas;

    // -----------------------------------------------------------------
    // FASE 2: EVALUACIÓN DE REGLAS DE NEGOCIO Y LÍMITE POR DISPOSITIVO
    // -----------------------------------------------------------------
    let anunciosVistosHoy = 0;
    let totalHistorico = 0;
    let uidsList: string[] = [];
    const deviceExiste = deviceDocSnap.exists;

    if (deviceExiste) {
      const deviceData = deviceDocSnap.data() as DeviceAdLimitDoc;
      const fechaUltimo = deviceData.fechaUltimoAnuncio || "";
      totalHistorico = Number(deviceData.totalAnunciosHistoricos || 0);
      uidsList = Array.isArray(deviceData.historialUids) ? [...deviceData.historialUids] : [];

      // Si la fecha del último anuncio coincide con el día de hoy, conservamos el conteo
      if (fechaUltimo === hoyStr) {
        anunciosVistosHoy = Number(deviceData.anunciosVistosHoy || 0);
      } else {
        // Nuevo día: El contador se reinicia automáticamente a 0
        anunciosVistosHoy = 0;
      }
    }

    // ⛔ RECHAZO INMEDIATO: Si ya vio 3 anuncios hoy en este dispositivo
    if (anunciosVistosHoy >= MAX_ANUNCIOS_POR_DISPOSITIVO_DIA) {
      throw new Error(
        `El dispositivo ha alcanzado el límite diario de ${MAX_ANUNCIOS_POR_DISPOSITIVO_DIA} anuncios. No se pueden otorgar más monedas hoy.`,
      );
    }

    // Calcular nuevos valores
    const nuevoConteoHoy = anunciosVistosHoy + 1;
    const nuevoTotalHistorico = totalHistorico + 1;

    if (!uidsList.includes(cleanUid)) {
      uidsList.push(cleanUid);
    }

    // -----------------------------------------------------------------
    // FASE 3: ESCRITURAS ATÓMICAS EN FIRESTORE
    // -----------------------------------------------------------------

    // 1. Actualizar o crear documento del dispositivo en "device_ad_limits/{deviceId}"
    const datosDispositivoActualizar: Partial<DeviceAdLimitDoc> = {
      deviceId: cleanDeviceId,
      fechaUltimoAnuncio: hoyStr,
      anunciosVistosHoy: nuevoConteoHoy,
      totalAnunciosHistoricos: nuevoTotalHistorico,
      ultimoUid: cleanUid,
      historialUids: uidsList,
      fechaActualizacion: ahoraIso,
    };

    if (!deviceExiste) {
      datosDispositivoActualizar.fechaCreacion = ahoraIso;
    }

    transaction.set(deviceRef, datosDispositivoActualizar, { merge: true });

    // 2. Sumar monedas y actualizar datos en la colección "users/{uid}"
    transaction.update(userRef, {
      walletBalance: nuevoSaldo,
      fechaUltimoAnuncio: hoyStr,
      anunciosVistosHoy: nuevoConteoHoy,
      ultimoDeviceId: cleanDeviceId,
      fechaActualizacion: ahoraIso,
    });

    // 3. Registrar comprobante en "transactions"
    const recibo: ReciboTransaccion = {
      id: transactionRef.id,
      idUsuario: cleanUid,
      deviceId: cleanDeviceId,
      tipo: "recompensa_anuncio",
      adId: cleanAdId || `ad_${Date.now()}_${cleanDeviceId.slice(0, 6)}`,
      adNetwork: adNetwork || "admob",
      cantidadMonedas: monedasOtorgadas,
      fecha: ahoraIso,
      estado: "completado",
      saldoAnteriorOyente: saldoActual,
      nuevoSaldoOyente: nuevoSaldo,
    };

    transaction.set(transactionRef, recibo);

    return {
      exito: true,
      deviceId: cleanDeviceId,
      uid: cleanUid,
      monedasOtorgadas,
      nuevoSaldo,
      anunciosVistosHoy: nuevoConteoHoy,
      anunciosRestantes: Math.max(0, MAX_ANUNCIOS_POR_DISPOSITIVO_DIA - nuevoConteoHoy),
      fecha: ahoraIso,
      reciboId: transactionRef.id,
    };
  });

  console.log(
    `📱 [Device Ad Limit] Device "${cleanDeviceId}" acreditó +${monedasOtorgadas} monedas a UID "${cleanUid}". Vistos hoy: ${resultado.anunciosVistosHoy}/${MAX_ANUNCIOS_POR_DISPOSITIVO_DIA}. Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  return resultado;
};

/**
 * Restablece el contador diario de un dispositivo a 0 (para soporte técnico o pruebas de QA).
 * 
 * @param deviceId Identificador único del dispositivo
 */
export const resetearLimiteDispositivoService = async (deviceId: string) => {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    throw new Error("El identificador del dispositivo (deviceId) es requerido");
  }

  const cleanDeviceId = deviceId.trim();
  const deviceRef = db.collection(COLECCION_DEVICE_AD_LIMITS).doc(cleanDeviceId);
  const ahoraIso = new Date().toISOString();
  const hoyStr = obtenerFechaHoyUTC();

  await deviceRef.set({
    deviceId: cleanDeviceId,
    anunciosVistosHoy: 0,
    fechaUltimoAnuncio: hoyStr,
    fechaActualizacion: ahoraIso,
  }, { merge: true });

  console.log(`🔄 [Device Ad Limit] Contador reseteado para dispositivo: ${cleanDeviceId}`);

  return {
    success: true,
    deviceId: cleanDeviceId,
    anunciosVistosHoy: 0,
    anunciosRestantes: MAX_ANUNCIOS_POR_DISPOSITIVO_DIA,
    mensaje: "Límite del dispositivo reiniciado exitosamente a 0",
  };
};
