import { Router } from "https://deno.land/x/oak/mod.ts";
import { getPresignedUrl, generateAudio, deleteFile } from "../controllers/aws.controller.ts";

const router = new Router();

router.post("/aws/upload-url", getPresignedUrl);
router.post("/aws/tts", generateAudio);
router.post("/aws/delete", deleteFile);

export default router;