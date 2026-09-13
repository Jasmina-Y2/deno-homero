import { db } from "../config/firebase.ts";
import {
  CompraApp,
  CrearCompraAppDto,
  EstadoCompraApp,
  FiltroComprasApp,
} from "../models/comprasApp.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";
import { obtenerDocRefUsuario } from "./propina.service.ts";
import { bloquearDispositivoService } from "./deviceAdLimit.service.ts";

/**
 * Catálogo exhaustivo de paquetes de monedas conocidos y mapeo por ID de producto.
 */
const CATALOGO_PAQUETES_MONEDAS: Record<string, number> = {
  // Paquetes directos por ID de tienda
  "coins_50": 50,
  "coins_100": 100,
  "coins_200": 200,
  "coins_300": 300,
  "coins_400": 400,
  "coins_500": 500,
  "coins_1000": 1000,
  "coins_1500": 1500,
  "coins_2000": 2000,
  "coins_2500": 2500,
  "coins_3000": 3000,
  "coins_4000": 4000,
  "coins_5000": 5000,
  "coins_10000": 10000,

  // Variantes con prefijo "homero_"
  "homero_coins_50": 50,
  "homero_coins_100": 100,
  "homero_coins_200": 200,
  "homero_coins_300": 300,
  "homero_coins_400": 400,
  "homero_coins_500": 500,
  "homero_coins_1000": 1000,
  "homero_coins_2500": 2500,
  "homero_coins_5000": 5000,

  // Variantes "monedas_" / "paquete_"
  "monedas_100": 100,
  "monedas_400": 400,
  "monedas_500": 500,
  "monedas_1000": 1000,
  "paquete_100": 100,
  "paquete_400": 400,
  "paquete_400_monedas": 400,
  "paquete_500": 500,
  "paquete_1000": 1000,
  "paquete_2500": 2500,
  "paquete_5000": 5000,
  "paquete_basico": 100,
  "paquete_pro": 500,
  "paquete_master": 1000,
  "paquete_legendario": 2500,

  // Tiers estándar
  "coins_tier_1": 100,
  "coins_tier_2": 400,
  "coins_tier_3": 1000,
  "coins_tier_4": 2500,
  "coins_tier_5": 5000,
};

/**
 * Resuelve la cantidad exacta de monedas a partir del productId y metadatos del evento.
 * Evita el bug de regex donde versiones o identificadores de tier (ej. 'v2', 'tier1')
 * truncaban compras como la de 400 monedas a 1 o 2 monedas.
 */
export const resolverCantidadMonedas = (
  productId: string,
  monedasManual?: number,
): number => {
  if (typeof monedasManual === "number" && monedasManual > 0) {
    return monedasManual;
  }

  if (!productId || typeof productId !== "string") {
    return 100;
  }

  const cleanProductId = productId.toLowerCase().trim();

  // 1. Verificación directa en el catálogo exacto
  if (CATALOGO_PAQUETES_MONEDAS[cleanProductId]) {
    return CATALOGO_PAQUETES_MONEDAS[cleanProductId];
  }

  // 2. Búsqueda por subcadena de catálogo (por si viene con prefijos de bundle/package)
  for (const [key, cantidad] of Object.entries(CATALOGO_PAQUETES_MONEDAS)) {
    if (cleanProductId.includes(key)) {
      return cantidad;
    }
  }

  // 3. Extracción inteligente: buscar explícitamente patrones numéricos que indiquen monedas
  // Ej: coins400, 400coins, monedas400, pack_400, 400_monedas
  const patronEspecifico = /(?:coins|monedas|pack|paquete)[_\s-]*(\d{2,6})|(\d{2,6})[_\s-]*(?:coins|monedas|pack|paquete)/i;
  const matchEspecifico = cleanProductId.match(patronEspecifico);
  if (matchEspecifico) {
    const numStr = matchEspecifico[1] || matchEspecifico[2];
    const val = parseInt(numStr, 10);
    if (!isNaN(val) && val > 0) {
      return val;
    }
  }

  // 4. Si hay múltiples números en el string (ej. 'homero_v2_tier2_400_coins'):
  // Extraer todos los bloques de dígitos y priorizar aquellos >= 10
  const todosNumeros = cleanProductId.match(/\d+/g);
  if (todosNumeros && todosNumeros.length > 0) {
    const candidatos = todosNumeros
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n) && n >= 10);

    if (candidatos.length > 0) {
      // Tomar el número representativo más relevante (ej. 400 sobre 2)
      return Math.max(...candidatos);
    }
  }

  console.warn(
    `⚠️ [Compras App] No se pudo determinar con precisión la cantidad de monedas para productId: '${productId}'. Se asignará fallback de 100 monedas.`,
  );
  return 100;
};

/**
 * Crea un nuevo registro en la colección 'compras_app' y 'transactions' con estado 'pendiente'.
 * Si el evento ya existía por idCompraRevenueCat o transactionIdStore, retorna el existente.
 */
export const crearRegistroCompraApp = async (
  datos: CrearCompraAppDto,
): Promise<{ compra: CompraApp; esNuevo: boolean }> => {
  const {
    idUsuario,
    productId,
    idCompraRevenueCat,
    transactionIdStore,
    originalTransactionId,
  } = datos;

  if (!idUsuario) {
    throw new Error("El ID del usuario es requerido para registrar la compra de la app");
  }

  // 1. Verificar si ya existe registro previo para evitar duplicados (Idempotencia)
  if (idCompraRevenueCat) {
    const existingSnap = await db.collection("compras_app")
      .where("idCompraRevenueCat", "==", idCompraRevenueCat)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return {
        compra: { id: doc.id, ...doc.data() } as CompraApp,
        esNuevo: false,
      };
    }
  }

  if (transactionIdStore) {
    const existingSnap = await db.collection("compras_app")
      .where("transactionIdStore", "==", transactionIdStore)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return {
        compra: { id: doc.id, ...doc.data() } as CompraApp,
        esNuevo: false,
      };
    }
  }

  const cleanUid = idUsuario.trim();
  const fechaActual = new Date().toISOString();
  const docRef = db.collection("compras_app").doc();

  const cantidadMonedas = datos.cantidadMonedas !== undefined
    ? datos.cantidadMonedas
    : resolverCantidadMonedas(productId);

  const nuevaCompra: CompraApp = {
    id: docRef.id,
    idUsuario: cleanUid,
    idCompraRevenueCat: idCompraRevenueCat || null,
    transactionIdStore: transactionIdStore || null,
    originalTransactionId: originalTransactionId || null,
    store: (datos.store as any) || "PLAY_STORE",
    entorno: datos.entorno || "PRODUCTION",
    productId: productId || "paquete_monedas",
    tipoItem: datos.tipoItem || "monedas",
    cantidadMonedas,
    precio: datos.precio !== undefined ? datos.precio : null,
    moneda: datos.moneda || "USD",
    estado: "pendiente",
    motivoProblema: null,
    detalleError: null,
    reembolsado: false,
    fechaReembolso: null,
    motivoReembolso: null,
    fechaCreacion: fechaActual,
    fechaActualizacion: fechaActual,
    fechaConclusion: null,
    rawEvent: datos.rawEvent || null,
  };

  // 1. Guardar en 'compras_app'
  await docRef.set(nuevaCompra);

  // 2. Guardar en 'transactions' con estado 'pendiente' para que el usuario lo vea de inmediato en el Historial
  const descripcionPendiente = nuevaCompra.tipoItem === "suscripcion"
    ? `Suscripción (${productId}) - Pendiente de confirmación en Google Play ⏳`
    : `Compra de paquete de monedas (+${cantidadMonedas} monedas - Pendiente en Google Play ⏳)`;

  await db.collection("transactions").doc(docRef.id).set({
    id: docRef.id,
    idUsuario: cleanUid,
    tipo: "compra_monedas",
    compraAppId: docRef.id,
    idCompraRevenueCat: idCompraRevenueCat || null,
    transactionIdStore: transactionIdStore || null,
    productId: productId || "paquete_monedas",
    cantidadMonedas,
    fecha: fechaActual,
    estado: "pendiente",
    precio: datos.precio !== undefined ? datos.precio : null,
    moneda: datos.moneda || "USD",
    descripcion: descripcionPendiente,
  }, { merge: true });

  console.log(
    `📝 [Compras App] Registro creado [PENDIENTE]: ${docRef.id} | UID: ${cleanUid} | Producto: ${productId} | Monedas: ${cantidadMonedas}`,
  );

  return { compra: nuevaCompra, esNuevo: true };
};

/**
 * Procesa la entrega atómica de monedas para una compra de la app.
 * - Verifica usuario
 * - Suma monedas a su billetera
 * - Actualiza el estado de la compra a 'concluido'
 * - Actualiza/Registra la transacción en 'transactions'
 * - Envía notificación push
 */
export const procesarEntregaMonedasCompraApp = async (
  compraId: string,
  opciones?: {
    monedasManual?: number;
    motivoManual?: string;
    transactionIdStore?: string | null;
    idCompraRevenueCat?: string | null;
  },
): Promise<{ compra: CompraApp; nuevoSaldo: number; cantidadAcreditada: number }> => {
  const compraRef = db.collection("compras_app").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    throw new Error(`No se encontró la compra con ID: ${compraId}`);
  }

  const compraData = compraSnap.data() as CompraApp;
  const finalTransactionIdStore = opciones?.transactionIdStore || compraData.transactionIdStore || null;
  const finalIdCompraRevenueCat = opciones?.idCompraRevenueCat || compraData.idCompraRevenueCat || null;

  // Si ya estaba concluida, actualizar transactionIdStore si llegó nuevo y retornar
  if (compraData.estado === "concluido") {
    if ((!compraData.transactionIdStore && finalTransactionIdStore) || (!compraData.idCompraRevenueCat && finalIdCompraRevenueCat)) {
      const actualizacion: Record<string, any> = {};
      if (finalTransactionIdStore) actualizacion.transactionIdStore = finalTransactionIdStore;
      if (finalIdCompraRevenueCat) actualizacion.idCompraRevenueCat = finalIdCompraRevenueCat;
      await compraRef.set(actualizacion, { merge: true });
      await db.collection("transactions").doc(compraId).set(actualizacion, { merge: true });
    }
    console.log(`ℹ️ [Compras App] La compra ${compraId} ya había sido concluida previamente.`);
    return {
      compra: { ...compraData, transactionIdStore: finalTransactionIdStore, idCompraRevenueCat: finalIdCompraRevenueCat },
      nuevoSaldo: compraData.nuevoSaldo || 0,
      cantidadAcreditada: compraData.cantidadMonedas || 0,
    };
  }

  const uid = compraData.idUsuario;
  const userRef = await obtenerDocRefUsuario(uid);

  const cantidadMonedas = opciones?.monedasManual !== undefined
    ? opciones.monedasManual
    : (compraData.cantidadMonedas || resolverCantidadMonedas(compraData.productId));

  const fechaActual = new Date().toISOString();
  const transactionRef = db.collection("transactions").doc(compraId);

  try {
    const resultado = await db.runTransaction(async (transaction: any) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error(`Usuario con UID '${uid}' no encontrado en Firestore`);
      }

      const userData = userDoc.data() || {};
      const rawSaldo = userData.billetera?.walletBalance ?? userData.walletBalance ?? 0;
      const saldoActual = Number(rawSaldo);
      const saldoFinal = (isNaN(saldoActual) ? 0 : saldoActual) + cantidadMonedas;

      const recibo = {
        id: compraId,
        idUsuario: uid,
        tipo: "compra_monedas",
        idCompraRevenueCat: finalIdCompraRevenueCat,
        transactionIdStore: finalTransactionIdStore,
        compraAppId: compraId,
        productId: compraData.productId,
        cantidadMonedas: cantidadMonedas,
        fecha: fechaActual,
        estado: "completado",
        saldoAnteriorOyente: isNaN(saldoActual) ? 0 : saldoActual,
        nuevoSaldoOyente: saldoFinal,
        precio: compraData.precio || null,
        moneda: compraData.moneda || "USD",
        descripcion: `Compras en la aplicación (+${cantidadMonedas} monedas 🪙)`,
      };

      // 1. Actualizar usuario
      transaction.update(userRef, {
        "billetera.walletBalance": saldoFinal,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: saldoFinal,
        fechaActualizacion: fechaActual,
      });

      // 2. Registrar/actualizar en transactions con estado 'completado'
      transaction.set(transactionRef, recibo, { merge: true });

      // 3. Marcar compra como concluida en compras_app
      const updateDataCompra: Record<string, any> = {
        estado: "concluido",
        cantidadMonedas: cantidadMonedas,
        saldoAnterior: isNaN(saldoActual) ? 0 : saldoActual,
        nuevoSaldo: saldoFinal,
        fechaConclusion: fechaActual,
        fechaActualizacion: fechaActual,
        motivoProblema: null,
        detalleError: null,
      };
      if (finalTransactionIdStore) {
        updateDataCompra.transactionIdStore = finalTransactionIdStore;
      }
      if (finalIdCompraRevenueCat) {
        updateDataCompra.idCompraRevenueCat = finalIdCompraRevenueCat;
      }
      transaction.update(compraRef, updateDataCompra);

      return {
        saldoAnterior: isNaN(saldoActual) ? 0 : saldoActual,
        nuevoSaldo: saldoFinal,
        recibo,
      };
    });

    const compraActualizada: CompraApp = {
      ...compraData,
      estado: "concluido",
      cantidadMonedas,
      saldoAnterior: resultado.saldoAnterior,
      nuevoSaldo: resultado.nuevoSaldo,
      fechaConclusion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    console.log(
      `✅ [Compras App] Compra ${compraId} CONCLUIDA. Usuario ${uid}: +${cantidadMonedas} monedas (Nuevo saldo: ${resultado.nuevoSaldo})`,
    );

    // Enviar notificación Push confirmando la entrega
    enviarPushAUsuario(
      uid,
      "🪙 ¡Monedas acreditadas!",
      `Se han acreditado con éxito ${cantidadMonedas.toLocaleString()} monedas a tu cuenta.`,
      {
        tipo: "compra_monedas",
        compraId,
        cantidadMonedas: String(cantidadMonedas),
        productId: compraData.productId,
      },
    ).catch((err) => {
      console.warn("⚠️ [Compras App] Error al enviar push de compra:", err);
    });

    return {
      compra: compraActualizada,
      nuevoSaldo: resultado.nuevoSaldo,
      cantidadAcreditada: cantidadMonedas,
    };
  } catch (error: any) {
    const errorMsg = error?.message || "Error desconocido al procesar entrega de monedas";
    console.error(`❌ [Compras App] Error en entrega de monedas para compra ${compraId}:`, errorMsg);

    // Marcar compra como 'problema' para auditoría
    await marcarProblemaCompraApp(compraId, "Error al acreditar saldo al usuario", errorMsg);
    throw error;
  }
};

/**
 * Marca una compra con estado 'rechazado' (ej: rechazo de banco o tarjeta en Google Play).
 */
export const marcarRechazoCompraApp = async (
  compraId: string,
  motivo: string,
  detalleError?: string,
): Promise<void> => {
  try {
    const fechaActual = new Date().toISOString();
    await db.collection("compras_app").doc(compraId).update({
      estado: "rechazado",
      motivoProblema: motivo,
      detalleError: detalleError || null,
      fechaActualizacion: fechaActual,
    });

    await db.collection("transactions").doc(compraId).set({
      estado: "rechazado",
      motivoProblema: motivo,
      descripcion: `Compra rechazada por Google Play (${motivo} ❌)`,
      fechaActualizacion: fechaActual,
    }, { merge: true });

    console.warn(`❌ [Compras App] Compra ${compraId} marcada como RECHAZADA: ${motivo}`);
  } catch (err) {
    console.error("Error al actualizar estado a rechazado en compras_app:", err);
  }
};

/**
 * Marca una compra con estado 'cancelado' (ej: expiración de pago en efectivo o cancelación voluntaria).
 */
export const marcarCanceladoCompraApp = async (
  compraId: string,
  motivo: string,
): Promise<void> => {
  try {
    const fechaActual = new Date().toISOString();
    await db.collection("compras_app").doc(compraId).update({
      estado: "cancelado",
      motivoProblema: motivo,
      fechaActualizacion: fechaActual,
    });

    await db.collection("transactions").doc(compraId).set({
      estado: "cancelado",
      motivoProblema: motivo,
      descripcion: `Compra cancelada en Google Play (${motivo} 🚫)`,
      fechaActualizacion: fechaActual,
    }, { merge: true });

    console.warn(`🚫 [Compras App] Compra ${compraId} marcada como CANCELADA: ${motivo}`);
  } catch (err) {
    console.error("Error al actualizar estado a cancelado en compras_app:", err);
  }
};

/**
 * Marca una compra con estado 'problema' e inserta el detalle del fallo.
 */
export const marcarProblemaCompraApp = async (
  compraId: string,
  motivo: string,
  detalleError?: string,
): Promise<void> => {
  try {
    const fechaActual = new Date().toISOString();
    await db.collection("compras_app").doc(compraId).update({
      estado: "problema",
      motivoProblema: motivo,
      detalleError: detalleError || null,
      fechaActualizacion: fechaActual,
    });

    await db.collection("transactions").doc(compraId).set({
      estado: "problema",
      motivoProblema: motivo,
      descripcion: `Problema en compra de monedas (${motivo} ⚠️)`,
      fechaActualizacion: fechaActual,
    }, { merge: true });

    console.warn(`⚠️ [Compras App] Compra ${compraId} marcada como PROBLEMA: ${motivo}`);
  } catch (err) {
    console.error("Error al actualizar estado a problema en compras_app:", err);
  }
};

/**
 * Procesa un reembolso originado en Google Play / App Store (REVOCATION / REFUND).
 * - Busca la compra asociada por ID de evento o ID de transacción de tienda
 * - Ajusta el saldo de monedas de forma segura (sin dejar números negativos ilógicos)
 * - Actualiza el estado de la compra a 'reembolsado'
 * - Registra la transacción 'reembolso_compra'
 * - Envía push informativo al usuario
 */
export const procesarReembolsoCompraApp = async (params: {
  idCompraRevenueCat?: string;
  transactionIdStore?: string;
  originalTransactionId?: string;
  compraId?: string;
  productId?: string;
  cantidadMonedas?: number;
  uid?: string;
  motivoReembolso?: string;
  rawEvent?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  compraId?: string;
  monedasRevertidas: number;
  nuevoSaldo?: number;
  message: string;
}> => {
  const {
    idCompraRevenueCat,
    transactionIdStore,
    originalTransactionId,
    compraId,
    productId,
    uid,
    motivoReembolso,
  } = params;

  let docCompraSnap: any = null;

  // 1. Localizar la compra en Firestore por IDs exactos
  if (compraId) {
    const snap = await db.collection("compras_app").doc(compraId).get();
    if (snap.exists) docCompraSnap = snap;
  }

  if (!docCompraSnap && idCompraRevenueCat) {
    const snap = await db.collection("compras_app")
      .where("idCompraRevenueCat", "==", idCompraRevenueCat)
      .limit(1)
      .get();
    if (!snap.empty) docCompraSnap = snap.docs[0];
  }

  if (!docCompraSnap && transactionIdStore) {
    const snap = await db.collection("compras_app")
      .where("transactionIdStore", "==", transactionIdStore)
      .limit(1)
      .get();
    if (!snap.empty) docCompraSnap = snap.docs[0];
  }

  if (!docCompraSnap && originalTransactionId) {
    const snap = await db.collection("compras_app")
      .where("originalTransactionId", "==", originalTransactionId)
      .limit(1)
      .get();
    if (!snap.empty) docCompraSnap = snap.docs[0];
  }

  // Si no se encontró por ID exacto, buscar compras recientes del usuario que no estén ya reembolsadas
  if (!docCompraSnap && uid) {
    try {
      const snapUsuario = await db.collection("compras_app")
        .where("idUsuario", "==", uid)
        .get();

      if (!snapUsuario.empty) {
        // Filtrar las compras que no hayan sido reembolsadas aún
        const candidatas = snapUsuario.docs.filter((d: any) => {
          const dat = d.data();
          return !dat.reembolsado && dat.estado !== "reembolsado";
        });

        const pool = candidatas.length > 0 ? candidatas : snapUsuario.docs;
        const matchProduct = productId
          ? pool.find((d: any) => d.data().productId === productId)
          : null;
        docCompraSnap = matchProduct || pool[pool.length - 1];
      }
    } catch (_errSearch) {}
  }

  const fechaActual = new Date().toISOString();
  const rawEv = params.rawEvent as Record<string, any> | undefined;
  const prodIdFallback = productId || rawEv?.product_id || (docCompraSnap ? docCompraSnap.data()?.productId : "coins_200");
  const cantidadARevertir = params.cantidadMonedas ||
    (docCompraSnap ? Number(docCompraSnap.data()?.cantidadMonedas || 0) : 0) ||
    resolverCantidadMonedas(prodIdFallback);

  const targetUid = (docCompraSnap ? docCompraSnap.data()?.idUsuario : null) || uid || "";

  if (!targetUid) {
    console.warn("⚠️ [Compras App Reembolso] No se pudo determinar el UID para aplicar el reembolso.");
    return {
      success: false,
      monedasRevertidas: 0,
      message: "No se encontró usuario asociado al reembolso.",
    };
  }

  const targetCompraId = docCompraSnap ? docCompraSnap.id : (idCompraRevenueCat || transactionIdStore || `reembolso_${Date.now()}`);
  const userRef = await obtenerDocRefUsuario(targetUid);
  const transReembolsoRef = db.collection("transactions").doc();

  // 2. Ejecutar descuento atómico de monedas y marcado de auditoría
  const resultado = await db.runTransaction(async (transaction: any) => {
    const userDoc = await transaction.get(userRef);
    let nuevoSaldo = 0;
    let saldoAnterior = 0;

    if (userDoc.exists) {
      const uData = userDoc.data() || {};
      saldoAnterior = Number(uData.billetera?.walletBalance ?? uData.walletBalance ?? 0);
      // Descontar las monedas de la compra reembolsada sin dejar saldos negativos ilógicos
      nuevoSaldo = Math.max(0, (isNaN(saldoAnterior) ? 0 : saldoAnterior) - cantidadARevertir);

      transaction.update(userRef, {
        "billetera.walletBalance": nuevoSaldo,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: nuevoSaldo,
        fechaActualizacion: fechaActual,
      });
    }

    // Si encontramos el documento en compras_app, actualizarlo a 'reembolsado'
    if (docCompraSnap) {
      transaction.update(docCompraSnap.ref, {
        estado: "reembolsado",
        reembolsado: true,
        fechaReembolso: fechaActual,
        motivoReembolso: motivoReembolso || "Reembolso procesado en Google Play / RevenueCat",
        fechaActualizacion: fechaActual,
        saldoDescontadoReembolso: cantidadARevertir,
      });

      // También actualizar el recibo espejo en transactions
      const transMirrorRef = db.collection("transactions").doc(docCompraSnap.id);
      transaction.set(transMirrorRef, {
        estado: "reembolsado",
        motivo: motivoReembolso || "Reembolso procesado en Google Play",
        descripcion: `Compra Reembolsada en Google Play (-${cantidadARevertir} monedas 🔄)`,
        fechaActualizacion: fechaActual,
      }, { merge: true });
    }

    // Registrar recibo explícito de auditoría 'reembolso_compra'
    transaction.set(transReembolsoRef, {
      id: transReembolsoRef.id,
      idUsuario: targetUid,
      tipo: "reembolso_compra",
      compraAppId: targetCompraId,
      idCompraRevenueCat: idCompraRevenueCat || null,
      transactionIdStore: transactionIdStore || null,
      productId: prodIdFallback,
      cantidadMonedas: cantidadARevertir,
      saldoAnterior,
      nuevoSaldo,
      fecha: fechaActual,
      estado: "completado",
      motivo: motivoReembolso || "Devolución de cargo / Reembolso confirmado de Google Play",
      descripcion: `Reembolso de compra de monedas (-${cantidadARevertir} monedas 🔄)`,
    });

    return { saldoAnterior, nuevoSaldo };
  });

  // 3. Buscar y actualizar compras anteriores en 'transactions' creadas desde el cliente
  try {
    const transPrevSnap = await db.collection("transactions")
      .where("idUsuario", "==", targetUid)
      .where("tipo", "==", "compra_monedas")
      .get();

    if (!transPrevSnap.empty) {
      const transNoReembolsadas = transPrevSnap.docs.filter(
        (d: any) => d.data().estado !== "reembolsado"
      );
      const targetDoc = transNoReembolsadas.length > 0
        ? transNoReembolsadas[transNoReembolsadas.length - 1]
        : transPrevSnap.docs[transPrevSnap.docs.length - 1];

      await targetDoc.ref.set({
        estado: "reembolsado",
        descripcion: `Compra Reembolsada en Google Play (-${cantidadARevertir} monedas 🔄)`,
        fechaActualizacion: fechaActual,
      }, { merge: true });
    }
  } catch (_eTransUpdate) {}

  // 4. CASCADE ANTI-FRAUDE: Si el usuario gastó monedas donando a otros creadores,
  // banear al usuario, bloquear su DISPOSITIVO físico por 15 días y anular TODAS las propinas/donaciones enviadas por él.
  try {
    const uDocSnap = await userRef.get();
    const uDocData = uDocSnap.exists ? uDocSnap.data() : {};
    const deviceIdUsuario = uDocData.sistema?.ultimoDeviceId || uDocData.ultimoDeviceId;
    const fechaLimite15Dias = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    // Mantener la cuenta ACTIVA con periodo de gracia de 15 días para regularizar pago
    await userRef.update({
      "sistema.activo": true,
      "sistema.baneado": false,
      "sistema.enPeriodoGracia": true,
      "sistema.motivoDeuda": `Reembolso de ${cantidadARevertir} monedas pendiente de regularizar en Google Play`,
      "sistema.fechaInicioGracia": fechaActual,
      "sistema.dispositivoBloqueado": true,
      "sistema.fechaLimitePago": fechaLimite15Dias,
      "sistema.deudaMonedas": cantidadARevertir,
      "sistema.fechaActualizacion": fechaActual,
    });
    console.warn(`⏳ [Anti-Fraude] Usuario ${targetUid} en PERIODO DE GRACIA (15 días) por reembolso de Google Play. Cuenta permanece ACTIVA. Plazo límite: ${fechaLimite15Dias}`);

    // Bloquear el dispositivo físico (Hardware ID) por 15 días en la colección 'dispositivos_bloqueados'
    if (deviceIdUsuario) {
      await bloquearDispositivoService({
        deviceId: deviceIdUsuario,
        uid: targetUid,
        deudaMonedas: cantidadARevertir,
        motivo: `Dispositivo bloqueado por reembolso no autorizado de ${cantidadARevertir} monedas. Plazo de 15 días para regularizar pago.`,
      });
    }

    // Buscar todas las donaciones/propinas enviadas por este usuario
    const propinasSnap = await db.collection("transactions")
      .where("idOyente", "==", targetUid)
      .where("tipo", "==", "propina")
      .where("estado", "==", "completado")
      .get();

    for (const docPropina of propinasSnap.docs) {
      const pData = docPropina.data();
      const creadorId = pData.idCreador;
      const montoDonado = Number(pData.cantidadMonedas || 0);

      // Marcar la transacción como anulada
      await docPropina.ref.set({
        estado: "anulado",
        motivo: "Donación anulada por baneo del emisor (Reembolso de compra fraudulento)",
        descripcion: `🚫 Donación Anulada (-${montoDonado} monedas por emisor baneado)`,
        fechaAnulacion: fechaActual,
        fechaActualizacion: fechaActual,
      }, { merge: true });

      // Descontar las monedas fraudulentas de la billetera del creador para proteger retiros reales
      if (creadorId && montoDonado > 0) {
        try {
          const creadorRef = await obtenerDocRefUsuario(creadorId);
          await db.runTransaction(async (t: any) => {
            const cDoc = await t.get(creadorRef);
            if (!cDoc.exists) return;
            const cData = cDoc.data() || {};
            const saldoActualCreador = Number(cData.billetera?.walletBalance ?? cData.walletBalance ?? 0);
            const nuevoSaldoCreador = Math.max(0, (isNaN(saldoActualCreador) ? 0 : saldoActualCreador) - montoDonado);

            t.update(creadorRef, {
              "billetera.walletBalance": nuevoSaldoCreador,
              walletBalance: nuevoSaldoCreador,
              "sistema.fechaActualizacion": fechaActual,
            });
          });

          // Notificar al creador del ajuste de seguridad
          enviarPushAUsuario(
            creadorId,
            "⚠️ Donación Anulada",
            `Se han descontado ${montoDonado} monedas recibidas de un usuario que fue suspendido por reembolso fraudulento en Google Play.`,
            { tipo: "donacion_anulada", cantidadMonedas: String(montoDonado) },
          ).catch(() => {});
        } catch (errCr) {
          console.error(`Error al revertir donación al creador ${creadorId}:`, errCr);
        }
      }
    }
  } catch (errCascade) {
    console.error("Error en cascada anti-fraude de donaciones:", errCascade);
  }

  console.log(
    `💸 [Compras App] Compra ${targetCompraId} REEMBOLSADA. Usuario: ${targetUid} (-${cantidadARevertir} monedas). Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  // Notificar al usuario sobre el reembolso
  if (targetUid) {
    enviarPushAUsuario(
      targetUid,
      "🔄 Reembolso de Compra",
      `Se ha procesado un reembolso para tu compra de ${prodIdFallback}. Se han debitado ${cantidadARevertir} monedas de tu saldo.`,
      {
        tipo: "reembolso_compra",
        compraId: targetCompraId,
        cantidadMonedas: String(cantidadARevertir),
      },
    ).catch(() => {});
  }

  return {
    success: true,
    compraId: targetCompraId,
    monedasRevertidas: cantidadARevertir,
    nuevoSaldo: resultado.nuevoSaldo,
    message: "Reembolso procesado y saldo actualizado exitosamente.",
  };
};

/**
 * Auto-expira compras que llevan más de 15 minutos en estado 'pendiente' sin confirmarse.
 * Las marca automáticamente como 'error' para no dejarlas colgadas indefinidamente.
 */
export const autoExpirarComprasPendientesAntiguas = async (
  compras: any[],
): Promise<any[]> => {
  const limiteMinutos = 15;
  const limiteMs = limiteMinutos * 60 * 1000;
  const ahora = Date.now();
  const fechaActual = new Date().toISOString();

  const tareasActualizacion: Promise<any>[] = [];

  for (const compra of compras) {
    const est = String(compra.estado || "").toLowerCase().trim();
    if (est === "pendiente" || est === "iniciado") {
      const fechaCreacionMs = new Date(compra.fechaCreacion || compra.fecha || 0).getTime();
      if (fechaCreacionMs > 0 && ahora - fechaCreacionMs > limiteMs) {
        // Actualizar en memoria
        compra.estado = "error";
        compra.motivoProblema = "Pago no completado a tiempo en Google Play (Expirado ⏱️)";
        compra.detalleError = `Expirado tras más de ${limiteMinutos} minutos sin confirmación de pago`;
        compra.error = "No se completó el pago en Google Play (Expirado ⏱️)";
        compra.descripcion = `Compra no completada en Google Play (Expirada ⏱️)`;

        const idDoc = compra.id || compra._id || compra.transaccionId;
        if (idDoc) {
          tareasActualizacion.push(
            db.collection("compras_app").doc(idDoc).set({
              estado: "error",
              motivoProblema: "Pago no completado a tiempo en Google Play (Expirado ⏱️)",
              detalleError: `Expirado tras más de ${limiteMinutos} minutos sin confirmación`,
              fechaActualizacion: fechaActual,
            }, { merge: true }).catch(() => {})
          );

          tareasActualizacion.push(
            db.collection("transactions").doc(idDoc).set({
              estado: "error",
              motivoProblema: "Pago no completado a tiempo en Google Play (Expirado ⏱️)",
              error: "No se completó el pago en Google Play (Expirado ⏱️)",
              descripcion: `Compra no completada en Google Play (Expirada ⏱️)`,
              fechaActualizacion: fechaActual,
            }, { merge: true }).catch(() => {})
          );
        }
      }
    }
  }

  if (tareasActualizacion.length > 0) {
    Promise.all(tareasActualizacion).catch(() => {});
  }

  return compras;
};

/**
 * Consulta las compras de la app de un usuario específico.
 */
export const obtenerComprasUsuarioService = async (
  idUsuario: string,
): Promise<CompraApp[]> => {
  try {
    const snap = await db.collection("compras_app")
      .where("idUsuario", "==", idUsuario)
      .get();

    let compras: CompraApp[] = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Auto-expirar compras pendientes de más de 15 minutos
    compras = await autoExpirarComprasPendientesAntiguas(compras);

    compras.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
    return compras;
  } catch (error) {
    console.error("❌ Error en obtenerComprasUsuarioService:", error);
    throw new Error("Error al consultar las compras del usuario");
  }
};

/**
 * Consulta todas las compras de la app con filtros opcionales (para panel admin y auditoría).
 */
export const obtenerTodasComprasService = async (
  filtros: FiltroComprasApp = {},
): Promise<CompraApp[]> => {
  try {
    let query: any = db.collection("compras_app");

    if (filtros.idUsuario && filtros.idUsuario.trim() !== "") {
      query = query.where("idUsuario", "==", filtros.idUsuario.trim());
    }

    if (filtros.estado && filtros.estado.trim() !== "") {
      query = query.where("estado", "==", filtros.estado.trim());
    }

    if (filtros.tipoItem && filtros.tipoItem.trim() !== "") {
      query = query.where("tipoItem", "==", filtros.tipoItem.trim());
    }

    const snap = await query.get();
    let compras: CompraApp[] = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (filtros.desdeFecha) {
      compras = compras.filter((c) => c.fechaCreacion >= filtros.desdeFecha!);
    }
    if (filtros.hastaFecha) {
      compras = compras.filter((c) => c.fechaCreacion <= filtros.hastaFecha!);
    }

    compras.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

    if (filtros.limite && filtros.limite > 0) {
      compras = compras.slice(0, filtros.limite);
    }

    return compras;
  } catch (error) {
    console.error("❌ Error en obtenerTodasComprasService:", error);
    throw new Error("Error al consultar la lista general de compras");
  }
};

/**
 * Consulta el detalle de una compra específica por su ID.
 */
export const obtenerCompraPorIdService = async (
  compraId: string,
): Promise<CompraApp | null> => {
  try {
    const snap = await db.collection("compras_app").doc(compraId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as CompraApp;
  } catch (error) {
    console.error("❌ Error en obtenerCompraPorIdService:", error);
    throw new Error("Error al consultar el detalle de la compra");
  }
};

/**
 * Reintenta la entrega de monedas para una compra que quedó en estado 'problema' o 'pendiente'.
 */
export const reintentarCompraProblemaService = async (
  compraId: string,
  opciones?: {
    monedasManual?: number;
    transactionIdStore?: string | null;
    idCompraRevenueCat?: string | null;
    motivoManual?: string;
  } | number,
): Promise<{ success: boolean; compra: CompraApp; nuevoSaldo?: number; message: string }> => {
  const compra = await obtenerCompraPorIdService(compraId);
  if (!compra) {
    throw new Error(`Compra no encontrada: ${compraId}`);
  }

  const opts = typeof opciones === "number" ? { monedasManual: opciones } : (opciones || {});

  if (compra.estado === "concluido") {
    // Si la compra ya estaba concluida pero viene con transactionIdStore que faltaba, actualizarlo
    if (opts.transactionIdStore || opts.idCompraRevenueCat) {
      await procesarEntregaMonedasCompraApp(compraId, opts);
    }
    return {
      success: true,
      compra: {
        ...compra,
        transactionIdStore: opts.transactionIdStore || compra.transactionIdStore || null,
        idCompraRevenueCat: opts.idCompraRevenueCat || compra.idCompraRevenueCat || null,
      },
      nuevoSaldo: compra.nuevoSaldo || 0,
      message: "La compra ya se encuentra en estado concluido.",
    };
  }

  const resultado = await procesarEntregaMonedasCompraApp(compraId, {
    monedasManual: opts.monedasManual,
    transactionIdStore: opts.transactionIdStore,
    idCompraRevenueCat: opts.idCompraRevenueCat,
    motivoManual: opts.motivoManual || "Reintento administrativo",
  });

  return {
    success: true,
    compra: resultado.compra,
    nuevoSaldo: resultado.nuevoSaldo,
    message: `Compra ${compraId} acreditada exitosamente tras reintento.`,
  };
};

/**
 * Actualiza administrativamente el estado de una compra.
 */
export const actualizarEstadoCompraService = async (
  compraId: string,
  nuevoEstado: EstadoCompraApp,
  motivo?: string,
): Promise<CompraApp> => {
  const docRef = db.collection("compras_app").doc(compraId);
  const snap = await docRef.get();

  if (!snap.exists) {
    throw new Error(`Compra no encontrada con ID: ${compraId}`);
  }

  const fechaActual = new Date().toISOString();
  const updateData: Record<string, any> = {
    estado: nuevoEstado,
    fechaActualizacion: fechaActual,
  };

  if (motivo) {
    updateData.motivoProblema = motivo;
  }

  await docRef.update(updateData);
  const updatedSnap = await docRef.get();
  return { id: updatedSnap.id, ...updatedSnap.data() } as CompraApp;
};
