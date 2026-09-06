import { Context } from "oak";
import {
  guardarPinBovedaService,
  obtenerPinBovedaFirebase,
} from "../service/boveda.service.ts";

/**
 * Helper para extraer body en formato JSON con Oak (compatible con v10, v12 y v14+)
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
 * Controlador para obtener el PIN de la bóveda de un usuario.
 * GET /api/boveda/pin/:uid
 * GET /api/boveda/pin?uid=...
 * POST /api/boveda/obtener-pin
 * GET /api/bovedapins/:uid
 */
export const obtenerPinBovedaController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const searchParams = ctx.request.url.searchParams;
    let body: Record<string, any> = {};

    if (ctx.request.method === "POST" || (ctx.request as any).hasBody) {
      body = await extraerBodyJson(ctx);
    }

    const uid = params.uid ||
      searchParams.get("uid") ||
      body.uid ||
      body.idUsuario ||
      body.userId;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El identificador del usuario (uid) es requerido",
      };
      return;
    }

    const pin = await obtenerPinBovedaFirebase(uid.trim());

    if (!pin) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        exists: false,
        pin: null,
        message: "No se encontró ningún PIN de bóveda configurado para este usuario",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      exists: true,
      pin: pin,
      data: {
        uid: uid.trim(),
        pin: pin,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerPinBovedaController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener el PIN de la bóveda",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para guardar o actualizar el PIN de la bóveda.
 * POST /api/boveda/guardar-pin
 * PUT /api/boveda/guardar-pin
 */
export const guardarPinBovedaController = async (ctx: Context) => {
  try {
    const body = await extraerBodyJson(ctx);
    const params = (ctx as any).params || {};
    const searchParams = ctx.request.url.searchParams;

    const uid = body.uid ||
      body.idUsuario ||
      body.userId ||
      params.uid ||
      searchParams.get("uid");

    const pin = body.pin ?? body.bovedaPin ?? body.codigoPin;

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El identificador del usuario (uid) es requerido",
      };
      return;
    }

    if (pin === undefined || pin === null || String(pin).trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El PIN es requerido",
      };
      return;
    }

    const resultado = await guardarPinBovedaService(
      String(uid).trim(),
      String(pin).trim(),
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "PIN de bóveda guardado exitosamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en guardarPinBovedaController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al guardar el PIN de la bóveda",
      error: errorMessage,
    };
  }
};
