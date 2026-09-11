import { assertEquals } from "@std/assert";
import {
  actualizarDiaRachaUsuarioController,
  actualizarMarcoUsuarioController,
  actualizarSuscripcionUsuario,
  asignarPrivilegiosUsuarioController,
  descontarUsoElevenLabsController,
  guardarFcmToken,
  obtenerDiaRachaUsuarioController,
} from "../controllers/users.controller.ts";
import {
  normalizarUsuarioDoc,
  esMarcoPro,
  esMarcoVip,
  esMarcoDeSuscripcion,
  debeRemoverMarcoPorSuscripcion,
} from "../service/users.service.ts";

function createMockContext(
  bodyData: any = {},
  params: any = {},
  searchParams: Record<string, string> = {},
) {
  const urlParams = new URLSearchParams(searchParams);
  const ctx: any = {
    params,
    request: {
      url: new URL(`http://localhost:8000/api/test?${urlParams.toString()}`),
      body: {
        json: () => Promise.resolve(bodyData),
      },
    },
    response: {
      status: 200,
      body: {},
    },
  };
  return ctx;
}

// ----------------------------------------------------
// PRUEBAS DE NORMALIZACIÓN DEL ESQUEMA MODULAR DE USUARIOS
// ----------------------------------------------------

Deno.test("Normalización Usuario: Convierte documento plano al esquema modular exacto", () => {
  const usuarioPlano = {
    uid: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
    name: "Userd0e575",
    email: "llacuayasue@gmail.com",
    photoURL: "https://ejemplo.com/foto.jpg",
    descripcion: "Soy creador original de homero",
    rol: "usuario",
    verificado: false,
    suscription: false,
    fechaSuscripcion: "2026-09-09T21:23:07.606Z",
    fechaVencimiento: null,
    walletBalance: 17700,
    ElevensLab: 19,
    mesRecargaFreeElevenLabs: "2026-09",
    anunciosVistosHoy: 3,
    fechaUltimoAnuncio: "2026-09-10",
    fcmToken: "token_fcm_123",
    ultimoDeviceId: "dev_xyz_999",
    bovedaPin: "6666",
    fechaRegistro: "2026-09-09T21:00:00.000Z",
  };

  const modular = normalizarUsuarioDoc(usuarioPlano, usuarioPlano.uid);

  // 1. Validar campos de raíz
  assertEquals(modular.uid, "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1");

  // 2. Validar sub-objeto perfil
  assertEquals(modular.perfil.name, "Userd0e575");
  assertEquals(modular.perfil.email, "llacuayasue@gmail.com");
  assertEquals(modular.perfil.descripcion, "Soy creador original de homero");
  assertEquals(modular.perfil.rol, "usuario");
  assertEquals(modular.perfil.verificado, false);

  // 3. Validar array de suscripciones exclusivo
  assertEquals(Array.isArray(modular.suscripciones), true);
  assertEquals(modular.suscripciones.length, 0);

  // 4. Validar sub-objeto billetera
  assertEquals(modular.billetera.walletBalance, 17700);
  assertEquals(modular.billetera.elevensLab, 19);
  assertEquals(modular.billetera.mesRecargaFreeElevenLabs, "2026-09");

  // 5. Validar sub-objeto actividadDiaria
  assertEquals(modular.actividadDiaria.anunciosVistosHoy, 3);
  assertEquals(modular.actividadDiaria.fechaUltimoAnuncio, "2026-09-10");

  // 6. Validar sub-objeto sistema
  assertEquals(modular.sistema.fcmToken, "token_fcm_123");
  assertEquals(modular.sistema.ultimoDeviceId, "dev_xyz_999");
  assertEquals(modular.sistema.bovedaPin, "6666");

  // 7. Asegurar que NO existen campos duplicados en la raíz ni mapas repetidos
  assertEquals((modular as any).suscription, undefined);
  assertEquals((modular as any).suscripcion, undefined);
  assertEquals((modular as any).name, undefined);
  assertEquals((modular as any).email, undefined);
  assertEquals((modular as any).photoURL, undefined);
  assertEquals((modular as any).walletBalance, undefined);
  assertEquals((modular as any).ElevensLab, undefined);
  assertEquals((modular as any).fcmToken, undefined);
  assertEquals((modular as any).sistema.fcm_token, undefined);
});

Deno.test("Normalización Usuario: Maneja array de suscripciones múltiples (lector_vip y creador_estelar)", () => {
  const usuarioConArraySuscripciones = {
    uid: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
    perfil: {
      name: "Userd0e575",
      email: "llacuayasue@gmail.com",
      photoURL: "...",
      descripcion: "Soy creador original de homero",
      rol: "usuario",
      verificado: false,
    },
    suscripciones: [
      {
        entitlementId: "lector_vip",
        productId: "homero_lector_vip:lector-vip-mensual",
        activo: true,
        fechaSuscripcion: "2026-09-09T21:23:07.606Z",
        fechaVencimiento: "2026-10-09T21:23:07.606Z",
      },
      {
        entitlementId: "creador_estelar",
        productId: "homero_creador_estelar:creador-estelar-mensual",
        activo: true,
        fechaSuscripcion: "2026-09-10T10:00:00.000Z",
        fechaVencimiento: "2026-10-10T10:00:00.000Z",
      },
    ],
    billetera: {
      walletBalance: 17700,
      elevensLab: 19,
      mesRecargaFreeElevenLabs: "2026-09",
    },
    actividadDiaria: {
      anunciosVistosHoy: 3,
      fechaUltimoAnuncio: "2026-09-10",
    },
    sistema: {
      fcmToken: "token_abc_789",
      ultimoDeviceId: "...",
      bovedaPin: "6666",
      fechaRegistro: "2026-09-09T21:00:00.000Z",
    },
  };

  const res = normalizarUsuarioDoc(usuarioConArraySuscripciones, usuarioConArraySuscripciones.uid);

  assertEquals(Array.isArray(res.suscripciones), true);
  assertEquals(res.suscripciones.length, 2);
  assertEquals(res.suscripciones[0].entitlementId, "lector_vip");
  assertEquals(res.suscripciones[0].activo, true);
  assertEquals(res.suscripciones[1].entitlementId, "creador_estelar");
  assertEquals(res.suscripciones[1].activo, true);
  assertEquals(res.billetera.elevensLab, 19);

  // Asegurar que no hay duplicación
  assertEquals((res as any).suscription, undefined);
  assertEquals((res as any).suscripcion, undefined);
  assertEquals((res as any).sistema.fcm_token, undefined);
});

// ----------------------------------------------------
// PRUEBAS DE PRIVILEGIOS DE USUARIO (CONTROLADOR)
// ----------------------------------------------------

Deno.test("Privilegios Usuario: Requiere UID o Email", async () => {
  const ctx = createMockContext({ suscription: true, verificado: true });
  await asignarPrivilegiosUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Se requiere 'uid' o 'email' del usuario");
});

// ----------------------------------------------------
// PRUEBAS DE ACTUALIZACIÓN DE SUSCRIPCIÓN (CONTROLADOR)
// ----------------------------------------------------

Deno.test("Actualizar Suscripción: Valida parámetros requeridos", async () => {
  const ctx = createMockContext({ uid: "user_test_sub" });
  await actualizarSuscripcionUsuario(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Faltan datos requeridos: uid o nuevaSuscripcion");
});

// ----------------------------------------------------
// PRUEBAS DE ACTUALIZACIÓN DE MARCO DE PERFIL
// ----------------------------------------------------

Deno.test("Actualizar Marco: Falla si no se proporciona userId o uid", async () => {
  const ctx = createMockContext({
    frame: { id: "marco_oro", src: "https://ejemplo.com/marco_oro.png" },
  });
  await actualizarMarcoUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: userId o uid");
});

// ----------------------------------------------------
// PRUEBAS DE GUARDAR FCM TOKEN
// ----------------------------------------------------

Deno.test("Guardar FCM Token: Falla si falta uid o token", async () => {
  const ctx = createMockContext({ uid: "user_test_123" });
  await guardarFcmToken(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta uid o fcmToken (o fcm_token)");
});

// ----------------------------------------------------
// PRUEBAS DE DÍA DE RACHA
// ----------------------------------------------------

Deno.test("Día de Racha: Falla si no se proporciona UID", async () => {
  const ctx = createMockContext({ dia_racha: 3 });
  await actualizarDiaRachaUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: uid o userId");
});

Deno.test("Obtener Día de Racha: Falla si no se proporciona UID", async () => {
  const ctx = createMockContext({});
  await obtenerDiaRachaUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: uid o userId");
});

// ----------------------------------------------------
// PRUEBAS DE CONSUMO ELEVENSLAB
// ----------------------------------------------------

Deno.test("Consumir ElevenLabs: Falla si no se proporciona UID", async () => {
  const ctx = createMockContext({});
  await descontarUsoElevenLabsController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: uid o userId");
});

// ----------------------------------------------------
// PRUEBAS DE CRUD DE SUSCRIPCIONES (CONTROLADORES)
// ----------------------------------------------------

Deno.test("Obtener Suscripciones (GET): Falla si no se proporciona UID", async () => {
  const { obtenerSuscripcionesUsuarioController } = await import("../controllers/users.controller.ts");
  const ctx = createMockContext({});
  await obtenerSuscripcionesUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: uid o userId");
});

Deno.test("Agregar Suscripción (POST): Falla si falta UID o entitlementId", async () => {
  const { agregarSuscripcionUsuarioController } = await import("../controllers/users.controller.ts");
  
  // Falta entitlementId
  const ctx1 = createMockContext({ uid: "user_test_sub_1" });
  await agregarSuscripcionUsuarioController(ctx1);
  assertEquals(ctx1.response.status, 400);
  assertEquals(ctx1.response.body.success, false);
  assertEquals(ctx1.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");

  // Falta uid
  const ctx2 = createMockContext({ entitlementId: "lector_vip" });
  await agregarSuscripcionUsuarioController(ctx2);
  assertEquals(ctx2.response.status, 400);
  assertEquals(ctx2.response.body.success, false);
  assertEquals(ctx2.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");
});

Deno.test("Editar Suscripción (PUT): Falla si falta UID o entitlementId", async () => {
  const { editarSuscripcionUsuarioController } = await import("../controllers/users.controller.ts");
  
  // Falta entitlementId
  const ctx1 = createMockContext({ uid: "user_test_sub_2", activo: true });
  await editarSuscripcionUsuarioController(ctx1);
  assertEquals(ctx1.response.status, 400);
  assertEquals(ctx1.response.body.success, false);
  assertEquals(ctx1.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");

  // Falta uid
  const ctx2 = createMockContext({ entitlementId: "creador_estelar", activo: false });
  await editarSuscripcionUsuarioController(ctx2);
  assertEquals(ctx2.response.status, 400);
  assertEquals(ctx2.response.body.success, false);
  assertEquals(ctx2.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");
});

Deno.test("Eliminar Suscripción (DELETE): Falla si falta UID o entitlementId", async () => {
  const { eliminarSuscripcionUsuarioController } = await import("../controllers/users.controller.ts");
  
  // Falta entitlementId
  const ctx1 = createMockContext({}, { uid: "user_test_sub_3" });
  await eliminarSuscripcionUsuarioController(ctx1);
  assertEquals(ctx1.response.status, 400);
  assertEquals(ctx1.response.body.success, false);
  assertEquals(ctx1.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");

  // Falta uid
  const ctx2 = createMockContext({}, { entitlementId: "lector_vip" });
  await eliminarSuscripcionUsuarioController(ctx2);
  assertEquals(ctx2.response.status, 400);
  assertEquals(ctx2.response.body.success, false);
  assertEquals(ctx2.response.body.message, "Faltan datos requeridos: 'uid' y 'entitlementId'");
});

// ----------------------------------------------------
// PRUEBAS DE DETECCIÓN Y RETIRO DE MARCOS EXCLUSIVOS (PRO Y VIP)
// ----------------------------------------------------

Deno.test("Marcos Suscripción: Identificación correcta de Marco PRO y Marco VIP", () => {
  // Marco PRO
  assertEquals(esMarcoPro("pro_gold"), true);
  assertEquals(esMarcoPro("marco_pro"), true);
  assertEquals(esMarcoPro("/images/badges/marco_pro.png"), true);
  assertEquals(esMarcoPro("pro"), true);
  assertEquals(esMarcoPro("vip_gold"), false);
  assertEquals(esMarcoPro("racha_green"), false);
  assertEquals(esMarcoPro("verificado_diamond"), false);
  assertEquals(esMarcoPro(null), false);

  // Marco VIP
  assertEquals(esMarcoVip("vip_gold"), true);
  assertEquals(esMarcoVip("marco_vip"), true);
  assertEquals(esMarcoVip("/images/badges/marco_vip.png"), true);
  assertEquals(esMarcoVip("vip"), true);
  assertEquals(esMarcoVip("pro_gold"), false);
  assertEquals(esMarcoVip("racha_red"), false);
  assertEquals(esMarcoVip(null), false);

  // Exclusivos de suscripción (PRO o VIP)
  assertEquals(esMarcoDeSuscripcion("pro_gold"), true);
  assertEquals(esMarcoDeSuscripcion("vip_gold"), true);
  assertEquals(esMarcoDeSuscripcion("marco_pro"), true);
  assertEquals(esMarcoDeSuscripcion("marco_vip"), true);
  assertEquals(esMarcoDeSuscripcion("racha_purple"), false);
  assertEquals(esMarcoDeSuscripcion("none"), false);
  assertEquals(esMarcoDeSuscripcion(null), false);
});

Deno.test("Marcos Suscripción: Retiro automático cuando el usuario pierde su suscripción", () => {
  // 1. Usuario sin ninguna suscripción activa -> DEBE retirar marcos PRO y VIP
  assertEquals(debeRemoverMarcoPorSuscripcion("pro_gold", false, false, false), true);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_pro", false, false, false), true);
  assertEquals(debeRemoverMarcoPorSuscripcion("vip_gold", false, false, false), true);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_vip", false, false, false), true);

  // Marcos de racha o verificado NO se deben retirar por falta de suscripción
  assertEquals(debeRemoverMarcoPorSuscripcion("racha_purple", false, false, false), false);
  assertEquals(debeRemoverMarcoPorSuscripcion("verificado_diamond", false, false, false), false);
  assertEquals(debeRemoverMarcoPorSuscripcion(null, false, false, false), false);

  // 2. Usuario con LECTOR VIP activo solamente (sin creador/escritor)
  // Marco VIP se mantiene
  assertEquals(debeRemoverMarcoPorSuscripcion("vip_gold", true, false, true), false);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_vip", true, false, true), false);
  // Marco PRO debe ser retirado (no tiene escritor activo)
  assertEquals(debeRemoverMarcoPorSuscripcion("pro_gold", true, false, true), true);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_pro", true, false, true), true);

  // 3. Usuario con ESCRITOR/CREADOR PRO activo solamente (sin lector)
  // Marco PRO se mantiene
  assertEquals(debeRemoverMarcoPorSuscripcion("pro_gold", true, true, false), false);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_pro", true, true, false), false);
  // Marco VIP debe ser retirado (no tiene lector activo)
  assertEquals(debeRemoverMarcoPorSuscripcion("vip_gold", true, true, false), true);
  assertEquals(debeRemoverMarcoPorSuscripcion("marco_vip", true, true, false), true);

  // 4. Usuario con ambas suscripciones activas -> conserva cualquiera
  assertEquals(debeRemoverMarcoPorSuscripcion("pro_gold", true, true, true), false);
  assertEquals(debeRemoverMarcoPorSuscripcion("vip_gold", true, true, true), false);
});

