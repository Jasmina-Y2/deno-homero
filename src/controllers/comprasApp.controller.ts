import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarEstadoCompraService,
  crearRegistroCompraApp,
  obtenerCompraPorIdService,
  obtenerComprasUsuarioService,
  obtenerTodasComprasService,
  procesarEntregaMonedasCompraApp,
  reintentarCompraProblemaService,
  resolverCantidadMonedas,
} from "../service/comprasApp.service.ts";
import { EstadoCompraApp } from "../models/comprasApp.model.ts";

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
 * Consulta el historial de compras de la app de un usuario específico.
 * Endpoint: GET /api/compras-app/usuario/:uid
 */
export const obtenerComprasUsuarioController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const uid = params.uid || ctx.request.url.searchParams.get("uid");

    if (!uid || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El parámetro UID del usuario es requerido",
      };
      return;
    }

    const compras = await obtenerComprasUsuarioService(uid.trim());

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      uid: uid.trim(),
      total: compras.length,
      compras,
    };
  } catch (error: any) {
    console.error("❌ Error en obtenerComprasUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al consultar las compras del usuario",
      error: error?.message || "Error desconocido",
    };
  }
};

/**
 * Consulta general de compras de la app con filtros opcionales (Panel Administrador).
 * Endpoint: GET /api/compras-app
 * Query Params: estado, idUsuario, tipoItem, limite, desdeFecha, hastaFecha
 */
export const obtenerTodasComprasController = async (ctx: Context) => {
  try {
    const url = ctx.request.url;
    const estado = url.searchParams.get("estado") || undefined;
    const idUsuario = url.searchParams.get("idUsuario") || undefined;
    const tipoItem = url.searchParams.get("tipoItem") || undefined;
    const limiteStr = url.searchParams.get("limite");
    const desdeFecha = url.searchParams.get("desdeFecha") || undefined;
    const hastaFecha = url.searchParams.get("hastaFecha") || undefined;

    const limite = limiteStr ? parseInt(limiteStr, 10) : undefined;

    const compras = await obtenerTodasComprasService({
      estado,
      idUsuario,
      tipoItem,
      limite,
      desdeFecha,
      hastaFecha,
    });

    // Contadores para resumen rápido
    const resumen = {
      total: compras.length,
      concluidas: compras.filter((c) => c.estado === "concluido").length,
      pendientes: compras.filter((c) => c.estado === "pendiente").length,
      problemas: compras.filter((c) => c.estado === "problema").length,
      reembolsadas: compras.filter((c) => c.estado === "reembolsado").length,
    };

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      resumen,
      compras,
    };
  } catch (error: any) {
    console.error("❌ Error en obtenerTodasComprasController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al consultar la lista general de compras",
      error: error?.message || "Error desconocido",
    };
  }
};

/**
 * Consulta el detalle de una compra específica por su ID.
 * Endpoint: GET /api/compras-app/:id
 */
export const obtenerCompraPorIdController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const id = params.id;

    if (!id || id.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID de la compra es requerido",
      };
      return;
    }

    const compra = await obtenerCompraPorIdService(id.trim());

    if (!compra) {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `No se encontró ninguna compra con ID: ${id}`,
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      compra,
    };
  } catch (error: any) {
    console.error("❌ Error en obtenerCompraPorIdController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener el detalle de la compra",
      error: error?.message || "Error desconocido",
    };
  }
};

/**
 * Reintenta la entrega de monedas para una compra con problema o pendiente.
 * Endpoint: POST /api/compras-app/:id/reintentar
 */
export const reintentarCompraController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const id = params.id;

    if (!id || id.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID de la compra es requerido para el reintento",
      };
      return;
    }

    let monedasManual: number | undefined = undefined;
    try {
      const body = await extraerBodyJson(ctx);
      if (body && typeof body.monedasManual === "number") {
        monedasManual = body.monedasManual;
      }
    } catch (_e) {
      // Body opcional
    }

    const resultado = await reintentarCompraProblemaService(id.trim(), monedasManual);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: resultado.message,
      compra: resultado.compra,
    };
  } catch (error: any) {
    console.error("❌ Error en reintentarCompraController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al reintentar la compra",
      error: error?.message || "Error desconocido",
    };
  }
};

/**
 * Actualiza el estado administrativo de una compra.
 * Endpoint: PUT /api/compras-app/:id/estado
 */
export const actualizarEstadoCompraController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const id = params.id;

    if (!id || id.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID de la compra es requerido",
      };
      return;
    }

    const body = await extraerBodyJson(ctx);
    const { estado, motivo } = body || {};

    const estadosValidos: EstadoCompraApp[] = [
      "pendiente",
      "concluido",
      "problema",
      "reembolsado",
      "cancelado",
    ];

    if (!estado || !estadosValidos.includes(estado)) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: `Estado inválido. Estados permitidos: ${estadosValidos.join(", ")}`,
      };
      return;
    }

    const compra = await actualizarEstadoCompraService(id.trim(), estado, motivo);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Estado de la compra actualizado a '${estado}'`,
      compra,
    };
  } catch (error: any) {
    console.error("❌ Error en actualizarEstadoCompraController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el estado de la compra",
      error: error?.message || "Error desconocido",
    };
  }
};

/**
 * Endpoint para procesar o simular entrega manual de monedas (para pruebas/soporte técnico).
 * Endpoint: POST /api/compras-app/manual
 */
export const registrarCompraManualController = async (ctx: Context) => {
  try {
    const body = await extraerBodyJson(ctx);
    const { idUsuario, productId, cantidadMonedas, precio, moneda } = body || {};

    if (!idUsuario || typeof idUsuario !== "string" || idUsuario.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El campo 'idUsuario' es requerido",
      };
      return;
    }

    const monedasAcreditar = cantidadMonedas || resolverCantidadMonedas(productId || "coins_100");

    const { compra } = await crearRegistroCompraApp({
      idUsuario: idUsuario.trim(),
      productId: productId || `manual_coins_${monedasAcreditar}`,
      tipoItem: "monedas",
      cantidadMonedas: monedasAcreditar,
      store: "PROMOTIONAL",
      entorno: "SANDBOX",
      precio: precio || 0,
      moneda: moneda || "USD",
    });

    const resultado = await procesarEntregaMonedasCompraApp(compra.id, {
      monedasManual: monedasAcreditar,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Compra manual de ${monedasAcreditar} monedas procesada exitosamente`,
      compra: resultado.compra,
      nuevoSaldo: resultado.nuevoSaldo,
    };
  } catch (error: any) {
    console.error("❌ Error en registrarCompraManualController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar la compra manual",
      error: error?.message || "Error desconocido",
    };
  }
};
