import { db } from "../config/firebase.ts";
import {
  EstadoPago,
  Pago,
  ReciboTransaccionPago,
  ResultadoSolicitudRetiro,
  SolicitarRetiroDto,
} from "../models/pago.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";
import { enviarAlertaTelegram } from "./soporte.service.ts";
import { obtenerDocRefUsuario } from "./propina.service.ts";

/**
 * ID por defecto de Homero para recibir las monedas retenidas durante la solicitud de retiro.
 */
export const ID_HOMERO_DEFAULT = "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1";

/**
 * Helper para obtener información pública básica del usuario (nombre, fotoURL, email).
 */
const obtenerInfoUsuario = async (uid: string) => {
  try {
    const docRef = await obtenerDocRefUsuario(uid);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const d = docSnap.data() || {};
      return {
        uid,
        nombre: d.perfil?.name || d.name || d.nombre || d.displayName || "Usuario",
        photoURL: d.perfil?.photoURL || d.photoURL || d.foto || "",
        email: d.perfil?.email || d.email || d.correo || "",
        telefono: d.phoneNumber || d.telefono || "",
        descripcion: d.perfil?.descripcion || d.descripcion || "",
      };
    }
  } catch (_e) {
    // Si falla la lectura, fallback con datos mínimos
  }
  return {
    uid,
    nombre: "Usuario",
    photoURL: "",
    email: "",
    telefono: "",
    descripcion: "",
  };
};

/**
 * Servicio para procesar la solicitud de retiro de dinero enviando monedas a Homero.
 * - Descuenta el saldo del usuario solicitante
 * - Acredita el saldo a Homero ("7cBW5g7xYGbh7Fh2zTCHvNBdGHx1")
 * - Genera una transacción en la colección 'transactions'
 * - Crea un nuevo registro en la colección 'pagos'
 * - Envía notificaciones Push y Telegram
 */
export const solicitarRetiroService = async (
  datos: SolicitarRetiroDto,
): Promise<ResultadoSolicitudRetiro> => {
  const {
    idUsuario,
    cantidadMonedas,
  } = datos;

  const idDestino = (datos.idDestino && typeof datos.idDestino === "string" && datos.idDestino.trim() !== "")
    ? datos.idDestino.trim()
    : ID_HOMERO_DEFAULT;

  if (!idUsuario || typeof idUsuario !== "string" || idUsuario.trim() === "") {
    throw new Error("El ID del usuario es requerido");
  }

  if (isNaN(cantidadMonedas) || cantidadMonedas <= 0) {
    throw new Error("La cantidad de monedas debe ser mayor a 0");
  }

  if (idUsuario.trim() === idDestino) {
    throw new Error("No puedes solicitar retiro enviando dinero a tu propia cuenta");
  }

  const cleanUid = idUsuario.trim();
  const infoUsuario = await obtenerInfoUsuario(cleanUid);

  // 1. Obtener referencias de Firestore
  const usuarioRef = await obtenerDocRefUsuario(cleanUid);
  const homeroRef = await obtenerDocRefUsuario(idDestino);

  // 2. Ejecutar transacción atómica en Firestore
  const resultado = await db.runTransaction(async (transaction: any) => {
    // --- FASE DE LECTURA ---
    const usuarioDoc = await transaction.get(usuarioRef);
    if (!usuarioDoc.exists) {
      throw new Error("Usuario solicitante no encontrado");
    }

    const homeroDoc = await transaction.get(homeroRef);

    const usuarioData = usuarioDoc.data() || {};
    const rawSaldoUsuario = usuarioData.billetera?.walletBalance ?? usuarioData.walletBalance ?? 0;
    const saldoActualUsuario = Number(rawSaldoUsuario);

    // Validación de fondos suficientes
    if (isNaN(saldoActualUsuario) || saldoActualUsuario < cantidadMonedas) {
      throw new Error("Saldo insuficiente");
    }

    const nuevoSaldoUsuario = saldoActualUsuario - cantidadMonedas;

    const homeroData = homeroDoc.exists ? (homeroDoc.data() || {}) : {};
    const rawSaldoHomero = homeroData.billetera?.walletBalance ?? homeroData.walletBalance ?? 0;
    const saldoActualHomero = Number(rawSaldoHomero);
    const nuevoSaldoHomero = saldoActualHomero + cantidadMonedas;

    const fechaActual = new Date().toISOString();

    // Referencias para los nuevos documentos
    const transactionRef = db.collection("transactions").doc();
    const pagoRef = db.collection("pagos").doc();

    const pago: Pago = {
      id: pagoRef.id,
      idUsuario: cleanUid,
      idDestino,
      cantidadMonedas,
      monto: (datos.monto !== undefined && datos.monto !== null && !isNaN(Number(datos.monto)))
        ? Number(datos.monto)
        : null,
      moneda: datos.moneda || "USD",
      metodoPago: datos.metodoPago || "paypal",
      detallesPago: datos.detallesPago || {},
      correoPago: datos.correoPago || datos.emailPago || "",
      cuentaDestino: datos.cuentaDestino || datos.numeroCuenta || "",
      nombreBeneficiario: datos.nombreBeneficiario || datos.titular || infoUsuario.nombre,
      documentoIdentidad: datos.documentoIdentidad || datos.cedula || datos.dni || "",
      telefono: datos.telefono || infoUsuario.telefono || "",
      nota: datos.nota || datos.comentario || datos.motivo || "",
      estado: "pendiente",
      transactionId: transactionRef.id,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
      usuario: {
        uid: cleanUid,
        nombre: infoUsuario.nombre || "Usuario",
        photoURL: infoUsuario.photoURL || "",
        email: datos.correoPago || infoUsuario.email || "",
        telefono: datos.telefono || infoUsuario.telefono || "",
        descripcion: infoUsuario.descripcion || "",
      },
    };

    const recibo: ReciboTransaccionPago = {
      id: transactionRef.id,
      idUsuario: cleanUid,
      idRemitente: cleanUid,
      idOyente: cleanUid,
      idDestino,
      idCreador: idDestino,
      idDestinatario: idDestino,
      cantidadMonedas,
      tipo: "solicitud_retiro",
      fecha: fechaActual,
      estado: "completado",
      pagoId: pagoRef.id,
      metodoPago: pago.metodoPago,
      saldoAnteriorUsuario: saldoActualUsuario,
      nuevoSaldoUsuario,
      saldoAnteriorHomero: saldoActualHomero,
      nuevoSaldoHomero,
      descripcion: `Solicitud de retiro de fondos (${cantidadMonedas} monedas)`,
    };

    // --- FASE DE ESCRITURA ---
    // 1. Descontar monedas al usuario solicitante
    transaction.update(usuarioRef, {
      "billetera.walletBalance": nuevoSaldoUsuario,
      "sistema.fechaActualizacion": fechaActual,
      walletBalance: nuevoSaldoUsuario,
      fechaActualizacion: fechaActual,
    });

    // 2. Sumar monedas a la cuenta de Homero
    if (homeroDoc.exists) {
      transaction.update(homeroRef, {
        "billetera.walletBalance": nuevoSaldoHomero,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: nuevoSaldoHomero,
        fechaActualizacion: fechaActual,
      });
    } else {
      transaction.set(
        homeroRef,
        {
          uid: idDestino,
          billetera: { walletBalance: nuevoSaldoHomero },
          walletBalance: nuevoSaldoHomero,
          fechaCreacion: fechaActual,
          fechaActualizacion: fechaActual,
        },
        { merge: true },
      );
    }

    // 3. Registrar la transacción en 'transactions'
    transaction.set(transactionRef, recibo);

    // 4. Registrar la solicitud en la nueva colección 'pagos'
    transaction.set(pagoRef, pago);

    return {
      pago,
      recibo,
      nuevoSaldoUsuario,
      nuevoSaldoHomero,
    };
  });

  console.log(
    `✅ [Pagos/Retiro] Solicitud registrada. Pago ID: ${resultado.pago.id} | Usuario: ${cleanUid} (-${cantidadMonedas} monedas) -> Homero: ${idDestino} (+${cantidadMonedas} monedas)`,
  );

  // Notificación Push al usuario confirmando la solicitud
  enviarPushAUsuario(
    cleanUid,
    "💰 Solicitud de Retiro Recibida",
    `Tu solicitud de retiro por ${cantidadMonedas.toLocaleString()} monedas ha sido registrada exitosamente y se encuentra en estado pendiente.`,
    {
      tipo: "solicitud_retiro",
      pagoId: resultado.pago.id,
      transactionId: resultado.recibo.id,
      cantidadMonedas: String(cantidadMonedas),
    },
  ).catch((err) => {
    console.warn("⚠️ Error enviando push al usuario solicitante:", err);
  });

  // Notificación Push a la cuenta de Homero
  enviarPushAUsuario(
    idDestino,
    "🛎️ Nueva Solicitud de Retiro",
    `${infoUsuario.nombre} ha solicitado el retiro de ${cantidadMonedas.toLocaleString()} monedas (${resultado.pago.metodoPago}).`,
    {
      tipo: "pago_admin",
      pagoId: resultado.pago.id,
      idUsuario: cleanUid,
      cantidadMonedas: String(cantidadMonedas),
    },
  ).catch((err) => {
    console.warn("⚠️ Error enviando push al administrador Homero:", err);
  });

  // Notificación a Telegram para alerta de administración
  const montoTexto = resultado.pago.monto ? `💵 *Monto Estimado:* $${resultado.pago.monto} ${resultado.pago.moneda}` : "";
  const mensajeTelegram = [
    `💰 *¡NUEVA SOLICITUD DE RETIRO DE FONDOS!* 💰`,
    `━━━━━━━━━━━━━━━━━━━`,
    `🆔 *Pago ID:* \`${resultado.pago.id}\``,
    `🧾 *Transacción ID:* \`${resultado.recibo.id}\``,
    `👤 *Usuario:* ${infoUsuario.nombre}`,
    `🆔 *UID Usuario:* \`${cleanUid}\``,
    `🎯 *ID Destino (Homero):* \`${idDestino}\``,
    `🪙 *Monedas Solicitadas:* ${cantidadMonedas.toLocaleString()}`,
    montoTexto,
    `💳 *Método de Pago:* ${resultado.pago.metodoPago}`,
    resultado.pago.correoPago ? `📧 *Correo Pago:* ${resultado.pago.correoPago}` : ``,
    resultado.pago.cuentaDestino ? `🏦 *Cuenta Destino:* ${resultado.pago.cuentaDestino}` : ``,
    resultado.pago.nombreBeneficiario ? `🏷️ *Beneficiario:* ${resultado.pago.nombreBeneficiario}` : ``,
    resultado.pago.telefono ? `📞 *Teléfono:* ${resultado.pago.telefono}` : ``,
    resultado.pago.nota ? `📝 *Nota:* ${resultado.pago.nota}` : ``,
    `🕒 *Fecha:* ${resultado.pago.fechaCreacion}`,
    `━━━━━━━━━━━━━━━━━━━`,
  ].filter(Boolean).join("\n");

  enviarAlertaTelegram(mensajeTelegram).catch((err) => {
    console.warn("⚠️ Error enviando alerta Telegram:", err);
  });

  return resultado;
};

/**
 * Consulta las solicitudes de pago de un usuario específico.
 */
export const obtenerPagosUsuarioService = async (idUsuario: string): Promise<Pago[]> => {
  try {
    const snap = await db.collection("pagos")
      .where("idUsuario", "==", idUsuario)
      .get();

    const pagos: Pago[] = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    // Ordenar de más reciente a más antiguo
    pagos.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

    return pagos;
  } catch (error) {
    console.error("❌ Error en obtenerPagosUsuarioService:", error);
    throw new Error("Error al obtener los pagos del usuario");
  }
};

/**
 * Consulta un pago específico por su ID.
 */
export const obtenerPagoPorIdService = async (pagoId: string): Promise<Pago | null> => {
  try {
    const docSnap = await db.collection("pagos").doc(pagoId).get();
    if (!docSnap.exists) {
      return null;
    }
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Pago;
  } catch (error) {
    console.error("❌ Error en obtenerPagoPorIdService:", error);
    throw new Error("Error al obtener el pago");
  }
};

/**
 * Consulta todos los pagos registrados (para administradores / dashboard).
 */
export const obtenerTodosPagosService = async (filtroEstado?: string): Promise<Pago[]> => {
  try {
    let query: any = db.collection("pagos");
    if (filtroEstado && filtroEstado.trim() !== "") {
      query = query.where("estado", "==", filtroEstado.trim());
    }

    const snap = await query.get();
    const pagos: Pago[] = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
    }));

    pagos.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());

    return pagos;
  } catch (error) {
    console.error("❌ Error en obtenerTodosPagosService:", error);
    throw new Error("Error al consultar la lista de pagos");
  }
};

/**
 * Actualiza el estado de una solicitud de pago (ej. "en_proceso", "completado", "rechazado").
 * Si se rechaza, reembolsa automáticamente las monedas retenidas al usuario solicitante.
 */
export const actualizarEstadoPagoService = async (
  pagoId: string,
  nuevoEstado: EstadoPago,
  notaAdmin?: string,
  comprobanteUrl?: string,
) => {
  const pagoRef = db.collection("pagos").doc(pagoId);
  const pagoSnap = await pagoRef.get();

  if (!pagoSnap.exists) {
    throw new Error("Solicitud de pago no encontrada");
  }

  const pagoData = pagoSnap.data() as Pago;
  const fechaActual = new Date().toISOString();

  // Si se rechaza y no estaba rechazado previamente, devolver monedas al usuario
  if (nuevoEstado === "rechazado" && pagoData.estado !== "rechazado") {
    const usuarioRef = await obtenerDocRefUsuario(pagoData.idUsuario);
    const homeroRef = await obtenerDocRefUsuario(pagoData.idDestino || ID_HOMERO_DEFAULT);

    await db.runTransaction(async (transaction: any) => {
      const uDoc = await transaction.get(usuarioRef);
      const hDoc = await transaction.get(homeroRef);

      const saldoActualU = Number(uDoc.exists ? (uDoc.data()?.billetera?.walletBalance ?? uDoc.data()?.walletBalance ?? 0) : 0);
      const saldoActualH = Number(hDoc.exists ? (hDoc.data()?.billetera?.walletBalance ?? hDoc.data()?.walletBalance ?? 0) : 0);

      const monedas = Number(pagoData.cantidadMonedas || 0);
      const nuevoSaldoU = saldoActualU + monedas;
      const nuevoSaldoH = Math.max(0, saldoActualH - monedas);

      const transReembolsoRef = db.collection("transactions").doc();

      // Devolver saldo al usuario
      transaction.update(usuarioRef, {
        "billetera.walletBalance": nuevoSaldoU,
        "sistema.fechaActualizacion": fechaActual,
        walletBalance: nuevoSaldoU,
        fechaActualizacion: fechaActual,
      });

      // Descontar saldo de Homero
      if (hDoc.exists) {
        transaction.update(homeroRef, {
          "billetera.walletBalance": nuevoSaldoH,
          "sistema.fechaActualizacion": fechaActual,
          walletBalance: nuevoSaldoH,
          fechaActualizacion: fechaActual,
        });
      }

      // Registrar transacción de reembolso
      transaction.set(transReembolsoRef, {
        id: transReembolsoRef.id,
        idUsuario: pagoData.idUsuario,
        idRemitente: pagoData.idDestino || ID_HOMERO_DEFAULT,
        idOyente: pagoData.idDestino || ID_HOMERO_DEFAULT,
        idDestino: pagoData.idUsuario,
        idCreador: pagoData.idUsuario,
        idDestinatario: pagoData.idUsuario,
        cantidadMonedas: monedas,
        tipo: "reembolso_retiro",
        pagoId,
        fecha: fechaActual,
        estado: "completado",
        motivoRechazo: notaAdmin || "Solicitud de retiro rechazada",
        saldoAnteriorUsuario: saldoActualU,
        nuevoSaldoUsuario: nuevoSaldoU,
      });

      // Actualizar el estado en 'pagos'
      transaction.update(pagoRef, {
        estado: "rechazado",
        notaAdmin: notaAdmin || "",
        ...(comprobanteUrl ? { comprobanteUrl } : {}),
        fechaActualizacion: fechaActual,
      });
    });

    enviarPushAUsuario(
      pagoData.idUsuario,
      "⚠️ Solicitud de Retiro Rechazada",
      `Tu solicitud de retiro por ${pagoData.cantidadMonedas} monedas ha sido rechazada y los fondos han sido reembolsados a tu saldo. Motivo: ${notaAdmin || "Contacta a soporte."}`,
      {
        tipo: "retiro_rechazado",
        pagoId,
      },
    ).catch(() => {});

    return {
      success: true,
      message: "Pago rechazado y monedas reembolsadas exitosamente al usuario",
      pagoId,
      estado: "rechazado",
    };
  }

  // Actualización normal de estado (ej: 'en_proceso', 'completado')
  const updateData: Record<string, any> = {
    estado: nuevoEstado,
    fechaActualizacion: fechaActual,
  };

  if (notaAdmin !== undefined) updateData.notaAdmin = notaAdmin;
  if (comprobanteUrl !== undefined) updateData.comprobanteUrl = comprobanteUrl;

  await pagoRef.update(updateData);

  if (nuevoEstado === "completado") {
    enviarPushAUsuario(
      pagoData.idUsuario,
      "🎉 ¡Tu Retiro ha sido Pagado!",
      `Tu pago por ${pagoData.cantidadMonedas} monedas ha sido procesado exitosamente. Revisa tu cuenta de ${pagoData.metodoPago}.`,
      {
        tipo: "retiro_completado",
        pagoId,
        ...(comprobanteUrl ? { comprobanteUrl } : {}),
      },
    ).catch(() => {});
  }

  return {
    success: true,
    message: `Estado de la solicitud de pago actualizado a '${nuevoEstado}'`,
    pagoId,
    estado: nuevoEstado,
  };
};
