import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  crearHistoriaController,
  getHistoriaByCustomId,
} from "../controllers/historia.controller.ts";
import {
  crearHistoriaInfoController,
  getCardHistoriasController,
  getCardsPorAutor,
  getHistoriaById,
  getHistoriasPorVistasController,
  incrementarVistas,
} from "../controllers/historiainfo.controller.ts";
import {
  crearCardHistoriaController,
  eliminarCardController,
  eliminarMultimediaController,
  getHistoriaCardById,
  obtenerCardHistoriaController,
} from "../controllers/cardhistoria.controller.ts";
import { generarThumbnailController } from "../controllers/multimedia.controller.ts";
import {
  crearColeccionController,
  eliminarColeccionesPorUid,
  getColeccionesPorId,
  getTodasLasColecciones,
  mostrarColeccionesPorAutorController,
  calificarColeccionController,
  obtenerCalificacionColeccionController,
  eliminarCalificacionColeccionController,
} from "../controllers/coleccion.controller.ts";
import {
  agregarHistoriaAColeccionController,
  getColeccionDetalle,
  reordenarEpisodiosColeccionController,
} from "../controllers/Coleccionids.controller.ts";
import { traducirTexto } from "../controllers/traductor.controller.ts";
import { getCategoriasController } from "../controllers/categorias.controller.ts";
import {
  checkLikeStatus,
  darLikeHistoriaController,
  getHistoriasLiked,
  getLikesCount,
  toggleLike,
} from "../controllers/likeuser.controller.ts";
import {
  getWebSocketStatsController,
  userWebSocketController,
} from "../controllers/userSocket.controller.ts";
import {
  guardarAudio,
  obtenerAudios,
} from "../controllers/audiohistoria.controller.ts";
import {
  getHistoriasVistas,
  registrarVistaUsuario,
} from "../controllers/vistasuser.controller.ts";
import {
  dejarDeSeguir,
  getGenteQueYoSigo,
  seguirUsuario,
} from "../controllers/seguiruser.controller.ts";
import { getGenteQueMeSigue } from "../controllers/seguir.controller.ts";
import {
  actualizarDescripcionUsuario,
  actualizarDiaRachaUsuarioController,
  actualizarFotoUsuario,
  actualizarMarcoUsuarioController,
  actualizarNombreUsuario,
  actualizarSuscripcionUsuario,
  agregarSuscripcionUsuarioController,
  asignarPrivilegiosUsuarioController,
  crearUsuario,
  descontarUsoElevenLabsController,
  editarSuscripcionUsuarioController,
  eliminarSuscripcionUsuarioController,
  getUsuarioPerfil,
  getUsuarios,
  guardarFcmToken,
  migrarEstructuraUsuariosController,
  obtenerDiaRachaUsuarioController,
  obtenerSuscripcionesUsuarioController,
  verificarUsuarioEmail,
} from "../controllers/users.controller.ts";
import { getHistoriaCardByAutor } from "../controllers/cardhistoria.controller.ts";
import {
  eliminarComentario,
  guardarComentario,
  obtenerComentarios,
} from "../controllers/comentarios.controller.ts";
import { checkStoryViewed } from "../controllers/vistasuser.controller.ts";
import { getHistoriasPorCategoria } from "../controllers/categoriahistoria.controller.ts";
import { loginAndSync } from "../controllers/auth.controller.ts";
import {
  detectarIdiomaController,
  generarDescripcionController,
  generarVozAzureController,
  generarVozGeminiController,
  generateMultivoiceAudio,
  obtenerVocesAwsController,
  obtenerVocesAzureController,
  obtenerVocesGeminiController,
  verificarEstadoAzureController,
  verificarEstadoGeminiController,
} from "../controllers/ia.controller.ts";
import {
  crearSonido,
  modificarSonido,
  obtenerSonidoPorId,
  obtenerSonidos,
} from "../controllers/sonido.controller.ts";
import { revenueCatWebhookController } from "../controllers/revenuecat.controller.ts";
import {
  eliminarNotificacion,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  obtenerConteoNoLeidas,
  obtenerNotificacionesUsuario,
} from "../controllers/notificaciones.controller.ts";
import {
  actualizarEstadoReporteController,
  crearReporteController,
  obtenerReportePorIdController,
  obtenerReportesController,
  obtenerReportesUsuarioController,
  responderReporteController,
} from "../controllers/soporte.controller.ts";
import {
  enviarPropinaController,
  obtenerHistorialController,
  obtenerRankingController,
  reclamarRecompensaAnuncioController,
  resetearLimiteAnunciosController,
} from "../controllers/propina.controller.ts";
import {
  consultarEstadoDispositivoController,
  resetearLimiteDispositivoController,
  validarYRecompensarDispositivoController,
} from "../controllers/deviceAdLimit.controller.ts";
import {
  guardarPinBovedaController,
  obtenerPinBovedaController,
} from "../controllers/boveda.controller.ts";
import {
  actualizarEstadoPagoController,
  obtenerPagoPorIdController,
  obtenerPagosUsuarioController,
  obtenerTodosPagosController,
  solicitarRetiroController,
} from "../controllers/pago.controller.ts";
import {
  actualizarEstadoCompraController,
  obtenerCompraPorIdController,
  obtenerComprasUsuarioController,
  obtenerTodasComprasController,
  reembolsarCompraController,
  registrarCompraManualController,
  registrarCompraPendienteController,
  reintentarCompraController,
} from "../controllers/comprasApp.controller.ts";
import { authOpcional, requerirAdmin, requerirAuth } from "../middlewares/auth.middleware.ts";

const router = new Router();

// ============================================================================
// COLECCIONES Y DETALLES
// ============================================================================
router.post("/api/colecciones/crear", requerirAuth, crearColeccionController);
router.get("/api/colecciones/mostrar", authOpcional, mostrarColeccionesPorAutorController);
router.get("/api/colecciones/mostrar/todas", authOpcional, getTodasLasColecciones);
router.get("/api/colecciones/mostrar/:uid", authOpcional, getColeccionesPorId);
router.delete("/api/colecciones/eliminar/:uid", requerirAuth, eliminarColeccionesPorUid);
router.post("/api/coleccion-ids/crear", requerirAuth, agregarHistoriaAColeccionController);
router.get("/api/coleccionesids/mostrar/:docId", authOpcional, getColeccionDetalle);
router.put("/api/coleccionesids/reordenar", requerirAuth, reordenarEpisodiosColeccionController);
router.post("/api/coleccionesids/reordenar", requerirAuth, reordenarEpisodiosColeccionController);
router.put("/api/coleccion-ids/reordenar", requerirAuth, reordenarEpisodiosColeccionController);
router.post("/api/coleccion-ids/reordenar", requerirAuth, reordenarEpisodiosColeccionController);
router.post("/api/colecciones/calificar", requerirAuth, calificarColeccionController);
router.put("/api/colecciones/calificar", requerirAuth, calificarColeccionController);
router.get("/api/colecciones/calificacion/:idColeccion", authOpcional, obtenerCalificacionColeccionController);
router.get("/api/colecciones/calificacion/:idColeccion/:idUsuario", authOpcional, obtenerCalificacionColeccionController);
router.delete("/api/colecciones/calificar", requerirAuth, eliminarCalificacionColeccionController);

// ============================================================================
// HISTORIAS Y CARDS
// ============================================================================
router.post("/api/historias/crear", requerirAuth, crearHistoriaController);
router.get("/api/historia/:id", authOpcional, getHistoriaByCustomId);
router.post("/api/card-historias/crear", requerirAuth, crearCardHistoriaController);
router.post("/api/multimedia/generar-thumbnail", generarThumbnailController);
router.get("/api/card-historias/mostrar", authOpcional, obtenerCardHistoriaController);
router.get("/api/historias-card/mostrar/:idAutor", authOpcional, getHistoriaCardByAutor);
router.get("/api/historias-card/mostrar-id/:id", authOpcional, getHistoriaCardById);
router.delete("/api/card-historias/eliminar/:id", authOpcional, eliminarCardController);
router.delete("/api/multimedia/limpiar/:id", authOpcional, eliminarMultimediaController);

// ============================================================================
// HISTORIAS INFO, VISTAS Y CATEGORÍAS
// ============================================================================
router.post("/api/historias-info/crear", requerirAuth, crearHistoriaInfoController);
router.get("/api/historia-info/:id", authOpcional, getHistoriaById);
router.get("/api/historias-info/autor", authOpcional, getCardsPorAutor);
router.get("/api/historias-info/mostrar", authOpcional, getCardHistoriasController);
router.get("/api/historias-info/most-vistas", authOpcional, getHistoriasPorVistasController);
router.put("/api/historia-info/vistas/:id", incrementarVistas);
router.get("/api/categorias/mostrar", authOpcional, getCategoriasController);
router.get("/api/categoriashistorias/:categoriaId", authOpcional, getHistoriasPorCategoria);

// ============================================================================
// AUDIOS Y TRADUCTOR
// ============================================================================
router.post("/api/traductor", traducirTexto);
router.post("/api/historia/audio/guardar", requerirAuth, guardarAudio);
router.post("/api/historia/audio/obtener", authOpcional, obtenerAudios);

// ============================================================================
// LIKES Y VISTAS DE USUARIOS
// ============================================================================
router.get("/api/likes/status", authOpcional, checkLikeStatus);
router.get("/api/likeuser/likes/:id", authOpcional, getLikesCount);
router.get("/api/likeuser/mostrar/:uid", authOpcional, getHistoriasLiked);
router.post("/api/like-user/like", requerirAuth, toggleLike);
router.post("/api/historias/like", requerirAuth, darLikeHistoriaController);
router.post("/api/vistas-user/registrar", registrarVistaUsuario);
router.get("/api/vistasuser/mostrar/:uid", authOpcional, getHistoriasVistas);
router.get("/api/vistasuser/verificar/:idUsuario/:idHistoria", authOpcional, checkStoryViewed);

// ============================================================================
// SEGUIDORES Y SEGUIDOS
// ============================================================================
router.post("/api/seguiruser/seguir", requerirAuth, seguirUsuario);
router.post("/api/seguir/seguir", requerirAuth, seguirUsuario);
router.post("/api/seguiruser/dejar-seguir", requerirAuth, dejarDeSeguir);
router.post("/api/seguir/dejar-seguir", requerirAuth, dejarDeSeguir);
router.get("/api/seguiruser/seguidores/:uid", authOpcional, getGenteQueMeSigue);
router.get("/api/seguir/seguidores/:uid", authOpcional, getGenteQueMeSigue);
router.get("/api/seguiruser/siguiendo/:uid", authOpcional, getGenteQueYoSigo);
router.get("/api/seguir/siguiendo/:uid", authOpcional, getGenteQueYoSigo);

// ============================================================================
// COMENTARIOS (REST)
// ============================================================================
router.post("/api/comentarios/guardar", requerirAuth, guardarComentario);
router.get("/api/comentarios/obtener/:publicacionId", authOpcional, obtenerComentarios);
router.delete("/api/comentarios/:id", requerirAuth, eliminarComentario);

// ============================================================================
// WEBSOCKET DE USUARIOS EN TIEMPO REAL (SALDO, PERFIL, MONEDAS)
// ============================================================================
router.get("/ws/user", userWebSocketController);
router.get("/ws/user/:uid", userWebSocketController);
router.get("/api/ws/stats", getWebSocketStatsController);

// ============================================================================
// AUTENTICACIÓN Y USUARIOS
// ============================================================================
router.post("/api/auth/google-sync", loginAndSync);
router.get("/api/users/mostrar", authOpcional, getUsuarios);
router.get("/api/users/perfil/:uid", authOpcional, getUsuarioPerfil);
router.get("/api/users/verificar-email/:email", authOpcional, verificarUsuarioEmail);
router.post("/api/users/crear", crearUsuario);
router.put("/api/users/actualizar-nombre", requerirAuth, actualizarNombreUsuario);
router.put("/api/users/actualizar-foto", requerirAuth, actualizarFotoUsuario);
router.put("/api/users/actualizar-descripcion", requerirAuth, actualizarDescripcionUsuario);
router.put("/api/users/actualizar-marco", requerirAuth, actualizarMarcoUsuarioController);
router.put("/api/users/actualizar-marco/:uid", requerirAuth, actualizarMarcoUsuarioController);
router.post("/api/users/guardar-token", guardarFcmToken);

// ============================================================================
// SUSCRIPCIONES DE USUARIO (CRUD COMPLETO: lector_vip, creador_estelar, etc.)
// ============================================================================
router.get("/api/users/suscripciones/:uid", authOpcional, obtenerSuscripcionesUsuarioController);
router.post("/api/users/suscripciones", requerirAdmin, agregarSuscripcionUsuarioController);
router.put("/api/users/suscripciones", requerirAdmin, editarSuscripcionUsuarioController);
router.delete("/api/users/suscripciones/:uid/:entitlementId", requerirAdmin, eliminarSuscripcionUsuarioController);
router.delete("/api/users/suscripciones", requerirAdmin, eliminarSuscripcionUsuarioController);
router.put("/api/users/actualizar-suscripcion", requerirAdmin, actualizarSuscripcionUsuario);

// ============================================================================
// PRIVILEGIOS, RACHA, ELEVENLABS Y MIGRACIÓN
// ============================================================================
router.put("/api/users/asignar-privilegios", requerirAdmin, asignarPrivilegiosUsuarioController);
router.put("/api/users/asignar-privilegios/:uid", requerirAdmin, asignarPrivilegiosUsuarioController);
router.post("/api/users/dia-racha", requerirAuth, actualizarDiaRachaUsuarioController);
router.get("/api/users/dia-racha/:uid", authOpcional, obtenerDiaRachaUsuarioController);
router.post("/api/users/descontar-elevenslab", requerirAuth, descontarUsoElevenLabsController);
router.post("/api/users/migrar-estructura", requerirAdmin, migrarEstructuraUsuariosController);

// ============================================================================
// REVENUECAT WEBHOOK
// ============================================================================
router.post("/api/revenuecat-webhook", revenueCatWebhookController);
router.post("/api/revenuecat/webhook", revenueCatWebhookController);
router.post("/api/webhook/revenuecat", revenueCatWebhookController);

// ============================================================================
// SONIDOS
// ============================================================================
router.post("/api/sonido/crear", requerirAdmin, crearSonido);
router.get("/api/sonido/obtener", authOpcional, obtenerSonidos);
router.get("/api/sonido/obtener/:id", authOpcional, obtenerSonidoPorId);
router.put("/api/sonido/modificar/:id", requerirAdmin, modificarSonido);

// ============================================================================
// INTELIGENCIA ARTIFICIAL (IA)
// ============================================================================
router.post("/api/ia/multivoz", generateMultivoiceAudio);
router.get("/api/ia/aws-voces", authOpcional, obtenerVocesAwsController);
router.post("/api/ia/gemini-voz", generarVozGeminiController);
router.get("/api/ia/gemini-voces", authOpcional, obtenerVocesGeminiController);
router.get("/api/ia/gemini-estado", authOpcional, verificarEstadoGeminiController);
router.get("/api/ia/azure-estado", authOpcional, verificarEstadoAzureController);
router.get("/api/ia/azure-voces", authOpcional, obtenerVocesAzureController);
router.post("/api/ia/azure-voz", generarVozAzureController);
router.post("/api/ia/detectar-idioma", detectarIdiomaController);
router.post("/api/ia/generar-descripcion", generarDescripcionController);

// ============================================================================
// NOTIFICACIONES
// ============================================================================
router.get("/api/notificaciones/:uid", authOpcional, obtenerNotificacionesUsuario);
router.get("/api/notificaciones/no-leidas/:uid", authOpcional, obtenerConteoNoLeidas);
router.put("/api/notificaciones/marcar-leida/:id", requerirAuth, marcarNotificacionLeida);
router.put("/api/notificaciones/marcar-todas-leidas/:uid", requerirAuth, marcarTodasNotificacionesLeidas);
router.delete("/api/notificaciones/eliminar/:id", requerirAuth, eliminarNotificacion);

// ============================================================================
// SOPORTE Y REPORTES DE ERROR
// ============================================================================
router.post("/api/soporte/reporte", requerirAuth, crearReporteController);
router.get("/api/soporte/reportes", authOpcional, obtenerReportesController);
router.get("/api/soporte/reportes/usuario/:uid", authOpcional, obtenerReportesUsuarioController);
router.get("/api/soporte/reporte/:id", authOpcional, obtenerReportePorIdController);
router.post("/api/soporte/reporte/:id/responder", requerirAuth, responderReporteController);
router.put("/api/soporte/reporte/:id/estado", requerirAdmin, actualizarEstadoReporteController);

// ============================================================================
// PROPINAS, PAGOS / RETIROS, HISTORIAL Y RANKING
// ============================================================================
router.post("/api/enviar-propina", requerirAuth, enviarPropinaController);
router.post("/api/pagos/solicitar-retiro", requerirAuth, solicitarRetiroController);
router.get("/api/pagos", authOpcional, obtenerTodosPagosController);
router.get("/api/pagos/usuario/:uid", authOpcional, obtenerPagosUsuarioController);
router.get("/api/pagos/:id", authOpcional, obtenerPagoPorIdController);
router.put("/api/pagos/:id/estado", requerirAdmin, actualizarEstadoPagoController);
router.get("/api/historial/:uid", authOpcional, obtenerHistorialController);
router.get("/api/ranking", authOpcional, obtenerRankingController);

// ============================================================================
// COMPRAS DE LA APP (IN-APP PURCHASES - REVENUECAT / GOOGLE PLAY)
// ============================================================================
router.get("/api/compras-app", authOpcional, obtenerTodasComprasController);
router.get("/api/compras-app/usuario/:uid", authOpcional, obtenerComprasUsuarioController);
router.get("/api/compras-app/:id", authOpcional, obtenerCompraPorIdController);
router.post("/api/compras-app/pendiente", registrarCompraPendienteController);
router.post("/api/compras-app/iniciar", registrarCompraPendienteController);
router.post("/api/compras-app/:id/reintentar", reintentarCompraController);
router.post("/api/compras-app/:id/reembolsar", requerirAdmin, reembolsarCompraController);
router.post("/api/compras-app/reembolsar", requerirAdmin, reembolsarCompraController);
router.put("/api/compras-app/:id/estado", requerirAdmin, actualizarEstadoCompraController);
router.post("/api/compras-app/manual", requerirAdmin, registrarCompraManualController);

// ============================================================================
// RECOMPENSAS DE ANUNCIOS Y CONTROL DE DISPOSITIVOS FÍSICOS
// ============================================================================
router.post("/api/anuncios/recompensar", reclamarRecompensaAnuncioController);
router.post("/api/anuncios/reset-limite/:uid", requerirAdmin, resetearLimiteAnunciosController);
router.post("/api/device-ad-limits/recompensar", validarYRecompensarDispositivoController);
router.get("/api/device-ad-limits/:deviceId", consultarEstadoDispositivoController);
router.post("/api/device-ad-limits/:deviceId/reset", requerirAdmin, resetearLimiteDispositivoController);

// ============================================================================
// BÓVEDA / PIN DE SEGURIDAD
// ============================================================================
router.get("/api/boveda/pin/:uid", obtenerPinBovedaController);
router.post("/api/boveda/guardar-pin", requerirAuth, guardarPinBovedaController);

export default router;
