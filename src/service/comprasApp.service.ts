import { db } from "../config/firebase.ts";
import {
  CompraApp,
  CrearCompraAppDto,
  EstadoCompraApp,
  FiltroComprasApp,
} from "../models/comprasApp.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";
import { obtenerDocRefUsuario } from "./propina.service.ts";

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
 * Crea un nuevo registro en la colección 'compras_app' con estado 'pendiente'.
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

  await docRef.set(nuevaCompra);
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
 * - Registra la transacción en 'transactions'
 * - Envía notificación push
 */
export const procesarEntregaMonedasCompraApp = async (
  compraId: string,
  opciones?: {
    monedasManual?: number;
    motivoManual?: string;
  },
): Promise<{ compra: CompraApp; nuevoSaldo: number; cantidadAcreditada: number }> => {
  const compraRef = db.collection("compras_app").doc(compraId);
  const compraSnap = await compraRef.get();

  if (!compraSnap.exists) {
    throw new Error(`No se encontró la compra con ID: ${compraId}`);
  }

  const compraData = compraSnap.data() as CompraApp;

  // Si ya estaba concluida, retornar datos directamente sin doble acreditación
  if (compraData.estado === "concluido") {
    console.log(`ℹ️ [Compras App] La compra ${compraId} ya había sido concluida previamente.`);
    return {
      compra: compraData,
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
  const transactionRef = db.collection("transactions").doc();

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
        id: transactionRef.id,
        idUsuario: uid,
        tipo: "compra_monedas",
        idCompraRevenueCat: compraData.idCompraRevenueCat || null,
        transactionIdStore: compraData.transactionIdStore || null,
        compraAppId: compraId,
        productId: compraData.productId,
        cantidadMonedas: cantidadMonedas,
        fecha: fechaActual,
        estado: "completado",
        saldoAnteriorOyente: isNaN(saldoActual) ? 0 : saldoActual,
        nuevoSaldoOyente: saldoFinal,
        precio: compraData.precio || null,
        moneda: compraData.moneda || "USD",
      };

      // 1. Actualizar usuario
      transaction.update(userRef, {
        "billetera.walletBalance": saldoFinal,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: saldoFinal,
        fechaActualizacion: fechaActual,
      });

      // 2. Registrar en transactions
      transaction.set(transactionRef, recibo);

      // 3. Marcar compra como concluida
      transaction.update(compraRef, {
        estado: "concluido",
        cantidadMonedas: cantidadMonedas,
        saldoAnterior: isNaN(saldoActual) ? 0 : saldoActual,
        nuevoSaldo: saldoFinal,
        fechaConclusion: fechaActual,
        fechaActualizacion: fechaActual,
        motivoProblema: null,
        detalleError: null,
      });

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
    uid,
    motivoReembolso,
  } = params;

  let docCompraSnap: any = null;

  // 1. Localizar la compra en Firestore
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

  const fechaActual = new Date().toISOString();

  // Si no se encontró en compras_app pero tenemos UID, intentamos buscar en transactions
  if (!docCompraSnap) {
    console.warn(
      `⚠️ [Compras App Reembolso] No se encontró registro en 'compras_app' para el evento ${idCompraRevenueCat || transactionIdStore || "N/A"}.`,
    );

    if (uid) {
      const userRef = await obtenerDocRefUsuario(uid);
      const transReembolsoRef = db.collection("transactions").doc();

      await db.runTransaction(async (transaction: any) => {
        const uDoc = await transaction.get(userRef);
        if (!uDoc.exists) return;

        transaction.set(transReembolsoRef, {
          id: transReembolsoRef.id,
          idUsuario: uid,
          tipo: "reembolso_compra",
          idCompraRevenueCat: idCompraRevenueCat || null,
          transactionIdStore: transactionIdStore || null,
          fecha: fechaActual,
          estado: "completado",
          motivo: motivoReembolso || "Reembolso automático de Google Play / Tienda",
        });
      });
    }

    return {
      success: true,
      monedasRevertidas: 0,
      message: "Evento de reembolso registrado en auditoría.",
    };
  }

  const targetCompraId = docCompraSnap.id;
  const compraData = docCompraSnap.data() as CompraApp;

  // Si ya estaba reembolsada, no descontar nuevamente
  if (compraData.reembolsado || compraData.estado === "reembolsado") {
    console.log(`ℹ️ [Compras App] La compra ${targetCompraId} ya estaba marcada como reembolsada.`);
    return {
      success: true,
      compraId: targetCompraId,
      monedasRevertidas: 0,
      nuevoSaldo: compraData.nuevoSaldo,
      message: "La compra ya había sido reembolsada anteriormente.",
    };
  }

  const targetUid = compraData.idUsuario || uid || "";
  const cantidadARevertir = Number(compraData.cantidadMonedas || 0);
  const userRef = await obtenerDocRefUsuario(targetUid);
  const compraRef = docCompraSnap.ref;
  const transReembolsoRef = db.collection("transactions").doc();

  const resultado = await db.runTransaction(async (transaction: any) => {
    const userDoc = await transaction.get(userRef);
    let nuevoSaldo = 0;
    let saldoAnterior = 0;

    if (userDoc.exists) {
      const uData = userDoc.data() || {};
      saldoAnterior = Number(uData.billetera?.walletBalance ?? uData.walletBalance ?? 0);
      // Evitar saldos negativos absurdos si el usuario ya gastó las monedas
      nuevoSaldo = Math.max(0, saldoAnterior - cantidadARevertir);

      transaction.update(userRef, {
        "billetera.walletBalance": nuevoSaldo,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: nuevoSaldo,
        fechaActualizacion: fechaActual,
      });
    }

    // Actualizar documento de compra a 'reembolsado'
    transaction.update(compraRef, {
      estado: "reembolsado",
      reembolsado: true,
      fechaReembolso: fechaActual,
      motivoReembolso: motivoReembolso || "Reembolso procesado en Google Play / RevenueCat",
      fechaActualizacion: fechaActual,
      saldoDescontadoReembolso: cantidadARevertir,
    });

    // Registrar recibo en transactions
    transaction.set(transReembolsoRef, {
      id: transReembolsoRef.id,
      idUsuario: targetUid,
      tipo: "reembolso_compra",
      compraAppId: targetCompraId,
      idCompraRevenueCat: compraData.idCompraRevenueCat || idCompraRevenueCat || null,
      transactionIdStore: compraData.transactionIdStore || transactionIdStore || null,
      productId: compraData.productId,
      cantidadMonedas: cantidadARevertir,
      saldoAnterior,
      nuevoSaldo,
      fecha: fechaActual,
      estado: "completado",
      motivo: motivoReembolso || "Reembolso confirmado de Google Play",
    });

    return { saldoAnterior, nuevoSaldo };
  });

  console.log(
    `💸 [Compras App] Compra ${targetCompraId} REEMBOLSADA. Usuario: ${targetUid} (-${cantidadARevertir} monedas). Nuevo saldo: ${resultado.nuevoSaldo}`,
  );

  // Notificar al usuario sobre el reembolso
  if (targetUid) {
    enviarPushAUsuario(
      targetUid,
      "🔄 Reembolso de Compra",
      `Se ha procesado un reembolso para tu compra de ${compraData.productId}. Se han debitado ${cantidadARevertir} monedas de tu saldo.`,
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
 * Consulta las compras de la app de un usuario específico.
 */
export const obtenerComprasUsuarioService = async (
  idUsuario: string,
): Promise<CompraApp[]> => {
  try {
    const snap = await db.collection("compras_app")
      .where("idUsuario", "==", idUsuario)
      .get();

    const compras: CompraApp[] = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

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
  monedasManual?: number,
): Promise<{ success: boolean; compra: CompraApp; message: string }> => {
  const compra = await obtenerCompraPorIdService(compraId);
  if (!compra) {
    throw new Error(`Compra no encontrada: ${compraId}`);
  }

  if (compra.estado === "concluido") {
    return {
      success: true,
      compra,
      message: "La compra ya se encuentra en estado concluido.",
    };
  }

  const resultado = await procesarEntregaMonedasCompraApp(compraId, {
    monedasManual,
    motivoManual: "Reintento administrativo",
  });

  return {
    success: true,
    compra: resultado.compra,
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
