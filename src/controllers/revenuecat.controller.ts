import { Context } from "https://deno.land/x/oak/mod.ts";
import { actualizarSuscripcionUsuarioService } from "../service/users.service.ts";

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
  [key: string]: unknown;
}

export interface RevenueCatWebhookPayload {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
}

/**
 * Controller para manejar Webhooks provenientes de RevenueCat
 * Endpoint: POST /api/revenuecat-webhook
 */
export const revenueCatWebhookController = async (ctx: Context) => {
  try {
    // 1. Verificación opcional de Token de autorización
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
    const body: RevenueCatWebhookPayload = await ctx.request.body.json();
    const event = body.event;

    if (!event) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Payload inválido: no se encontró el objeto 'event'",
      };
      return;
    }

    const { type, app_user_id, purchased_at_ms, expiration_at_ms } = event;
    const uid = app_user_id || event.original_app_user_id;

    console.log(`[RevenueCat Webhook] Evento recibido: "${type}" para UID: "${uid}"`);

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

    // 5. Procesar el evento según el tipo
    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
      case "NON_RENEWING_PURCHASE": {
        // Activar suscripción y créditos
        await actualizarSuscripcionUsuarioService(
          uid,
          true,
          true,
          fechaSuscripcion,
          fechaVencimiento,
          diasDuracion,
          15, // 15 audios de ElevenLabs para suscriptores PRO
        );
        console.log(`[RevenueCat Webhook] Suscripción activada/renovada para ${uid}`);
        break;
      }

      case "EXPIRATION": {
        // Desactivar suscripción
        await actualizarSuscripcionUsuarioService(
          uid,
          false,
          false,
          null,
          fechaVencimiento,
          0,
          0,
        );
        console.log(`[RevenueCat Webhook] Suscripción expirada para ${uid}`);
        break;
      }

      case "CANCELLATION": {
        console.log(
          `[RevenueCat Webhook] Usuario ${uid} canceló auto-renovación. Acceso válido hasta: ${fechaVencimiento}`,
        );
        // La suscripción sigue activa hasta 'expiration_at_ms', por lo que no la desactivamos inmediatamente.
        break;
      }

      case "BILLING_ISSUE": {
        console.warn(`[RevenueCat Webhook] Problema de cobro/facturación para UID: ${uid}`);
        break;
      }

      default: {
        console.log(`[RevenueCat Webhook] Evento no manejado específicamente: ${type}`);
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
    ctx.response.status = 500;
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error interno procesando webhook de RevenueCat",
      error: errorMessage,
    };
  }
};
