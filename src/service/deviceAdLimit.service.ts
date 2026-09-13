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

/** Nombre de la colección para dispositivos bloqueados por contracargos/fraude */
export const COLECCION_DISPOSITIVOS_BLOQUEADOS = "dispositivos_bloqueados";

/**
 * Consulta si un dispositivo físico está bloqueado por reembolso o fraude
 */
export const verificarBloqueoDispositivoService = async (
  deviceId: string,
): Promise<{
  bloqueado: boolean;
  motivo?: string;
  deudaMonedas?: number;
  fechaBloqueo?: string;
  fechaLimitePago?: string;
  diasRestantes?: number;
  uidPropietario?: string;
}> => {
  if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
    return { bloqueado: false };
  }

  try {
    const cleanDeviceId = deviceId.trim();
    const snap = await db.collection(COLECCION_DISPOSITIVOS_BLOQUEADOS).doc(cleanDeviceId).get();

    if (!snap.exists) {
      return { bloqueado: false };
    }

    const data = snap.data() || {};
    if (!data.bloqueado) {
      return { bloqueado: false };
    }

    const ahora = Date.now();
    const fechaLimiteMs = data.fechaLimitePago ? new Date(data.fechaLimitePago).getTime() : ahora;
    const diasRestantes = Math.max(0, Math.ceil((fechaLimiteMs - ahora) / (1000 * 60 * 60 * 24)));

    return {
      bloqueado: true,
      motivo: data.motivo || "Dispositivo bloqueado por reembolso no autorizado. Tienes un plazo de 15 días para regularizar el pago.",
      deudaMonedas: Number(data.deudaMonedas || 0),
      fechaBloqueo: data.fechaBloqueo || "",
      fechaLimitePago: data.fechaLimitePago || "",
      diasRestantes,
      uidPropietario: data.uidPropietario || "",
    };
  } catch (_e) {
    return { bloqueado: false };
  }
};

/**
 * Bloquea un dispositivo físico con un plazo de 15 días para regularizar el pago
 */
export const bloquearDispositivoService = async (params: {
  deviceId: string;
  uid: string;
  deudaMonedas: number;
  motivo?: string;
}): Promise<void> => {
  const { deviceId, uid, deudaMonedas, motivo } = params;
  if (!deviceId) return;

  const cleanDeviceId = deviceId.trim();
  const ahora = new Date();
  const fechaLimite = new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

  await db.collection(COLECCION_DISPOSITIVOS_BLOQUEADOS).doc(cleanDeviceId).set({
    deviceId: cleanDeviceId,
    uidPropietario: uid,
    bloqueado: true,
    deudaMonedas,
    motivo: motivo || "Dispositivo bloqueado por reembolso no autorizado. Plazo de 15 días para regularizar el pago.",
    fechaBloqueo: ahora.toISOString(),
    fechaLimitePago: fechaLimite,
    diasPlazo: 15,
    pagado: false,
    fechaActualizacion: ahora.toISOString(),
  }, { merge: true });

  console.warn(`🔒 [Device Ban] Dispositivo '${cleanDeviceId}' BLOQUEADO por 15 días (Deuda: ${deudaMonedas} monedas).`);
};

/**
 * Desbloquea un dispositivo físico cuando el usuario regulariza el pago
 */
export const desbloquearDispositivoService = async (
  deviceId: string,
): Promise<boolean> => {
  if (!deviceId) return false;
  const cleanDeviceId = deviceId.trim();
  await db.collection(COLECCION_DISPOSITIVOS_BLOQUEADOS).doc(cleanDeviceId).set({
    bloqueado: false,
    pagado: true,
    fechaDesbloqueo: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
  }, { merge: true });
  console.log(`🔓 [Device Unban] Dispositivo '${cleanDeviceId}' DESBLOQUEADO.`);
  return true;
};

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
  const infoBloqueo = await verificarBloqueoDispositivoService(cleanDeviceId);
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
      bloqueado: infoBloqueo.bloqueado,
      motivoBloqueo: infoBloqueo.motivo,
      fechaLimitePago: infoBloqueo.fechaLimitePago,
      diasRestantes: infoBloqueo.diasRestantes,
      deudaMonedas: infoBloqueo.deudaMonedas,
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
    bloqueado: infoBloqueo.bloqueado,
    motivoBloqueo: infoBloqueo.motivo,
    fechaLimitePago: infoBloqueo.fechaLimitePago,
    diasRestantes: infoBloqueo.diasRestantes,
    deudaMonedas: infoBloqueo.deudaMonedas,
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

  // Validar si el dispositivo físico está bloqueado por contracargo/reembolso
  const infoBloqueo = await verificarBloqueoDispositivoService(cleanDeviceId);
  if (infoBloqueo.bloqueado) {
    throw new Error(`Dispositivo bloqueado por reembolso no autorizado. Plazo de 15 días (${infoBloqueo.diasRestantes || 0} días restantes) para regularizar tu pago de ${infoBloqueo.deudaMonedas || 0} monedas.`);
  }

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

  // Detección automática de compra en la aplicación
  const esCompra =
    (params as any).tipo === "compra_monedas" ||
    (params as any).tipo === "compras_app" ||
    (params as any).tipo === "compra" ||
    Boolean(cleanAdId && (cleanAdId.startsWith("buy_") || cleanAdId.startsWith("compra_") || cleanAdId.startsWith("paquete_") || cleanAdId.startsWith("coins_") || cleanAdId.startsWith("monedas_"))) ||
    Boolean(adNetwork && (adNetwork.includes("inapp") || adNetwork.includes("google") || adNetwork.includes("store")));

  // Si es compra, entregar la cantidad completa sin limitar a 50 monedas
  const monedasOtorgadas = esCompra
    ? Math.max(1, Number(cantidadMonedas || 50))
    : Math.min(Math.max(Number(cantidadMonedas ?? MONEDAS_POR_DEFECTO), 1), 50);

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
    const saldoActual = Number(userData.billetera?.walletBalance ?? userData.walletBalance ?? 0);
    const nuevoSaldo = (isNaN(saldoActual) ? 0 : saldoActual) + monedasOtorgadas;

    // -----------------------------------------------------------------
    // FASE 2: EVALUACIÓN DE REGLAS DE NEGOCIO Y LÍMITE POR DISPOSITIVO (SOLO ANUNCIOS)
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

    // ⛔ RECHAZO INMEDIATO: Si ya vio 3 anuncios hoy en este dispositivo (solo para anuncios)
    if (!esCompra && anunciosVistosHoy >= MAX_ANUNCIOS_POR_DISPOSITIVO_DIA) {
      throw new Error(
        `El dispositivo ha alcanzado el límite diario de ${MAX_ANUNCIOS_POR_DISPOSITIVO_DIA} anuncios. No se pueden otorgar más monedas hoy.`,
      );
    }

    // Calcular nuevos valores
    const nuevoConteoHoy = esCompra ? anunciosVistosHoy : (anunciosVistosHoy + 1);
    const nuevoTotalHistorico = esCompra ? totalHistorico : (totalHistorico + 1);

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
      "billetera.walletBalance": nuevoSaldo,
      "actividadDiaria.fechaUltimoAnuncio": hoyStr,
      "actividadDiaria.anunciosVistosHoy": nuevoConteoHoy,
      "sistema.ultimoDeviceId": cleanDeviceId,
      "sistema.fechaActualizacion": ahoraIso,
      walletBalance: nuevoSaldo,
      fechaUltimoAnuncio: hoyStr,
      anunciosVistosHoy: nuevoConteoHoy,
      ultimoDeviceId: cleanDeviceId,
      fechaActualizacion: ahoraIso,
    });

    // 3. Registrar comprobante en "transactions"
    const tipoTransaccion = esCompra ? "compra_monedas" : "recompensa_anuncio";
    const descripcionTransaccion = esCompra
      ? `Compras en la aplicación (+${monedasOtorgadas} monedas 🪙)`
      : `Recompensa por video de anuncio (${adNetwork || "AdMob"})`;

    const recibo: ReciboTransaccion = {
      id: transactionRef.id,
      idUsuario: cleanUid,
      deviceId: cleanDeviceId,
      tipo: tipoTransaccion,
      adId: cleanAdId || (esCompra ? `buy_${Date.now()}` : `ad_${Date.now()}_${cleanDeviceId.slice(0, 6)}`),
      adNetwork: esCompra ? "inapp" : (adNetwork || "admob"),
      cantidadMonedas: monedasOtorgadas,
      fecha: ahoraIso,
      estado: "completado",
      saldoAnteriorOyente: saldoActual,
      nuevoSaldoOyente: nuevoSaldo,
      descripcion: descripcionTransaccion,
    };

    transaction.set(transactionRef, recibo);

    // 4. Si es compra, registrar también en compras_app
    if (esCompra) {
      const compraRef = db.collection("compras_app").doc(transactionRef.id);
      transaction.set(compraRef, {
        id: transactionRef.id,
        idUsuario: cleanUid,
        productId: cleanAdId || "paquete_monedas",
        tipoItem: "monedas",
        cantidadMonedas: monedasOtorgadas,
        estado: "concluido",
        reembolsado: false,
        fechaCreacion: ahoraIso,
        fechaActualizacion: ahoraIso,
        fechaConclusion: ahoraIso,
        saldoAnterior: saldoActual,
        nuevoSaldo: nuevoSaldo,
      });
    }

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

  if (esCompra) {
    console.log(
      `🛒 [Compras App] Device "${cleanDeviceId}" procesó compra de +${monedasOtorgadas} monedas a UID "${cleanUid}" (${cleanAdId}). Nuevo saldo: ${resultado.nuevoSaldo}`,
    );
  } else {
    console.log(
      `📱 [Device Ad Limit] Device "${cleanDeviceId}" acreditó +${monedasOtorgadas} monedas a UID "${cleanUid}". Vistos hoy: ${resultado.anunciosVistosHoy}/${MAX_ANUNCIOS_POR_DISPOSITIVO_DIA}. Nuevo saldo: ${resultado.nuevoSaldo}`,
    );
  }

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
