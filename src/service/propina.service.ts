import { db } from "../config/firebase.ts";
import { EnviarPropinaDto, ReciboTransaccion } from "../models/propina.model.ts";
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
 * Ejecuta la transacción atómica para el envío de propinas entre un oyente y un creador.
 * Garantiza:
 * 1. Verificación indivisible del saldo (walletBalance) del oyente.
 * 2. Resta de monedas al oyente.
 * 3. Suma de monedas al creador.
 * 4. Registro del comprobante en la colección `transactions`.
 */
export const enviarPropinaService = async (datos: EnviarPropinaDto) => {
  const { idOyente, idCreador, cantidadMonedas, tipoSticker } = datos;

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
    const saldoActualOyente = Number(oyenteData.walletBalance ?? 0);

    // Validación de fondos suficientes
    if (isNaN(saldoActualOyente) || saldoActualOyente < cantidadMonedas) {
      throw new Error("Saldo insuficiente");
    }

    const nuevoSaldoOyente = saldoActualOyente - cantidadMonedas;

    const creadorData = creadorDoc.exists ? (creadorDoc.data() || {}) : {};
    const saldoActualCreador = Number(creadorData.walletBalance ?? 0);
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
    `✅ [Propina] Transacción completada exitosamente. Oyente: ${idOyente} (-${cantidadMonedas} monedas, nuevo saldo: ${resultado.nuevoSaldoOyente}), Creador: ${idCreador} (+${cantidadMonedas} monedas)`,
  );

  // Intentar notificar al creador en segundo plano de manera no bloqueante
  try {
    enviarPushAUsuario(
      idCreador,
      "¡Has recibido una propina!",
      `Te han enviado un sticker (${tipoSticker}) con ${cantidadMonedas} monedas.`,
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
