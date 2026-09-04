import { db } from "../config/firebase.ts";
import {
  EnviarPropinaDto,
  HistorialMovimientoDto,
  ItemRankingCreador,
  ReciboTransaccion,
  RecompensaAnuncioDto,
} from "../models/propina.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

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
    const rawSaldoOyente = oyenteData.saldoMonedas ?? oyenteData.walletBalance ?? oyenteData.monedas ?? oyenteData.coins ?? 0;
    const saldoActualOyente = Number(rawSaldoOyente);

    // Validación de fondos suficientes
    if (isNaN(saldoActualOyente) || saldoActualOyente < cantidadMonedas) {
      throw new Error("Saldo insuficiente");
    }

    const nuevoSaldoOyente = saldoActualOyente - cantidadMonedas;

    const creadorData = creadorDoc.exists ? (creadorDoc.data() || {}) : {};
    const rawSaldoCreador = creadorData.saldoMonedas ?? creadorData.walletBalance ?? creadorData.monedas ?? creadorData.coins ?? 0;
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
      saldoMonedas: nuevoSaldoOyente,
      monedas: nuevoSaldoOyente,
      fechaActualizacion: fechaActual,
    });

    // Comando 2: Sumar la misma cantidad al creador
    if (creadorDoc.exists) {
      transaction.update(creadorRef, {
        walletBalance: nuevoSaldoCreador,
        saldoMonedas: nuevoSaldoCreador,
        monedas: nuevoSaldoCreador,
        fechaActualizacion: fechaActual,
      });
    } else {
      transaction.set(
        creadorRef,
        {
          uid: idCreador,
          walletBalance: nuevoSaldoCreador,
          saldoMonedas: nuevoSaldoCreador,
          monedas: nuevoSaldoCreador,
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

  // Intentar notificar al creador en segundo plano de manera no bloqueante
  try {
    enviarPushAUsuario(
      idCreador,
      "¡Nueva propina recibida! 🎉",
      `¡Alguien te envió el sticker '${tipoSticker}' y ganaste ${cantidadMonedas} monedas!`,
      {
        tipo: "propina",
        tipoSticker,
        cantidadMonedas: String(cantidadMonedas),
        idOyente,
        transactionId: resultado.recibo.id,
      },
    ).catch((notifError) => {
      console.warn("⚠️ No se pudo enviar notificación push al creador:", notifError);
    });
  } catch (err) {
    console.warn("⚠️ Error al invocar envío de notificación:", err);
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
 * Utiliza transacción atómica e impide el fraude mediante validación anti-replay del adId.
 */
export const reclamarRecompensaAnuncioService = async (datos: RecompensaAnuncioDto) => {
  const { idUsuario, adId, adNetwork } = datos;

  if (!idUsuario || typeof idUsuario !== "string") {
    throw new Error("El ID del usuario es requerido");
  }

  if (!adId || typeof adId !== "string" || adId.trim() === "") {
    throw new Error("El identificador del anuncio (adId) es requerido");
  }

  // Protección anti-replay: verificar si este anuncio ya fue recompensado
  const existingRewardSnap = await db.collection("transactions")
    .where("adId", "==", adId.trim())
    .limit(1)
    .get();

  if (!existingRewardSnap.empty) {
    throw new Error("Esta recompensa de anuncio ya fue reclamada");
  }

  // Establecer recompensa segura de monedas (entre 1 y 50 monedas, default 10)
  const monedasOtorgadas = Math.min(Math.max(Number(datos.cantidadMonedas || 10), 1), 50);

  const userRef = await obtenerDocRefUsuario(idUsuario);

  const resultado = await db.runTransaction(async (transaction: any) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("Usuario no encontrado");
    }

    const userData = userDoc.data() || {};
    const saldoActual = Number(userData.walletBalance ?? 0);
    const nuevoSaldo = saldoActual + monedasOtorgadas;
    const fechaActual = new Date().toISOString();

    const transactionRef = db.collection("transactions").doc();

    const recibo: ReciboTransaccion = {
      id: transactionRef.id,
      idUsuario,
      tipo: "recompensa_anuncio",
      adId: adId.trim(),
      adNetwork: adNetwork || "admob",
      cantidadMonedas: monedasOtorgadas,
      fecha: fechaActual,
      estado: "completado",
      saldoAnteriorOyente: saldoActual,
      nuevoSaldoOyente: nuevoSaldo,
    };

    // Actualizar saldo del usuario
    transaction.update(userRef, {
      walletBalance: nuevoSaldo,
      fechaActualizacion: fechaActual,
    });

    // Guardar recibo en transactions
    transaction.set(transactionRef, recibo);

    return {
      nuevoSaldo,
      monedasOtorgadas,
      recibo,
    };
  });

  console.log(
    `🎬 [Anuncio Recompensado] Usuario ${idUsuario} recibió +${monedasOtorgadas} monedas (adId: ${adId}). Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  return resultado;
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

  // 4. Notificar al usuario por Push FCM
  try {
    enviarPushAUsuario(
      uid,
      "¡Compra acreditada! 🪙",
      `Se han acreditado con éxito ${cantidadMonedas} monedas a tu billetera.`,
      {
        tipo: "compra_monedas",
        cantidadMonedas: String(cantidadMonedas),
        productId,
      },
    ).catch((e) => console.warn("⚠️ Error enviando push de compra de monedas:", e));
  } catch (_e) {
    // Ignorar si falla push
  }

  return resultado;
};
