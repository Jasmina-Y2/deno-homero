import type { Context } from "https://deno.land/x/oak/mod.ts";
import { enviarPropinaService } from "../service/propina.service.ts";

/**
 * Función utilitaria para extraer el body JSON de forma segura y compatible con Oak.
 */
const extraerBodyJson = async (ctx: Context): Promise<any> => {
  try {
    if (typeof (ctx.request.body as any)?.json === "function") {
      return await (ctx.request.body as any).json();
    }
    const bodyResult = (ctx.request.body as any)({ type: "json" });
    return await bodyResult.value;
  } catch (_err) {
    try {
      return await (ctx.request.body as any).value;
    } catch (_err2) {
      return {};
    }
  }
};

/**
 * Controlador para procesar el envío de propinas entre usuarios.
 * POST /api/enviar-propina
 * 
 * Espera en el body:
 * - idOyente (o oyenteId)
 * - idCreador (o creadorId)
 * - cantidadMonedas (o monedas, costoSticker)
 * - tipoSticker (o stickerType, sticker)
 */
export const enviarPropinaController = async (ctx: Context) => {
  try {
    const body = await extraerBodyJson(ctx);

    // Extraer los 4 datos clave con soporte de variantes comunes
    const idOyente = body.idOyente || body.oyenteId || body.listenerId || body.idUsuario || body.uidOyente || body.uid;
    const idCreador = body.idCreador || body.creadorId || body.creatorId || body.idAutor || body.uidCreador;
    const rawCantidad = body.cantidadMonedas ?? body.monedas ?? body.cantidad ?? body.coins ?? body.costoSticker ?? body.costo ?? body.amount;
    const tipoSticker = body.tipoSticker || body.stickerType || body.sticker || body.idSticker;

    // Validaciones de datos de entrada
    if (!idOyente || typeof idOyente !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del oyente es requerido",
      };
      return;
    }

    if (!idCreador || typeof idCreador !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del creador es requerido",
      };
      return;
    }

    if (idOyente === idCreador) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El oyente y el creador no pueden ser el mismo usuario",
      };
      return;
    }

    const cantidadMonedas = Number(rawCantidad);
    if (rawCantidad === undefined || rawCantidad === null || isNaN(cantidadMonedas) || cantidadMonedas <= 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "La cantidad de monedas debe ser un número mayor a 0",
      };
      return;
    }

    if (!tipoSticker || typeof tipoSticker !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El tipo de sticker es requerido",
      };
      return;
    }

    // Ejecutar transacción atómica en Firestore
    const resultado = await enviarPropinaService({
      idOyente,
      idCreador,
      cantidadMonedas,
      tipoSticker,
    });

    // Paso 6: Conectar respuesta de éxito (código 200) con Ionic
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Propina enviada exitosamente",
      data: {
        transactionId: resultado.recibo.id,
        idOyente,
        idCreador,
        cantidadMonedas,
        tipoSticker,
        nuevoSaldo: resultado.nuevoSaldoOyente,
        nuevoSaldoOyente: resultado.nuevoSaldoOyente,
        recibo: resultado.recibo,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    // Si el error es específicamente por saldo insuficiente
    if (errorMessage === "Saldo insuficiente") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Saldo insuficiente",
        error: "Saldo insuficiente",
      };
      return;
    }

    // Si el usuario no fue encontrado
    if (errorMessage.includes("no encontrado")) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: errorMessage,
        error: errorMessage,
      };
      return;
    }

    // Error general de servidor o transacción
    console.error("❌ Error en enviarPropinaController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar la propina",
      error: errorMessage,
    };
  }
};
