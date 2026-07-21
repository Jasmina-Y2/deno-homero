import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  eliminarArchivoS3,
  generateAudio,
  getPresignedUrl,
  obtenerUrlLectura,
} from "../controllers/aws.controller.ts";

const router = new Router();

router.post("/aws/upload-url", getPresignedUrl);
router.post("/aws/tts", generateAudio);
router.post("/aws/url-firmada", obtenerUrlLectura);
router.post("/aws/eliminar-archivo", eliminarArchivoS3);

export default router;
