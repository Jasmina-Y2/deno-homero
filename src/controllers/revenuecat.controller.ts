import { Context } from "https://deno.land/x/oak/mod.ts";
import { db } from "../config/firebase.ts";
import { actualizarSuscripcionUsuarioService } from "../service/users.service.ts";
import { enviarPushAUsuario } from "../service/notification.service.ts";
import {
  crearRegistroCompraApp,
  marcarCanceladoCompraApp,
  marcarProblemaCompraApp,
  marcarRechazoCompraApp,
  procesarEntregaMonedasCompraApp,
  procesarReembolsoCompraApp,
  resolverCantidadMonedas,
} from "../service/comprasApp.service.ts";

export interface RevenueCatWebhookEvent {
  id?: string;
  type:
    | "INITIAL_PURCHASE"
    | "RENEWAL"
    | "CANCELLATION"
    | "UNCANCELLATION"
    | "NON_RENEWING_PURCHASE"
    | "SUBSCRIPTION_PAUSED"
    | "EXPIRATION"
    | "BILLING_ISSUE"
    | "PRODUCT_CHANGE"
    | "REVOCATION"
    | "TRANSFER"
    | "TEST"
    | string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_id?: string | null;
  entitlement_ids?: string[];
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment?: "PRODUCTION" | "SANDBOX" | string;
  cancel_reason?: string;
  store?: string;
  price_in_purchased_currency?: number;
  currency?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  [key: string]: unknown;
}

export interface RevenueCatWebhookPayload {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
}

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
 * Controller para manejar Webhooks provenientes de RevenueCat
 * Endpoint: POST /api/revenuecat-webhook
 */
export const revenueCatWebhookController = async (ctx: Context) => {
  try {
    // 1. Verificación de Token de autorización (si está configurado)
    const webhookSecret =
      Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ||
      Deno.env.get("REVENUECAT_WEBHOOK_AUTH");

    if (webhookSecret) {
      const authHeader = ctx.request.headers.get("authorization");
      const expectedBearer = `Bearer ${webhookSecret}`;

      if (authHeader !== webhookSecret && authHeader !== expectedBearer) {
        console.warn("[RevenueCat Webhook] Intento de acceso no autorizado");
        ctx.response.status = 401;
        ctx.response.body = {
          success: false,
          message: "No autorizado. Token de webhook inválido.",
        };
        return;
      }
    }

    // 2. Parsear el cuerpo de la petición
    const body: RevenueCatWebhookPayload = await extraerBodyJson(ctx);
    const event = body?.event;

    if (!event || Object.keys(event).length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Payload inválido: no se encontró el objeto 'event'",
      };
      return;
    }

    const {
      type,
      app_user_id,
      original_app_user_id,
      product_id,
      purchased_at_ms,
      expiration_at_ms,
    } = event;

    const uid = app_user_id || original_app_user_id;

    console.log(
      `[RevenueCat Webhook] 🔔 Evento: "${type}" | UID: "${uid}" | Producto: "${product_id || 'N/A'}" | EventID: "${event.id || 'N/A'}"`,
    );

    // 3. Evento de prueba de RevenueCat
    if (type === "TEST") {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Webhook de prueba recibido correctamente.",
      };
      return;
    }

    if (!uid) {
      console.warn("[RevenueCat Webhook] Evento ignorado: No se identificó app_user_id");
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Evento recibido pero sin app_user_id asociado",
      };
      return;
    }

    // 4. Calcular fechas y duración
    const fechaSuscripcion = purchased_at_ms
      ? new Date(purchased_at_ms).toISOString()
      : new Date().toISOString();

    const fechaVencimiento = expiration_at_ms
      ? new Date(expiration_at_ms).toISOString()
      : null;

    let diasDuracion = 30;
    if (purchased_at_ms && expiration_at_ms && expiration_at_ms > purchased_at_ms) {
      diasDuracion = Math.max(
        1,
        Math.round((expiration_at_ms - purchased_at_ms) / (1000 * 60 * 60 * 24)),
      );
    }

    const productIdStr = event.product_id || "";
    const productIdLower = productIdStr.toLowerCase();

    // Detección precisa de consumibles / compras de monedas
    const esCompraMonedas =
      productIdLower.includes("coin") ||
      productIdLower.includes("moneda") ||
      productIdLower.includes("paquete") ||
      productIdLower.includes("sticker") ||
      productIdLower.includes("pack") ||
      (type === "NON_RENEWING_PURCHASE" && !productIdLower.includes("pro") && !productIdLower.includes("sub") && !productIdLower.includes("vip"));

    // 5. Procesar el evento según el tipo
    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "NON_RENEWING_PURCHASE": {
        if (esCompraMonedas) {
          const cantidadMonedasCalculada = resolverCantidadMonedas(productIdStr);

          // 1. Crear transacción en estado 'pendiente'
          const { compra } = await crearRegistroCompraApp({
            idUsuario: uid,
            productId: productIdStr,
            tipoItem: "monedas",
            cantidadMonedas: cantidadMonedasCalculada,
            idCompraRevenueCat: event.id || null,
            transactionIdStore: event.transaction_id || null,
            originalTransactionId: event.original_transaction_id || null,
            store: event.store || "PLAY_STORE",
            entorno: event.environment || "PRODUCTION",
            precio: event.price_in_purchased_currency || null,
            moneda: event.currency || "USD",
            rawEvent: event as Record<string, unknown>,
          });

          // 2. Si ya estaba concluida, no hacer nada
          if (compra.estado === "concluido") {
            console.log(`ℹ️ [RevenueCat Webhook] Compra ${compra.id} ya estaba concluida.`);
            break;
          }

          // 3. Ejecutar entrega atómica de saldo y pasar a estado 'concluido'
          try {
            const resultadoEntrega = await procesarEntregaMonedasCompraApp(compra.id);
            console.log(
              `💰 [RevenueCat Webhook] Compra ${compra.id} concluida exitosamente (+${resultadoEntrega.cantidadAcreditada} monedas para ${uid}). Nuevo saldo: ${resultadoEntrega.nuevoSaldo}`,
            );
          } catch (errorEntrega: any) {
            console.error(`❌ [RevenueCat Webhook] Fallo en entrega de monedas para compra ${compra.id}:`, errorEntrega);
            await marcarProblemaCompraApp(compra.id, "Error en acreditación", errorEntrega?.message);
          }
        } else {
          // Suscripciones de Lector o Escritor
          const esLector =
            productIdLower.includes("lector") ||
            productIdLower.includes("reader") ||
            (event.entitlement_id || "").toLowerCase().includes("lector");
          const tipoSuscripcion = esLector ? "lector" : "escritor";
          const creditosElevenLabs = esLector ? undefined : 15;

          const entitlementId =
            event.entitlement_id ||
            (Array.isArray(event.entitlement_ids) ? event.entitlement_ids[0] : null) ||
            (esLector ? "lector_vip" : "creador_estelar");

          const productId =
            event.product_id ||
            (esLector ? "homero_lector_vip:lector-vip-mensual" : "homero_creador_estelar:creador-estelar-mensual");

          // Activar suscripción
          await actualizarSuscripcionUsuarioService({
            uid,
            nuevaSuscripcion: true,
            entitlementId,
            productId,
            tipo: tipoSuscripcion,
            fechaSuscripcion,
            fechaVencimiento,
            diasDuracion,
            elevensLab: creditosElevenLabs,
            planLector: esLector ? productId : undefined,
            planEscritor: !esLector ? productId : undefined,
          });

          // Registrar en compras_app para trazabilidad completa
          await crearRegistroCompraApp({
            idUsuario: uid,
            productId: productId,
            tipoItem: "suscripcion",
            idCompraRevenueCat: event.id || null,
            transactionIdStore: event.transaction_id || null,
            originalTransactionId: event.original_transaction_id || null,
            store: event.store || "PLAY_STORE",
            entorno: event.environment || "PRODUCTION",
            precio: event.price_in_purchased_currency || null,
            moneda: event.currency || "USD",
            rawEvent: event as Record<string, unknown>,
          });

          console.log(`👑 [RevenueCat Webhook] Suscripción (${entitlementId} | ${productId}) activada/renovada para ${uid}`);
        }
        break;
      }

      // Reembolso / Revocación originado en Google Play / App Store
      case "REVOCATION": {
        console.log(`🔄 [RevenueCat Webhook] Procesando REVOCATION para UID: ${uid} (EventID: ${event.id}) | Producto: ${productIdStr}`);

        if (esCompraMonedas) {
          await procesarReembolsoCompraApp({
            idCompraRevenueCat: event.id,
            transactionIdStore: event.transaction_id,
            originalTransactionId: event.original_transaction_id,
            productId: productIdStr,
            cantidadMonedas: resolverCantidadMonedas(productIdStr),
            uid,
            motivoReembolso: event.cancel_reason || "Revocación de compra en Google Play / Tienda",
            rawEvent: event as Record<string, unknown>,
          });
        } else {
          // Si era una suscripción, revocar acceso
          const entitlementId =
            event.entitlement_id ||
            (Array.isArray(event.entitlement_ids) ? event.entitlement_ids[0] : null) ||
            "lector_vip";

          await actualizarSuscripcionUsuarioService({
            uid,
            nuevaSuscripcion: false,
            entitlementId,
            productId: event.product_id,
            fechaSuscripcion: null,
            fechaVencimiento: new Date().toISOString(),
            diasDuracion: 0,
            elevensLab: 2,
          });
        }
        break;
      }

      case "EXPIRATION": {
        const entitlementId =
          event.entitlement_id ||
          (Array.isArray(event.entitlement_ids) ? event.entitlement_ids[0] : null) ||
          "lector_vip";

        await actualizarSuscripcionUsuarioService({
          uid,
          nuevaSuscripcion: false,
          entitlementId,
          productId: event.product_id,
          fechaSuscripcion: null,
          fechaVencimiento,
          diasDuracion: 0,
          elevensLab: 2,
        });
        console.log(`⌛ [RevenueCat Webhook] Suscripción (${entitlementId}) expirada para ${uid}`);
        break;
      }

      case "CANCELLATION": {
        console.log(
          `❌ [RevenueCat Webhook] Usuario ${uid} canceló renovación. Válido hasta: ${fechaVencimiento || 'fin de ciclo'} (Motivo: ${event.cancel_reason || 'N/A'})`,
        );

        // 1. Si había compras de monedas pendientes para este usuario, marcarlas como canceladas
        try {
          const pendingSnap = await db.collection("compras_app")
            .where("idUsuario", "==", uid)
            .where("estado", "==", "pendiente")
            .limit(5)
            .get();

          for (const doc of pendingSnap.docs) {
            await marcarCanceladoCompraApp(
              doc.id,
              event.cancel_reason || "Compra cancelada o expirada en Google Play"
            );
          }
        } catch (_errCancel) {}

        // 2. Si la cancelación es con reembolso inmediato por atención al cliente de Google Play
        const razon = (event.cancel_reason || "").toUpperCase();
        if (razon.includes("CUSTOMER_SUPPORT") || razon.includes("REFUND") || razon.includes("CHARGEBACK")) {
          if (esCompraMonedas) {
            await procesarReembolsoCompraApp({
              idCompraRevenueCat: event.id,
              transactionIdStore: event.transaction_id,
              originalTransactionId: event.original_transaction_id,
              productId: productIdStr,
              cantidadMonedas: resolverCantidadMonedas(productIdStr),
              uid,
              motivoReembolso: `Cancelación con reembolso (${event.cancel_reason})`,
              rawEvent: event as Record<string, unknown>,
            });
          }
        }
        break;
      }

      case "BILLING_ISSUE": {
        console.warn(`⚠️ [RevenueCat Webhook] Problema de cobro/facturación para UID: ${uid}`);
        try {
          // Buscar compras pendientes del usuario y marcarlas como rechazadas
          const pendingSnap = await db.collection("compras_app")
            .where("idUsuario", "==", uid)
            .where("estado", "==", "pendiente")
            .limit(5)
            .get();

          for (const doc of pendingSnap.docs) {
            await marcarRechazoCompraApp(
              doc.id,
              "Problema de facturación o pago rechazado por el banco en Google Play",
              `Billing issue reportado por RevenueCat (${event.id || 'N/A'})`
            );
          }

          // Notificar al usuario por push para que no se preocupe ni piense que es estafa
          enviarPushAUsuario(
            uid,
            "⚠️ Problema con tu compra en Google Play",
            "Google Play no pudo procesar el pago de tu compra. Revisa tu método de pago para evitar que sea rechazada.",
            {
              tipo: "compra_problema",
              eventId: event.id || "",
            },
          ).catch(() => {});
        } catch (errBilling) {
          console.error("Error al procesar BILLING_ISSUE:", errBilling);
        }
        break;
      }

      default: {
        console.log(`ℹ️ [RevenueCat Webhook] Evento registrado: ${type}`);
        break;
      }
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Evento ${type} procesado exitosamente`,
    };
  } catch (error: unknown) {
    console.error("[RevenueCat Webhook Error]:", error);
    ctx.response.status = 200; // Respondemos 200 para evitar loops destructivos de reintentos
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error interno procesando webhook de RevenueCat",
      error: errorMessage,
    };
  }
};
