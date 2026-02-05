export const successResponse = (ctx: any, data: any, message = "Éxito") => {
    ctx.response.status = 200;
    ctx.response.body = {
        ok: true,
        message,
        data,
    };
};

export const errorResponse = (ctx: any, error: any, status = 500) => {
    console.error("❌ Error:", error);
    ctx.response.status = status;
    ctx.response.body = {
        ok: false,
        message: error.message || "Error interno del servidor",
    };
};