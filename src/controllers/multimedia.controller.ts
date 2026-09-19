import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { generarThumbnailOGService } from "../service/multimedia.service.ts";

export const generarThumbnailController = async (ctx: RouterContext<string>) => {
  try {
    const body = await ctx.request.body.json();
    const { url, folder = "thumbnails", captureSecond = 2 } = body;

    if (!url || typeof url !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El campo 'url' es requerido",
      };
      return;
    }

    const thumbnailUrl = await generarThumbnailOGService(url, {
      folder,
      captureSecond,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Thumbnail generado correctamente",
      originalUrl: url,
      thumbnailUrl,
    };
  } catch (error) {
    console.error("❌ Error en generarThumbnailController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: error instanceof Error ? error.message : "Error al generar thumbnail",
    };
  }
};
