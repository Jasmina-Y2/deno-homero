import { Context } from "oak";
import {
  consultarEstadoLimiteDispositivoService,
  resetearLimiteDispositivoService,
  validarYProcesarRecompensaDispositivoService,
} from "../service/deviceAdLimit.service.ts";

/**
 * Helper para extraer body en formato JSON con Oak (compatible con Oak v10, v12 y v14+)
 */
async function extraerBodyJson(ctx: Context): Promise<Record<string, any>> {
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
}

/**
 * Controlador para validar el límite diario por dispositivo físico y acreditar monedas atómicamente.
 * POST /api/device-ad-limits/recompensar
 * POST /api/anuncios/validar-dispositivo
 */
export const validarYRecompensarDispositivoController = async (ctx: Context) => {
  try {
    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

    const uid = body.uid || body.idUsuario || body.userId;
    const deviceId = body.deviceId || body.idDispositivo || body.hardwareId || body.uuid;
    const cantidadMonedas = body.cantidadMonedas ?? body.monedas ?? body.rewardAmount;
    const adId = body.adId || body.transactionId || body.adToken;
    const adNetwork = body.adNetwork || "admob";

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El identificador del usuario (uid) es requerido",
      };
      return;
    }

    if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El identificador del dispositivo (deviceId) es requerido",
      };
      return;
    }

    const resultado = await validarYProcesarRecompensaDispositivoService({
      uid: String(uid).trim(),
      deviceId: String(deviceId).trim(),
      cantidadMonedas: cantidadMonedas !== undefined ? Number(cantidadMonedas) : undefined,
      adId: adId ? String(adId).trim() : undefined,
      adNetwork: adNetwork ? String(adNetwork).trim() : undefined,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Recompensa procesada y monedas acreditadas exitosamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    // 1. Límite alcanzado en el dispositivo
    if (errorMessage.includes("límite") || errorMessage.includes("limite")) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "DEVICE_AD_LIMIT_REACHED",
        message: errorMessage,
      };
      return;
    }

    // 2. Anuncio ya reclamado (anti-replay)
    if (errorMessage.includes("ya fue reclamada")) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "AD_ALREADY_CLAIMED",
        message: errorMessage,
      };
      return;
    }

    // 3. Usuario no encontrado
    if (errorMessage.includes("no encontrado")) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        error: "USER_NOT_FOUND",
        message: errorMessage,
      };
      return;
    }

    console.error("❌ Error en validarYRecompensarDispositivoController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error interno al procesar el límite de anuncios por dispositivo",
      error: errorMessage,
    };
  }
};

/**
 * Consulta el estado de límite de anuncios para un dispositivo.
 * GET /api/device-ad-limits/:deviceId
 * GET /api/anuncios/estado-dispositivo/:deviceId
 */
export const consultarEstadoDispositivoController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const url = ctx.request.url;
    const deviceId = params.deviceId || url.searchParams.get("deviceId");

    if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El deviceId es requerido en la ruta o parámetro query",
      };
      return;
    }

    const estado = await consultarEstadoLimiteDispositivoService(deviceId.trim());

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: estado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en consultarEstadoDispositivoController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al consultar estado del dispositivo",
      error: errorMessage,
    };
  }
};

/**
 * Restablece a 0 el contador de anuncios para un dispositivo (modo administración / QA).
 * POST /api/device-ad-limits/:deviceId/reset
 * POST /api/anuncios/reset-dispositivo
 */
export const resetearLimiteDispositivoController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

    const deviceId = params.deviceId || body.deviceId || body.idDispositivo;

    if (!deviceId || typeof deviceId !== "string" || deviceId.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El deviceId es requerido para reiniciar el límite",
      };
      return;
    }

    const resultado = await resetearLimiteDispositivoService(deviceId.trim());

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Límite del dispositivo reseteado exitosamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en resetearLimiteDispositivoController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al resetear límite del dispositivo",
      error: errorMessage,
    };
  }
};
