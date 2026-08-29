import { Router } from "https://deno.land/x/oak/mod.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
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

import {
  getCategoriasController,
} from "../controllers/categorias.controller.ts";

import {
  checkLikeStatus,
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
  actualizarFotoUsuario,
  actualizarNombreUsuario,
  actualizarSuscripcionUsuario,
  crearUsuario,
  getUsuarioPerfil,
  getUsuarios,
  verificarUsuarioEmail,
} from "../controllers/users.controller.ts";
import { getHistoriaCardByAutor } from "../controllers/cardhistoria.controller.ts";
import {
  guardarComentario,
  obtenerComentarios,
} from "../controllers/comentarios.controller.ts";
import { checkStoryViewed } from "../controllers/vistasuser.controller.ts";
import { getHistoriasPorCategoria } from "../controllers/categoriahistoria.controller.ts";
import { loginAndSync } from "../controllers/auth.controller.ts";
import {
  generateMultivoiceAudio,
  transformarHistoriaSSML,
} from "../controllers/ia.controller.ts";
import {
  crearSonido,
  modificarSonido,
  obtenerSonidoPorId,
  obtenerSonidos,
} from "../controllers/sonido.controller.ts";

const router = new Router();

router.get("/api/card-historias/mostrar", obtenerCardHistoriaController);

router.post("/api/colecciones/crear", crearColeccionController);
router.get("/api/colecciones/mostrar", mostrarColeccionesPorAutorController);
router.delete("/api/colecciones/eliminar/:uid", eliminarColeccionesPorUid);
router.get("/api/colecciones/mostrar/todas", getTodasLasColecciones);
router.get("/api/colecciones/mostrar/:uid", getColeccionesPorId);

router.post("/api/coleccion-ids/crear", agregarHistoriaAColeccionController);

router.post("/api/historias/crear", crearHistoriaController);
router.post("/api/card-historias/crear", crearCardHistoriaController);
router.post("/api/historias-info/crear", crearHistoriaInfoController);
router.delete("/api/card-historias/eliminar/:id", eliminarCardController);

router.delete("/api/multimedia/limpiar/:id", eliminarMultimediaController);
router.get("/api/historias-info/autor", getCardsPorAutor);
router.get("/api/historias-info/mostrar", getCardHistoriasController);
router.get("/api/historias-info/most-vistas", getHistoriasPorVistasController);

router.post("/api/traductor", traducirTexto);
router.get("/api/categorias/mostrar", getCategoriasController);

router.get("/api/likes/status", checkLikeStatus);

router.get("/api/historia/:id", getHistoriaByCustomId);
router.post("/api/historia/audio/guardar", guardarAudio);
router.post("/api/historia/audio/obtener", obtenerAudios);

router.put("/api/historia-info/vistas/:id", incrementarVistas);
router.post("/api/vistas-user/registrar", registrarVistaUsuario);
router.post("/api/like-user/like", toggleLike);

router.post("/api/seguiruser/seguir", seguirUsuario);
router.post("/api/seguiruser/dejar-seguir", dejarDeSeguir);

router.get("/api/seguiruser/seguidores/:uid", getGenteQueMeSigue);
router.get("/api/seguir/siguiendo/:uid", getGenteQueYoSigo);

router.get("/api/users/mostrar", getUsuarios);
router.get("/api/historias-card/mostrar/:idAutor", getHistoriaCardByAutor);
router.get("/api/historias-card/mostrar-id/:id", getHistoriaCardById);

router.post("/api/comentarios/guardar", guardarComentario);
router.get("/api/comentarios/obtener/:publicacionId", obtenerComentarios);
router.get("/api/historia-info/:id", getHistoriaById);

router.get("/api/coleccionesids/mostrar/:docId", getColeccionDetalle);

router.get("/api/likeuser/likes/:id", getLikesCount);
router.get(
  "/api/vistasuser/verificar/:idUsuario/:idHistoria",
  checkStoryViewed,
);

router.get("/api/categoriashistorias/:categoriaId", getHistoriasPorCategoria);

router.post("/api/auth/google-sync", loginAndSync);

router.get("/api/likeuser/mostrar/:uid", getHistoriasLiked);
router.get("/api/vistasuser/mostrar/:uid", getHistoriasVistas);

router.get("/api/users/perfil/:uid", getUsuarioPerfil);
router.get("/api/users/verificar-email/:email", verificarUsuarioEmail);
router.post("/api/users/crear", crearUsuario);
router.put("/api/users/actualizar-nombre", actualizarNombreUsuario);
router.put("/api/users/actualizar-foto", actualizarFotoUsuario);
router.put("/api/users/actualizar-descripcion", actualizarDescripcionUsuario);
router.put("/api/users/actualizar-suscripcion", actualizarSuscripcionUsuario);

router.post("/api/sonido/crear", crearSonido);
router.get("/api/sonido/obtener", obtenerSonidos);
router.get("/api/sonido/obtener/:id", obtenerSonidoPorId);
router.put("/api/sonido/modificar/:id", modificarSonido);

router.post("/api/ia/automatizar-ssml", transformarHistoriaSSML);
router.post("/api/ia/multivoz", generateMultivoiceAudio);

export default router;
