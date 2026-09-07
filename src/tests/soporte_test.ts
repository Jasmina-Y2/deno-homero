import { assertEquals, assertExists } from "@std/assert";
import { normalizarReporteSoporte } from "../service/soporte.service.ts";
import {
  actualizarEstadoReporteController,
  crearReporteController,
  obtenerReportePorIdController,
  obtenerReportesUsuarioController,
  responderReporteController,
} from "../controllers/soporte.controller.ts";

function createMockContext(
  bodyData: any = {},
  params: any = {},
  searchParams: Record<string, string> = {},
  method: string = "GET",
) {
  const urlParams = new URLSearchParams(searchParams);
  const ctx: any = {
    params,
    request: {
      method,
      hasBody: Object.keys(bodyData).length > 0,
      url: new URL(`http://localhost:8000/api/soporte/test?${urlParams.toString()}`),
      body: () => ({
        type: "json",
        value: Promise.resolve(bodyData),
      }),
    },
    response: {
      status: 200,
      body: {},
    },
  };
  return ctx;
}

// ----------------------------------------------------
// PRUEBAS DE NORMALIZACIÓN DE METADATA Y MENSAJES
// ----------------------------------------------------

Deno.test("Soporte Service: Normaliza tickets antiguos sin metadata.mensajes", () => {
  const legacyData = {
    uid: "iukHLbhCVpcbw8F0U1J6xf1ZFqY2",
    nombreUsuario: "MANTE",
    email: "mantequilla811@gmail.com",
    categoria: "solicitud_retiro",
    asunto: "Solicito retiro de fondos (7,000 monedas ≈ $11.76 USD)",
    descripcion: "Hola equipo de Homero, solicito el retiro de mis ganancias.",
    respuesta: "Hola, compártenos tu número de cuenta bancaria o PayPal.",
    respondidoPor: "Userd0e575",
    estado: "respondido",
    fecha: "2026-09-07T06:04:10.068Z",
    fechaRespuesta: "2026-09-07T06:08:57.556Z",
    metadata: {},
  };

  const normalizado = normalizarReporteSoporte("ticket_123", legacyData);

  assertEquals(normalizado.id, "ticket_123");
  assertExists(normalizado.metadata);
  assertExists(normalizado.metadata?.mensajes);
  assertEquals(normalizado.metadata?.mensajes?.length, 2);

  // Primer mensaje: Usuario
  const msg1 = normalizado.metadata?.mensajes?.[0];
  assertEquals(msg1?.remitente, "usuario");
  assertEquals(msg1?.autorNombre, "MANTE");
  assertEquals(msg1?.texto, "Hola equipo de Homero, solicito el retiro de mis ganancias.");

  // Segundo mensaje: Soporte
  const msg2 = normalizado.metadata?.mensajes?.[1];
  assertEquals(msg2?.remitente, "soporte");
  assertEquals(msg2?.autorNombre, "Userd0e575");
  assertEquals(msg2?.texto, "Hola, compártenos tu número de cuenta bancaria o PayPal.");

  assertEquals(normalizado.metadata?.ultimoRemitente, "soporte");
  assertEquals(normalizado.metadata?.ultimoMensaje, "Hola, compártenos tu número de cuenta bancaria o PayPal.");
});

Deno.test("Soporte Service: Mantiene estructura de mensajes modernos con comprobante", () => {
  const modernData = {
    uid: "user_789",
    nombreUsuario: "Alex",
    categoria: "solicitud_retiro",
    asunto: "Retiro de fondos",
    descripcion: "Solicitud de retiro",
    estado: "resuelto",
    comprobanteUrl: "https://storage.googleapis.com/homero/comprobante_123.jpg",
    metadata: {
      mensajes: [
        {
          id: "msg_1",
          remitente: "usuario",
          autorId: "user_789",
          autorNombre: "Alex",
          texto: "Solicito mi retiro a PayPal alex@paypal.com",
          fecha: "2026-09-07T06:00:00Z",
        },
        {
          id: "msg_2",
          remitente: "soporte",
          autorNombre: "Admin Homero",
          texto: "Pago realizado con éxito.",
          fecha: "2026-09-07T06:10:00Z",
          comprobanteUrl: "https://storage.googleapis.com/homero/comprobante_123.jpg",
        },
      ],
      ultimoMensaje: "Pago realizado con éxito.",
      ultimoRemitente: "soporte",
      comprobanteUrl: "https://storage.googleapis.com/homero/comprobante_123.jpg",
    },
  };

  const normalizado = normalizarReporteSoporte("ticket_modern_1", modernData);

  assertEquals(normalizado.metadata?.mensajes?.length, 2);
  assertEquals(normalizado.comprobanteUrl, "https://storage.googleapis.com/homero/comprobante_123.jpg");
  assertEquals(normalizado.metadata?.mensajes?.[1].comprobanteUrl, "https://storage.googleapis.com/homero/comprobante_123.jpg");
});

// ----------------------------------------------------
// PRUEBAS DE CONTROLADORES
// ----------------------------------------------------

Deno.test("Soporte Controller: Valida asunto o descripción requeridos al crear", async () => {
  const ctx = createMockContext({}, {}, {}, "POST");
  await crearReporteController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.ok, false);
  assertEquals(ctx.response.body.message, "El asunto o la descripción del reporte son obligatorios");
});

Deno.test("Soporte Controller: Valida UID requerido al consultar reportes de usuario", async () => {
  const ctx = createMockContext({}, { uid: "" }, {});
  await obtenerReportesUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.ok, false);
});

Deno.test("Soporte Controller: Valida ID requerido al consultar reporte individual", async () => {
  const ctx = createMockContext({}, { id: "" }, {});
  await obtenerReportePorIdController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.ok, false);
});

Deno.test("Soporte Controller: Valida texto o comprobante requerido al responder", async () => {
  const ctx = createMockContext({ respuesta: "" }, { id: "ticket_abc" }, {}, "POST");
  await responderReporteController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.ok, false);
});

Deno.test("Soporte Controller: Valida estados válidos al actualizar estado", async () => {
  const ctx = createMockContext({ estado: "estado_invalido" }, { id: "ticket_abc" }, {}, "PUT");
  await actualizarEstadoReporteController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.ok, false);
});
