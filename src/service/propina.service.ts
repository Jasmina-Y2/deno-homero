import { db } from "../config/firebase.ts";
import {
  EnviarPropinaDto,
  HistorialMovimientoDto,
  ItemRankingCreador,
  ReciboTransaccion,
  RecompensaAnuncioDto,
} from "../models/propina.model.ts";
import { enviarPush } from "./notification.service.ts";

/**
 * Obtiene la referencia directa del documento de un usuario en Firestore.
 * Primero busca por Document ID directo y, si no existe, busca por el campo `uid`.
 */
export const obtenerDocRefUsuario = async (uid: string) => {
  const refDirecta = db.collection("users").doc(uid);
  const snapDirecta = await refDirecta.get();
  if (snapDirecta.exists) {
    return refDirecta;
  }

  const snapQuery = await db.collection("users").where("uid", "==", uid).limit(1).get();
  if (!snapQuery.empty) {
    return snapQuery.docs[0].ref;
  }

  return refDirecta;
};

/**
 * Helper para obtener datos básicos de un usuario (nombre, fotoURL).
 */
const obtenerInfoUsuario = async (uid: string) => {
  try {
    const docRef = await obtenerDocRefUsuario(uid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const d = docSnap.data() || {};
      return {
        uid,
        nombre: d.name || d.nombre || d.displayName || "Usuario",
        photoURL: d.photoURL || d.foto || "",
        descripcion: d.descripcion || "",
      };
    }
  } catch (_e) {
    // Si falla la lectura de perfil, retornar fallback
  }
  return {
    uid,
    nombre: "Usuario",
    photoURL: "",
    descripcion: "",
  };
};

/**
 * Ejecuta la transacción atómica para el envío de propinas entre un oyente y un creador.
 */
export const enviarPropinaService = async (datos: EnviarPropinaDto) => {
  const { idOyente, idCreador, cantidadMonedas, tipoSticker } = datos;

  if (idOyente === idCreador) {
    throw new Error("No puedes enviarte propinas a ti mismo");
  }

  if (cantidadMonedas <= 0) {
    throw new Error("La cantidad de monedas debe ser mayor a 0");
  }

  // 1. Obtener referencias de documentos de oyente y creador
  const oyenteRef = await obtenerDocRefUsuario(idOyente);
  const creadorRef = await obtenerDocRefUsuario(idCreador);

  // 2. Ejecutar transacción atómica en Firestore
  const resultado = await db.runTransaction(async (transaction: any) => {
    // --- FASE DE LECTURA (Todas las lecturas antes de escrituras) ---
    const oyenteDoc = await transaction.get(oyenteRef);
    if (!oyenteDoc.exists) {
      throw new Error("Usuario oyente no encontrado");
    }

    const creadorDoc = await transaction.get(creadorRef);

    const oyenteData = oyenteDoc.data() || {};
    const rawSaldoOyente = oyenteData.walletBalance ?? 0;
    const saldoActualOyente = Number(rawSaldoOyente);

    // Validación de fondos suficientes
    if (isNaN(saldoActualOyente) || saldoActualOyente < cantidadMonedas) {
      throw new Error("Saldo insuficiente");
    }

    const nuevoSaldoOyente = saldoActualOyente - cantidadMonedas;

    const creadorData = creadorDoc.exists ? (creadorDoc.data() || {}) : {};
    const rawSaldoCreador = creadorData.walletBalance ?? 0;
    const saldoActualCreador = Number(rawSaldoCreador);
    const nuevoSaldoCreador = saldoActualCreador + cantidadMonedas;

    const fechaActual = new Date().toISOString();

    // Referencia para el nuevo recibo en la colección 'transactions'
    const transactionRef = db.collection("transactions").doc();

    const recibo: ReciboTransaccion = {
      id: transactionRef.id,
      idOyente,
      idCreador,
      cantidadMonedas,
      tipoSticker,
      tipo: "propina",
      fecha: fechaActual,
      estado: "completado",
      saldoAnteriorOyente: saldoActualOyente,
      nuevoSaldoOyente: nuevoSaldoOyente,
      saldoAnteriorCreador: saldoActualCreador,
      nuevoSaldoCreador: nuevoSaldoCreador,
    };

    // --- FASE DE ESCRITURA ---
    // Comando 1: Restar monedas al oyente
    transaction.update(oyenteRef, {
      walletBalance: nuevoSaldoOyente,
      fechaActualizacion: fechaActual,
    });

    // Comando 2: Sumar la misma cantidad al creador
    if (creadorDoc.exists) {
      transaction.update(creadorRef, {
        walletBalance: nuevoSaldoCreador,
        fechaActualizacion: fechaActual,
      });
    } else {
      transaction.set(
        creadorRef,
        {
          uid: idCreador,
          walletBalance: nuevoSaldoCreador,
          fechaCreacion: fechaActual,
          fechaActualizacion: fechaActual,
        },
        { merge: true },
      );
    }

    // Comando 3: Escribir recibo en la colección 'transactions'
    transaction.set(transactionRef, recibo);

    return {
      recibo,
      nuevoSaldoOyente,
      nuevoSaldoCreador,
    };
  });

  console.log(
    `✅ [Propina] Transacción completada. Oyente: ${idOyente} (-${cantidadMonedas}), Creador: ${idCreador} (+${cantidadMonedas})`,
  );

  // 1. Guardar automáticamente el sticker/propina en la colección 'comentarios'
  try {
    const publicacionId = datos.idHistoria || datos.publicacionId || "";
    const infoOyente = await obtenerInfoUsuario(idOyente);
    const fechaAhora = new Date().toISOString();

    await db.collection("Comentarios").add({
      publicacionId: publicacionId,
      idAutor: idOyente,
      idCreador: idCreador,
      nombre: infoOyente.nombre || "Usuario",
      photoURL: infoOyente.photoURL || "",
      texto: datos.texto || `Envió un sticker (${tipoSticker}) de ${cantidadMonedas} monedas 🪙`,
      tipoSticker: tipoSticker,
      cantidadMonedas: cantidadMonedas,
      esPropina: true,
      tipo: "sticker",
      fecha: fechaAhora,
      createdAt: fechaAhora,
    });
    console.log(`💬 [Comentario Propina] Registrado en colección 'comentarios' para publicación: ${publicacionId || 'general'}`);
  } catch (errComentario) {
    console.warn("⚠️ Error al guardar comentario de propina:", errComentario);
  }

  // 2. Enviar notificación push directa al celular del creador (vía FCM puro, sin subcolecciones en users)
  try {
    const creadorSnap = await creadorRef.get();
    const creadorToken = creadorSnap.data()?.fcmToken;

    if (creadorToken) {
      enviarPush(
        creadorToken,
        "¡Nueva propina recibida! 🎉",
        `¡Alguien te envió el sticker '${tipoSticker}' y ganaste ${cantidadMonedas} monedas!`,
        {
          tipo: "propina",
          tipoSticker,
          cantidadMonedas: String(cantidadMonedas),
          idOyente,
          idHistoria: datos.idHistoria || datos.publicacionId || "",
          transactionId: resultado.recibo.id,
        },
      ).catch((notifError) => {
        console.warn("⚠️ No se pudo enviar notificación push al creador:", notifError);
      });
    }
  } catch (err) {
    console.warn("⚠️ Error al obtener token para push:", err);
  }

  return resultado;
};

/**
 * Consulta el historial de movimientos de un usuario (gastos, ganancias y recompensas por anuncios).
 * Ordena cronológicamente descendente para mostrar lo más reciente primero.
 */
export const obtenerHistorialUsuarioService = async (uid: string) => {
  try {
    // Consultar paralelamente los posibles roles del usuario en 'transactions'
    const [snapOyente, snapRemitente, snapCreador, snapAutor, snapUsuario] = await Promise.all([
      db.collection("transactions").where("idOyente", "==", uid).get(),
      db.collection("transactions").where("idRemitente", "==", uid).get(),
      db.collection("transactions").where("idCreador", "==", uid).get(),
      db.collection("transactions").where("idAutor", "==", uid).get(),
      db.collection("transactions").where("idUsuario", "==", uid).get(),
    ]);

    const docsMap = new Map<string, any>();

    const procesarDocs = (snapshot: any) => {
      snapshot.docs.forEach((doc: any) => {
        if (!docsMap.has(doc.id)) {
          docsMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });
    };

    procesarDocs(snapOyente);
    procesarDocs(snapRemitente);
    procesarDocs(snapCreador);
    procesarDocs(snapAutor);
    procesarDocs(snapUsuario);

    const todasTransacciones = Array.from(docsMap.values());

    // Identificar contrapartes únicas para consultar sus perfiles
    const contrapartesIds = new Set<string>();
    for (const t of todasTransacciones) {
      if (t.idOyente && t.idOyente !== uid) contrapartesIds.add(t.idOyente);
      if (t.idRemitente && t.idRemitente !== uid) contrapartesIds.add(t.idRemitente);
      if (t.idCreador && t.idCreador !== uid) contrapartesIds.add(t.idCreador);
      if (t.idAutor && t.idAutor !== uid) contrapartesIds.add(t.idAutor);
    }

    const perfilesMap = new Map<string, any>();
    await Promise.all(
      Array.from(contrapartesIds).map(async (cId) => {
        const info = await obtenerInfoUsuario(cId);
        perfilesMap.set(cId, info);
      }),
    );

    let totalGastos = 0;
    let totalGanancias = 0;
    let totalRecompensas = 0;

    const movimientos: HistorialMovimientoDto[] = todasTransacciones.map((t) => {
      const cantidad = Number(t.cantidadMonedas ?? t.monedas ?? 0);
      const esGasto = (t.idOyente === uid || t.idRemitente === uid);
      const esRecompensa = t.tipo === "recompensa_anuncio" || t.idUsuario === uid && !t.idCreador && !t.idOyente;
      const esGanancia = (t.idCreador === uid || t.idAutor === uid || t.idDestinatario === uid) && !esGasto;

      let tipoMovimiento: "gasto" | "ganancia" | "recompensa" = "gasto";
      let contraparteUid = "";
      let descripcion = "";

      if (esRecompensa) {
        tipoMovimiento = "recompensa";
        totalRecompensas += cantidad;
        descripcion = `Recompensa por video de anuncio (${t.adNetwork || "AdMob"})`;
      } else if (esGanancia) {
        tipoMovimiento = "ganancia";
        totalGanancias += cantidad;
        contraparteUid = t.idOyente || t.idRemitente || "";
        const stickerTxt = t.tipoSticker ? ` [Sticker: ${t.tipoSticker}]` : "";
        descripcion = `Propina recibida${stickerTxt}`;
      } else {
        tipoMovimiento = "gasto";
        totalGastos += cantidad;
        contraparteUid = t.idCreador || t.idAutor || "";
        const stickerTxt = t.tipoSticker ? ` [Sticker: ${t.tipoSticker}]` : "";
        descripcion = `Propina enviada${stickerTxt}`;
      }

      const contraparte = contraparteUid ? perfilesMap.get(contraparteUid) : undefined;

      return {
        id: t.id,
        tipoMovimiento,
        tipo: t.tipo || "propina",
        cantidadMonedas: cantidad,
        tipoSticker: t.tipoSticker,
        fecha: t.fecha || new Date().toISOString(),
        estado: t.estado || "completado",
        contraparte,
        descripcion,
      };
    });

    // Ordenar de más reciente a más antiguo
    movimientos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return {
      uid,
      totalMovimientos: movimientos.length,
      totalGastos,
      totalGanancias,
      totalRecompensas,
      transacciones: movimientos,
    };
  } catch (error) {
    console.error("❌ Error en obtenerHistorialUsuarioService:", error);
    throw new Error("Error al obtener el historial de transacciones");
  }
};

/**
 * Genera el ranking de creadores con base en las propinas recibidas en el mes.
 * Si no se especifica mes, utiliza el mes actual.
 */
export const obtenerRankingCreadoresService = async (mesParam?: string) => {
  try {
    let inicioStr = "";
    let finStr = "";
    let periodo = "";

    if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
      periodo = mesParam;
      const [year, month] = mesParam.split("-").map(Number);
      const inicio = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const fin = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      inicioStr = inicio.toISOString();
      finStr = fin.toISOString();
    } else {
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth(); // 0-indexado
      periodo = `${year}-${String(month + 1).padStart(2, "0")}`;
      const inicio = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      const fin = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
      inicioStr = inicio.toISOString();
      finStr = fin.toISOString();
    }

    // Consultar transacciones de propina
    let docsTransacciones: any[] = [];
    try {
      const snap = await db.collection("transactions")
        .where("tipo", "==", "propina")
        .where("fecha", ">=", inicioStr)
        .where("fecha", "<", finStr)
        .get();
      docsTransacciones = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } catch (_compIndexError) {
      // Fallback en caso de que Firestore requiera índice compuesto
      const allSnap = await db.collection("transactions")
        .where("tipo", "==", "propina")
        .get();
      docsTransacciones = allSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((d: any) => {
          const f = d.fecha || "";
          return f >= inicioStr && f < finStr;
        });
    }

    // Agrupar monedas por creador
    const acumuladoCreadores = new Map<string, { totalMonedas: number; totalPropinas: number }>();

    for (const t of docsTransacciones) {
      const idCreador = t.idCreador || t.idAutor;
      if (!idCreador) continue;

      const cantidad = Number(t.cantidadMonedas ?? 0);
      const actual = acumuladoCreadores.get(idCreador) || { totalMonedas: 0, totalPropinas: 0 };
      actual.totalMonedas += cantidad;
      actual.totalPropinas += 1;
      acumuladoCreadores.set(idCreador, actual);
    }

    // Consultar perfiles de los creadores en el ranking
    const creadoresIds = Array.from(acumuladoCreadores.keys());
    const rankingItems: ItemRankingCreador[] = await Promise.all(
      creadoresIds.map(async (idCreador) => {
        const stats = acumuladoCreadores.get(idCreador)!;
        const perfil = await obtenerInfoUsuario(idCreador);

        return {
          posicion: 0,
          idCreador,
          nombre: perfil.nombre,
          photoURL: perfil.photoURL,
          descripcion: perfil.descripcion,
          totalMonedas: stats.totalMonedas,
          totalPropinasRecibidas: stats.totalPropinas,
        };
      }),
    );

    // Ordenar de mayor a menor según total de monedas recibidas
    rankingItems.sort((a, b) => b.totalMonedas - a.totalMonedas);

    // Asignar posición ordinal (1, 2, 3...)
    rankingItems.forEach((item, index) => {
      item.posicion = index + 1;
    });

    return {
      periodo,
      rangoFechas: { desde: inicioStr, hasta: finStr },
      totalCreadoresDestacados: rankingItems.length,
      ranking: rankingItems,
    };
  } catch (error) {
    console.error("❌ Error en obtenerRankingCreadoresService:", error);
    throw new Error("Error al calcular el ranking de creadores");
  }
};

/**
 * Reclama la recarga de saldo por ver un anuncio recompensado (AdMob).
 * Utiliza transacción atómica, validación de límite diario (máx 3/día por dispositivo y usuario)
 * e impide el fraude mediante validación anti-replay del adId y control en "device_ad_limits".
 */
export const reclamarRecompensaAnuncioService = async (datos: RecompensaAnuncioDto) => {
  const { idUsuario, adId, adNetwork, deviceId } = datos;

  if (!idUsuario || typeof idUsuario !== "string" || idUsuario.trim() === "") {
    throw new Error("El ID del usuario es requerido");
  }

  if (!adId || typeof adId !== "string" || adId.trim() === "") {
    throw new Error("El identificador del anuncio (adId) es requerido");
  }

  const cleanUid = idUsuario.trim();
  const cleanAdId = adId.trim();
  const cleanDeviceId = (deviceId && typeof deviceId === "string" && deviceId.trim() !== "")
    ? deviceId.trim()
    : undefined;

  // Protección anti-replay: verificar si este anuncio individual ya fue recompensado
  const existingRewardSnap = await db.collection("transactions")
    .where("adId", "==", cleanAdId)
    .limit(1)
    .get();

  if (!existingRewardSnap.empty) {
    throw new Error("Esta recompensa de anuncio ya fue reclamada");
  }

  // Establecer recompensa segura de monedas (entre 1 y 50 monedas, default 10)
  const monedasOtorgadas = Math.min(Math.max(Number(datos.cantidadMonedas || 10), 1), 50);

  const userRef = await obtenerDocRefUsuario(cleanUid);
  const deviceRef = cleanDeviceId ? db.collection("device_ad_limits").doc(cleanDeviceId) : null;
  const transactionRef = db.collection("transactions").doc();

  const hoyStr = new Date().toISOString().split("T")[0];
  const fechaActual = new Date().toISOString();

  const resultado = await db.runTransaction(async (transaction: any) => {
    // --- FASE 1: LECTURAS ATÓMICAS (Antes de cualquier escritura) ---
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("Usuario no encontrado");
    }

    let deviceDoc: any = null;
    if (deviceRef) {
      deviceDoc = await transaction.get(deviceRef);
    }

    const userData = userDoc.data() || {};
    const saldoActual = Number(userData.walletBalance ?? 0);
    const nuevoSaldo = (isNaN(saldoActual) ? 0 : saldoActual) + monedasOtorgadas;

    // --- FASE 2: VALIDACIÓN DE LÍMITES DIARIOS (MÁX 3/DÍA) ---
    let anunciosVistosHoy = 0;
    let totalHistoricoDispositivo = 0;
    let uidsList: string[] = [];

    // Si hay deviceId, el límite prioritario es el del hardware/dispositivo
    if (deviceDoc && deviceDoc.exists) {
      const deviceData = deviceDoc.data() || {};
      const fechaUltimoDevice = deviceData.fechaUltimoAnuncio || "";
      totalHistoricoDispositivo = Number(deviceData.totalAnunciosHistoricos || 0);
      uidsList = Array.isArray(deviceData.historialUids) ? [...deviceData.historialUids] : [];

      if (fechaUltimoDevice === hoyStr) {
        anunciosVistosHoy = Number(deviceData.anunciosVistosHoy || 0);
      } else {
        anunciosVistosHoy = 0;
      }
    } else if (!deviceDoc) {
      // Fallback a nivel de usuario si no se envió deviceId
      const fechaUltimoAnuncio = userData.fechaUltimoAnuncio || "";
      if (fechaUltimoAnuncio === hoyStr) {
        anunciosVistosHoy = Number(userData.anunciosVistosHoy || 0);
      } else {
        anunciosVistosHoy = 0;
      }
    }

    // ⛔ Validar límite diario (máximo 3 anuncios por día)
    if (anunciosVistosHoy >= 3) {
      if (cleanDeviceId) {
        throw new Error("El dispositivo ha alcanzado el límite de 3 anuncios por hoy. Vuelve mañana.");
      } else {
        throw new Error("Has alcanzado el límite de 3 anuncios por hoy. Vuelve mañana.");
      }
    }

    const nuevoConteoHoy = anunciosVistosHoy + 1;
    const nuevoTotalHistorico = totalHistoricoDispositivo + 1;

    if (cleanDeviceId && !uidsList.includes(cleanUid)) {
      uidsList.push(cleanUid);
    }

    // --- FASE 3: ESCRITURAS ATÓMICAS ---

    // 1. Si existe deviceId, actualizar documento en "device_ad_limits/{deviceId}"
    if (deviceRef) {
      transaction.set(deviceRef, {
        deviceId: cleanDeviceId,
        fechaUltimoAnuncio: hoyStr,
        anunciosVistosHoy: nuevoConteoHoy,
        totalAnunciosHistoricos: nuevoTotalHistorico,
        ultimoUid: cleanUid,
        historialUids: uidsList,
        fechaActualizacion: fechaActual,
        ...((deviceDoc && deviceDoc.exists) ? {} : { fechaCreacion: fechaActual }),
      }, { merge: true });
    }

    // 2. Actualizar usuario con saldo y nuevo conteo diario
    transaction.update(userRef, {
      walletBalance: nuevoSaldo,
      fechaUltimoAnuncio: hoyStr,
      anunciosVistosHoy: nuevoConteoHoy,
      ...(cleanDeviceId ? { ultimoDeviceId: cleanDeviceId } : {}),
      fechaActualizacion: fechaActual,
    });

    // 3. Guardar recibo en transactions
    const recibo: ReciboTransaccion = {
      id: transactionRef.id,
      idUsuario: cleanUid,
      ...(cleanDeviceId ? { deviceId: cleanDeviceId } : {}),
      tipo: "recompensa_anuncio",
      adId: cleanAdId,
      adNetwork: adNetwork || "admob",
      cantidadMonedas: monedasOtorgadas,
      fecha: fechaActual,
      estado: "completado",
      saldoAnteriorOyente: saldoActual,
      nuevoSaldoOyente: nuevoSaldo,
    };

    transaction.set(transactionRef, recibo);

    return {
      nuevoSaldo,
      monedasOtorgadas,
      anunciosVistosHoy: nuevoConteoHoy,
      anunciosRestantes: Math.max(0, 3 - nuevoConteoHoy),
      recibo,
    };
  });

  console.log(
    `🎬 [Anuncio Recompensado] Usuario ${cleanUid} (Device: ${cleanDeviceId || "N/A"}) recibió +${monedasOtorgadas} monedas (adId: ${cleanAdId}). Vistos hoy: ${resultado.anunciosVistosHoy}/3. Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  return resultado;
};

/**
 * Restablece el límite diario de anuncios de un usuario (para pruebas o desarrollo).
 */
export const resetearLimiteAnunciosService = async (idUsuario: string) => {
  if (!idUsuario || typeof idUsuario !== "string") {
    throw new Error("El ID del usuario es requerido");
  }

  const userRef = await obtenerDocRefUsuario(idUsuario);
  await userRef.set(
    {
      anunciosVistosHoy: 0,
      fechaUltimoAnuncio: "",
    },
    { merge: true },
  );

  return {
    success: true,
    message: `Límite diario de anuncios restablecido a 0/3 para el usuario ${idUsuario}`,
    anunciosVistosHoy: 0,
    anunciosRestantes: 3,
  };
};

/**
 * Procesa la compra de un paquete de monedas originada desde RevenueCat (Google Play / App Store).
 * Utiliza idempotencia mediante eventId para evitar doble acreditación si RevenueCat reintenta el webhook.
 */
export const acreditarMonedasCompraRevenueCatService = async (params: {
  uid: string;
  productId: string;
  eventId?: string;
  monedasManual?: number;
  precio?: number;
  moneda?: string;
}) => {
  const { uid, productId, eventId } = params;

  if (!uid) {
    throw new Error("UID de usuario requerido para acreditar compra");
  }

  // 1. Verificar idempotencia: si ya procesamos este eventId de RevenueCat
  if (eventId) {
    const existingSnap = await db.collection("transactions")
      .where("idCompraRevenueCat", "==", eventId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      console.log(`ℹ️ [RevenueCat Monedas] Compra con eventId ${eventId} ya fue procesada anteriormente.`);
      const existingDoc = existingSnap.docs[0].data();
      return {
        alreadyProcessed: true,
        nuevoSaldo: existingDoc.nuevoSaldoOyente,
        cantidadMonedas: existingDoc.cantidadMonedas,
      };
    }
  }

  // 2. Determinar cantidad de monedas según productId
  let cantidadMonedas = params.monedasManual || 0;
  if (!cantidadMonedas) {
    const match = productId.match(/(\d+)/);
    if (match) {
      cantidadMonedas = parseInt(match[1], 10);
    } else {
      const MAPA_MONEDAS: Record<string, number> = {
        "coins_tier_1": 100,
        "coins_tier_2": 500,
        "coins_tier_3": 1000,
        "coins_tier_4": 2500,
        "coins_tier_5": 5000,
        "paquete_basico": 100,
        "paquete_pro": 500,
        "paquete_master": 1000,
      };
      cantidadMonedas = MAPA_MONEDAS[productId.toLowerCase()] || 100;
    }
  }

  const userRef = await obtenerDocRefUsuario(uid);

  // 3. Transacción atómica en Firestore
  const resultado = await db.runTransaction(async (transaction: any) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error(`Usuario ${uid} no encontrado en Firestore`);
    }

    const userData = userDoc.data() || {};
    const saldoActual = Number(userData.walletBalance ?? 0);
    const nuevoSaldo = saldoActual + cantidadMonedas;
    const fechaActual = new Date().toISOString();

    const transactionRef = db.collection("transactions").doc();

    const recibo = {
      id: transactionRef.id,
      idUsuario: uid,
      tipo: "compra_monedas",
      idCompraRevenueCat: eventId || null,
      productId: productId,
      cantidadMonedas: cantidadMonedas,
      fecha: fechaActual,
      estado: "completado",
      saldoAnteriorOyente: saldoActual,
      nuevoSaldoOyente: nuevoSaldo,
    };

    transaction.update(userRef, {
      walletBalance: nuevoSaldo,
      fechaActualizacion: fechaActual,
    });

    transaction.set(transactionRef, recibo);

    return {
      nuevoSaldo,
      cantidadMonedas,
      recibo,
    };
  });

  console.log(
    `💰 [RevenueCat Monedas] Compra acreditada a ${uid}: +${cantidadMonedas} monedas (productId: ${productId}). Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  // 4. Notificar al usuario por Push FCM directo
  try {
    const userDocSnap = await userRef.get();
    const userToken = userDocSnap.data()?.fcmToken;
    if (userToken) {
      enviarPush(
        userToken,
        "¡Compra acreditada! 🪙",
        `Se han acreditado con éxito ${cantidadMonedas} monedas a tu billetera.`,
        {
          tipo: "compra_monedas",
          cantidadMonedas: String(cantidadMonedas),
          productId,
        },
      ).catch((e) => console.warn("⚠️ Error enviando push de compra de monedas:", e));
    }
  } catch (_e) {
    // Ignorar si falla push
  }

  return resultado;
};
