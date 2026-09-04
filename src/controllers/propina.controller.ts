import type { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  enviarPropinaService,
  obtenerHistorialUsuarioService,
  obtenerRankingCreadoresService,
  reclamarRecompensaAnuncioService,
  resetearLimiteAnunciosService,
} from "../service/propina.service.ts";

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
 * Limitador de tasa (Rate Limiter) en memoria para evitar toques repetitivos o spam de propinas.
 * Permite un máximo de 2 peticiones cada 3000 ms por usuario.
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 3000, maxRequests = 2) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  reset(key?: string) {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

export const propinaRateLimiter = new RateLimiter(3000, 2);

/**
 * Controlador para procesar el envío de propinas entre usuarios.
 * POST /api/enviar-propina
 */
export const enviarPropinaController = async (ctx: Context) => {
  try {
    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

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

    // Filtro Anti-Fraude 1: Validar que el remitente no sea el mismo creador
    if (idOyente === idCreador) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "No puedes enviarte propinas a ti mismo",
        error: "AUTO_DONATION_FORBIDDEN",
      };
      return;
    }

    // Filtro Anti-Fraude 2: Rate Limiting para evitar spam de toques repetitivos
    if (!propinaRateLimiter.isAllowed(idOyente)) {
      ctx.response.status = 429;
      ctx.response.body = {
        success: false,
        message: "Demasiadas peticiones consecutivas. Por favor, espera unos segundos antes de enviar otra propina.",
        error: "RATE_LIMIT_EXCEEDED",
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

    const idHistoria = body.idHistoria || body.publicacionId || body.idPublicacion || "";
    const texto = body.texto || "";

    // Ejecutar transacción atómica en Firestore
    const resultado = await enviarPropinaService({
      idOyente,
      idCreador,
      cantidadMonedas,
      tipoSticker,
      idHistoria,
      publicacionId: idHistoria,
      texto,
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
        idHistoria,
        nuevoSaldo: resultado.nuevoSaldoOyente,
        nuevoSaldoOyente: resultado.nuevoSaldoOyente,
        recibo: resultado.recibo,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    if (errorMessage === "Saldo insuficiente") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Saldo insuficiente",
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

    console.error("❌ Error en enviarPropinaController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar la propina",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para obtener el historial de gastos y ganancias de un usuario.
 * GET /api/historial o GET /api/historial/:uid
 */
export const obtenerHistorialController = async (ctx: RouterContext<string> | Context) => {
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

    const data = await obtenerHistorialUsuarioService(uid.trim());

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Historial obtenido exitosamente",
      data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerHistorialController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener el historial",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para consultar el ranking mensual de creadores más apoyados.
 * GET /api/ranking o GET /api/ranking?mes=YYYY-MM
 */
export const obtenerRankingController = async (ctx: Context) => {
  try {
    const mes = ctx.request.url.searchParams.get("mes") || ctx.request.url.searchParams.get("periodo") || undefined;

    const data = await obtenerRankingCreadoresService(mes);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Ranking de creadores obtenido exitosamente",
      data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerRankingController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al calcular el ranking",
      error: errorMessage,
    };
  }
};

/**
 * Controlador para acreditar monedas por visualización de anuncio recompensado (AdMob).
 * POST /api/recompensa-anuncio
 */
export const reclamarRecompensaAnuncioController = async (ctx: Context) => {
  try {
    const rawBody = await extraerBodyJson(ctx);
    const body = (rawBody && typeof rawBody === "object") ? rawBody : {};

    const idUsuario = body.idUsuario || body.uid || body.userId;
    const adId = body.adId || body.transactionId || body.adUnitId || body.adToken;
    const cantidadMonedas = body.cantidadMonedas ?? body.monedas ?? body.rewardAmount;
    const adNetwork = body.adNetwork || "admob";

    if (!idUsuario || typeof idUsuario !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del usuario (idUsuario) es requerido",
      };
      return;
    }

    if (!adId || typeof adId !== "string" || adId.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El identificador del anuncio (adId) es requerido",
      };
      return;
    }

    const resultado = await reclamarRecompensaAnuncioService({
      idUsuario: idUsuario.trim(),
      adId: adId.trim(),
      cantidadMonedas: cantidadMonedas !== undefined ? Number(cantidadMonedas) : undefined,
      adNetwork,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Recompensa otorgada exitosamente",
      data: {
        transactionId: resultado.recibo.id,
        idUsuario,
        cantidadOtorgada: resultado.monedasOtorgadas,
        nuevoSaldo: resultado.nuevoSaldo,
        anunciosVistosHoy: resultado.anunciosVistosHoy,
        anunciosRestantes: resultado.anunciosRestantes,
        fecha: resultado.recibo.fecha,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";

    if (errorMessage.includes("ya fue reclamada")) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Esta recompensa de anuncio ya fue reclamada",
        error: errorMessage,
      };
      return;
    }

    if (errorMessage.includes("límite") || errorMessage.includes("limite")) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: errorMessage,
        error: errorMessage,
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

    console.error("❌ Error en reclamarRecompensaAnuncioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar la recompensa del anuncio",
      error: errorMessage,
    };
  }
};

/**
 * Endpoint para restablecer el límite diario de anuncios de un usuario (para desarrollo/pruebas).
 * POST /api/anuncios/reset-limite o POST /api/anuncios/reset-limite/:uid
 */
export const resetearLimiteAnunciosController = async (ctx: RouterContext<any> | Context) => {
  try {
    const params = (ctx as any).params || {};
    const body = await extraerBodyJson(ctx);
    const idUsuario = params.uid || body.idUsuario || body.uid || body.userId;

    if (!idUsuario) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El parámetro uid o idUsuario es obligatorio",
      };
      return;
    }

    const resultado = await resetearLimiteAnunciosService(String(idUsuario).trim());

    ctx.response.status = 200;
    ctx.response.body = resultado;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en resetearLimiteAnunciosController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al restablecer el límite diario de anuncios",
      error: errorMessage,
    };
  }
};

