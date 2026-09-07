import type { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarEstadoPagoService,
  ID_HOMERO_DEFAULT,
  obtenerPagoPorIdService,
  obtenerPagosUsuarioService,
  obtenerTodosPagosService,
  solicitarRetiroService,
} from "../service/pago.service.ts";
import { EstadoPago } from "../models/pago.model.ts";
import { RateLimiter } from "./propina.controller.ts";

/**
 * Limitador de tasa para solicitudes de retiro (máximo 2 peticiones cada 5000 ms por usuario).
 */
export const pagoRateLimiter = new RateLimiter(5000, 2);

/**
 * Función utilitaria para extraer el body JSON de forma segura y compatible con Oak.
 */
const extraerBodyJson = async (ctx: Context): Promise<Record<string, any>> => {
  try {
    if (typeof (ctx.request.body as any)?.json === "function") {
      const res = await (ctx.request.body as any).json();
      if (res && typeof res === "object") return res;
    }
    if (typeof (ctx.request as any)?.body === "function") {
      const bodyResult = (ctx.request as any).body({ type: "json" });
      const res = await bodyResult.value;
      if (res && typeof res === "object") return res;
    }
    const val = await (ctx.request.body as any)?.value;
    if (val && typeof val === "object") return val;
    return {};
  } catch (_err) {
    return {};
  }
};

/**
 * Controlador para procesar la solicitud de retiro de dinero del usuario hacia Homero.
 * - Descuenta el saldo del usuario y lo transfiere a la cuenta de Homero ("7cBW5g7xYGbh7Fh2zTCHvNBdGHx1").
 * - Genera una transacción en 'transactions' y registra la solicitud en la nueva colección 'pagos'.
 * POST /api/solicitar-retiro o POST /api/pagos/solicitar-retiro
 */
export const solicitarRetiroController = async (ctx: Context) => {
  try {
    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

    // Extraer campos con soporte para variantes comunes
    const idUsuario = body.idUsuario || body.uid || body.idOyente || body.userId || body.idRemitente;
    const idDestino = body.idDestino || body.idHomero || body.idCreador || ID_HOMERO_DEFAULT;
    const rawCantidad = body.cantidadMonedas ?? body.monedas ?? body.cantidad ?? body.amount ?? body.coins;
    const monto = body.monto ?? body.montoDinero ?? body.cashAmount;
    const moneda = body.moneda || body.currency || "USD";
    const metodoPago = body.metodoPago || body.metodo || body.paymentMethod || "paypal";
    const detallesPago = body.detallesPago || body.datosPago || body.paymentDetails || {};
    const correoPago = body.correoPago || body.emailPago || body.correo || body.email || body.paypalEmail;
    const cuentaDestino = body.cuentaDestino || body.numeroCuenta || body.cuentaBancaria;
    const nombreBeneficiario = body.nombreBeneficiario || body.nombreTitular || body.titular || body.beneficiario;
    const documentoIdentidad = body.documentoIdentidad || body.cedula || body.dni || body.rut;
    const telefono = body.telefono || body.celular || body.phone;
    const nota = body.nota || body.comentario || body.motivo || body.descripcion;

    // Validación de usuario
    if (!idUsuario || typeof idUsuario !== "string" || idUsuario.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del usuario (idUsuario o uid) es requerido",
      };
      return;
    }

    const cleanUid = String(idUsuario).trim();

    // Filtro Anti-Fraude: No permitir solicitar retiro enviando dinero a su propia cuenta
    if (cleanUid === idDestino) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "No puedes solicitar retiro enviando dinero a tu propia cuenta",
        error: "AUTO_TRANSFER_FORBIDDEN",
      };
      return;
    }

    // Filtro Anti-Fraude: Rate Limiting
    if (!pagoRateLimiter.isAllowed(cleanUid)) {
      ctx.response.status = 429;
      ctx.response.body = {
        success: false,
        message: "Demasiadas peticiones consecutivas. Por favor, espera unos segundos antes de solicitar otro retiro.",
        error: "RATE_LIMIT_EXCEEDED",
      };
      return;
    }

    // Validación de cantidad de monedas
    const cantidadMonedas = Number(rawCantidad);
    if (rawCantidad === undefined || rawCantidad === null || isNaN(cantidadMonedas) || cantidadMonedas <= 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "La cantidad de monedas debe ser un número mayor a 0",
      };
      return;
    }

    // Procesar retiro a través del servicio
    const resultado = await solicitarRetiroService({
      idUsuario: cleanUid,
      idDestino,
      cantidadMonedas,
      monto: monto !== undefined && monto !== null ? Number(monto) : undefined,
      moneda: String(moneda).toUpperCase(),
      metodoPago: String(metodoPago).toLowerCase(),
      detallesPago,
      correoPago: correoPago ? String(correoPago).trim() : undefined,
      cuentaDestino: cuentaDestino ? String(cuentaDestino).trim() : undefined,
      nombreBeneficiario: nombreBeneficiario ? String(nombreBeneficiario).trim() : undefined,
      documentoIdentidad: documentoIdentidad ? String(documentoIdentidad).trim() : undefined,
      telefono: telefono ? String(telefono).trim() : undefined,
      nota: nota ? String(nota).trim() : undefined,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Solicitud de retiro registrada exitosamente",
      data: {
        pagoId: resultado.pago.id,
        transactionId: resultado.recibo.id,
        idUsuario: cleanUid,
        idDestino: resultado.pago.idDestino,
        cantidadMonedas: resultado.pago.cantidadMonedas,
        monto: resultado.pago.monto,
        moneda: resultado.pago.moneda,
        metodoPago: resultado.pago.metodoPago,
        estado: resultado.pago.estado,
        nuevoSaldo: resultado.nuevoSaldoUsuario,
        nuevoSaldoUsuario: resultado.nuevoSaldoUsuario,
        pago: resultado.pago,
        recibo: resultado.recibo,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    if (errorMessage === "Saldo insuficiente") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Saldo insuficiente para procesar el retiro",
        error: "Saldo insuficiente",
      };
      return;
    }

    if (errorMessage.includes("no encontrado")) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: errorMessage,
        error: errorMessage,
      };
      return;
    }

    console.error("❌ Error en solicitarRetiroController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar la solicitud de retiro",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para consultar el historial de pagos y retiros de un usuario.
 * GET /api/pagos/usuario/:uid o GET /api/pagos?uid=...
 */
export const obtenerPagosUsuarioController = async (ctx: RouterContext<string> | Context) => {
  try {
    const params = (ctx as RouterContext<string>).params;
    const uidFromParam = params ? params.uid : null;
    const uidFromQuery = ctx.request.url.searchParams.get("uid") || ctx.request.url.searchParams.get("idUsuario");
    const uid = uidFromParam || uidFromQuery;

    if (!uid || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El UID del usuario es requerido (en ruta o parámetro ?uid=...)",
      };
      return;
    }

    const pagos = await obtenerPagosUsuarioService(uid.trim());

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Pagos del usuario obtenidos exitosamente",
      total: pagos.length,
      data: pagos,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerPagosUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener los pagos del usuario",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para consultar un pago específico por ID.
 * GET /api/pagos/:id
 */
export const obtenerPagoPorIdController = async (ctx: RouterContext<string> | Context) => {
  try {
    const params = (ctx as RouterContext<string>).params || {};
    const id = params.id;

    if (!id || id.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del pago es requerido",
      };
      return;
    }

    const pago = await obtenerPagoPorIdService(id.trim());

    if (!pago) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "Pago no encontrado",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: pago,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerPagoPorIdController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener el pago",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para listar todos los pagos registrados (Administración).
 * GET /api/pagos?estado=pendiente
 */
export const obtenerTodosPagosController = async (ctx: Context) => {
  try {
    const estado = ctx.request.url.searchParams.get("estado") || undefined;
    const pagos = await obtenerTodosPagosService(estado);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      total: pagos.length,
      data: pagos,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerTodosPagosController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al consultar los pagos",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para actualizar el estado de un pago (ej. 'completado', 'rechazado', 'en_proceso').
 * PUT /api/pagos/:id/estado
 */
export const actualizarEstadoPagoController = async (ctx: RouterContext<string> | Context) => {
  try {
    const params = (ctx as RouterContext<string>).params || {};
    const id = params.id;

    if (!id || id.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del pago es requerido",
      };
      return;
    }

    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

    const nuevoEstado = body.estado as EstadoPago;
    const notaAdmin = body.notaAdmin || body.nota || body.motivo;
    const comprobanteUrl = body.comprobanteUrl || body.comprobante;

    const estadosValidos: EstadoPago[] = ["pendiente", "en_proceso", "completado", "rechazado", "cancelado"];
    if (!nuevoEstado || !estadosValidos.includes(nuevoEstado)) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: `Estado inválido. Debe ser uno de: ${estadosValidos.join(", ")}`,
      };
      return;
    }

    const resultado = await actualizarEstadoPagoService(
      id.trim(),
      nuevoEstado,
      notaAdmin,
      comprobanteUrl,
    );

    ctx.response.status = 200;
    ctx.response.body = resultado;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    if (errorMessage.includes("no encontrada")) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: errorMessage,
      };
      return;
    }

    console.error("❌ Error en actualizarEstadoPagoController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el estado del pago",
      error: errorMessage,
    };
  }
};
