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
import {
  crearColeccionController,
  eliminarColeccionesPorUid,
  getColeccionesPorId,
  getTodasLasColecciones,
  mostrarColeccionesPorAutorController,
} from "../controllers/coleccion.controller.ts";
import {
  agregarHistoriaAColeccionController,
  getColeccionDetalle,
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
  comentariosWebSocketController,
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

const router = new Router();

// ============================================================================
// COLECCIONES Y DETALLES
// ============================================================================
router.post("/api/colecciones/crear", crearColeccionController);
router.get("/api/colecciones/mostrar", mostrarColeccionesPorAutorController);
router.get("/api/colecciones/mostrar/todas", getTodasLasColecciones);
router.get("/api/colecciones/mostrar/:uid", getColeccionesPorId);
router.delete("/api/colecciones/eliminar/:uid", eliminarColeccionesPorUid);
router.post("/api/coleccion-ids/crear", agregarHistoriaAColeccionController);
router.get("/api/coleccionesids/mostrar/:docId", getColeccionDetalle);

// ============================================================================
// HISTORIAS Y CARDS
// ============================================================================
router.post("/api/historias/crear", crearHistoriaController);
router.get("/api/historia/:id", getHistoriaByCustomId);
router.post("/api/card-historias/crear", crearCardHistoriaController);
router.get("/api/card-historias/mostrar", obtenerCardHistoriaController);
router.get("/api/historias-card/mostrar/:idAutor", getHistoriaCardByAutor);
router.get("/api/historias-card/mostrar-id/:id", getHistoriaCardById);
router.delete("/api/card-historias/eliminar/:id", eliminarCardController);
router.delete("/api/multimedia/limpiar/:id", eliminarMultimediaController);

// ============================================================================
// HISTORIAS INFO, VISTAS Y CATEGORÍAS
// ============================================================================
router.post("/api/historias-info/crear", crearHistoriaInfoController);
router.get("/api/historia-info/:id", getHistoriaById);
router.get("/api/historias-info/autor", getCardsPorAutor);
router.get("/api/historias-info/mostrar", getCardHistoriasController);
router.get("/api/historias-info/most-vistas", getHistoriasPorVistasController);
router.put("/api/historia-info/vistas/:id", incrementarVistas);
router.get("/api/categorias/mostrar", getCategoriasController);
router.get("/api/categoriashistorias/:categoriaId", getHistoriasPorCategoria);

// ============================================================================
// AUDIOS Y TRADUCTOR
// ============================================================================
router.post("/api/traductor", traducirTexto);
router.post("/api/historia/audio/guardar", guardarAudio);
router.post("/api/historia/audio/obtener", obtenerAudios);

// ============================================================================
// LIKES Y VISTAS DE USUARIOS
// ============================================================================
router.get("/api/likes/status", checkLikeStatus);
router.get("/api/likeuser/likes/:id", getLikesCount);
router.get("/api/likeuser/mostrar/:uid", getHistoriasLiked);
router.post("/api/like-user/like", toggleLike);
router.post("/api/historias/like", darLikeHistoriaController);
router.post("/api/vistas-user/registrar", registrarVistaUsuario);
router.get("/api/vistasuser/mostrar/:uid", getHistoriasVistas);
router.get("/api/vistasuser/verificar/:idUsuario/:idHistoria", checkStoryViewed);

// ============================================================================
// SEGUIDORES Y SEGUIDOS
// ============================================================================
router.post("/api/seguiruser/seguir", seguirUsuario);
router.post("/api/seguiruser/dejar-seguir", dejarDeSeguir);
router.get("/api/seguiruser/seguidores/:uid", getGenteQueMeSigue);
router.get("/api/seguir/siguiendo/:uid", getGenteQueYoSigo);

// ============================================================================
// COMENTARIOS (REST + WEBSOCKET EN TIEMPO REAL)
// ============================================================================
router.get("/ws/comentarios", comentariosWebSocketController);
router.post("/api/comentarios/guardar", guardarComentario);
router.get("/api/comentarios/obtener/:publicacionId", obtenerComentarios);
router.delete("/api/comentarios/:id", eliminarComentario);

// ============================================================================
// AUTENTICACIÓN Y USUARIOS
// ============================================================================
router.post("/api/auth/google-sync", loginAndSync);
router.get("/api/users/mostrar", getUsuarios);
router.get("/api/users/perfil/:uid", getUsuarioPerfil);
router.get("/api/users/verificar-email/:email", verificarUsuarioEmail);
router.post("/api/users/crear", crearUsuario);
router.put("/api/users/actualizar-nombre", actualizarNombreUsuario);
router.put("/api/users/actualizar-foto", actualizarFotoUsuario);
router.put("/api/users/actualizar-descripcion", actualizarDescripcionUsuario);
router.put("/api/users/actualizar-marco", actualizarMarcoUsuarioController);
router.put("/api/users/actualizar-marco/:uid", actualizarMarcoUsuarioController);
router.post("/api/users/guardar-token", guardarFcmToken);

// ============================================================================
// SUSCRIPCIONES DE USUARIO (CRUD COMPLETO: lector_vip, creador_estelar, etc.)
// ============================================================================
router.get("/api/users/suscripciones/:uid", obtenerSuscripcionesUsuarioController);
router.post("/api/users/suscripciones", agregarSuscripcionUsuarioController);
router.put("/api/users/suscripciones", editarSuscripcionUsuarioController);
router.delete("/api/users/suscripciones/:uid/:entitlementId", eliminarSuscripcionUsuarioController);
router.delete("/api/users/suscripciones", eliminarSuscripcionUsuarioController);
router.put("/api/users/actualizar-suscripcion", actualizarSuscripcionUsuario);

// ============================================================================
// PRIVILEGIOS, RACHA, ELEVENLABS Y MIGRACIÓN
// ============================================================================
router.put("/api/users/asignar-privilegios", asignarPrivilegiosUsuarioController);
router.put("/api/users/asignar-privilegios/:uid", asignarPrivilegiosUsuarioController);
router.post("/api/users/dia-racha", actualizarDiaRachaUsuarioController);
router.get("/api/users/dia-racha/:uid", obtenerDiaRachaUsuarioController);
router.post("/api/users/descontar-elevenslab", descontarUsoElevenLabsController);
router.post("/api/users/migrar-estructura", migrarEstructuraUsuariosController);

// ============================================================================
// REVENUECAT WEBHOOK
// ============================================================================
router.post("/api/revenuecat-webhook", revenueCatWebhookController);

// ============================================================================
// SONIDOS
// ============================================================================
router.post("/api/sonido/crear", crearSonido);
router.get("/api/sonido/obtener", obtenerSonidos);
router.get("/api/sonido/obtener/:id", obtenerSonidoPorId);
router.put("/api/sonido/modificar/:id", modificarSonido);

// ============================================================================
// INTELIGENCIA ARTIFICIAL (IA)
// ============================================================================
router.post("/api/ia/multivoz", generateMultivoiceAudio);
router.get("/api/ia/aws-voces", obtenerVocesAwsController);
router.post("/api/ia/gemini-voz", generarVozGeminiController);
router.get("/api/ia/gemini-voces", obtenerVocesGeminiController);
router.get("/api/ia/gemini-estado", verificarEstadoGeminiController);
router.get("/api/ia/azure-estado", verificarEstadoAzureController);
router.get("/api/ia/azure-voces", obtenerVocesAzureController);
router.post("/api/ia/azure-voz", generarVozAzureController);
router.post("/api/ia/detectar-idioma", detectarIdiomaController);
router.post("/api/ia/generar-descripcion", generarDescripcionController);

// ============================================================================
// NOTIFICACIONES
// ============================================================================
router.get("/api/notificaciones/:uid", obtenerNotificacionesUsuario);
router.get("/api/notificaciones/no-leidas/:uid", obtenerConteoNoLeidas);
router.put("/api/notificaciones/marcar-leida/:id", marcarNotificacionLeida);
router.put("/api/notificaciones/marcar-todas-leidas/:uid", marcarTodasNotificacionesLeidas);
router.delete("/api/notificaciones/eliminar/:id", eliminarNotificacion);

// ============================================================================
// SOPORTE Y REPORTES DE ERROR
// ============================================================================
router.post("/api/soporte/reporte", crearReporteController);
router.get("/api/soporte/reportes", obtenerReportesController);
router.get("/api/soporte/reportes/usuario/:uid", obtenerReportesUsuarioController);
router.get("/api/soporte/reporte/:id", obtenerReportePorIdController);
router.post("/api/soporte/reporte/:id/responder", responderReporteController);
router.put("/api/soporte/reporte/:id/estado", actualizarEstadoReporteController);

// ============================================================================
// PROPINAS, PAGOS / RETIROS, HISTORIAL Y RANKING
// ============================================================================
router.post("/api/enviar-propina", enviarPropinaController);
router.post("/api/pagos/solicitar-retiro", solicitarRetiroController);
router.get("/api/pagos", obtenerTodosPagosController);
router.get("/api/pagos/usuario/:uid", obtenerPagosUsuarioController);
router.get("/api/pagos/:id", obtenerPagoPorIdController);
router.put("/api/pagos/:id/estado", actualizarEstadoPagoController);
router.get("/api/historial/:uid", obtenerHistorialController);
router.get("/api/ranking", obtenerRankingController);

// ============================================================================
// RECOMPENSAS DE ANUNCIOS Y CONTROL DE DISPOSITIVOS FÍSICOS
// ============================================================================
router.post("/api/anuncios/recompensar", reclamarRecompensaAnuncioController);
router.post("/api/anuncios/reset-limite/:uid", resetearLimiteAnunciosController);
router.post("/api/device-ad-limits/recompensar", validarYRecompensarDispositivoController);
router.get("/api/device-ad-limits/:deviceId", consultarEstadoDispositivoController);
router.post("/api/device-ad-limits/:deviceId/reset", resetearLimiteDispositivoController);

// ============================================================================
// BÓVEDA / PIN DE SEGURIDAD
// ============================================================================
router.get("/api/boveda/pin/:uid", obtenerPinBovedaController);
router.post("/api/boveda/guardar-pin", guardarPinBovedaController);

export default router;
