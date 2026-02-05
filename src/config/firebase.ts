import { initializeApp, cert } from "npm:firebase-admin/app";
import { getFirestore } from "npm:firebase-admin/firestore";
import { getStorage } from "npm:firebase-admin/storage"; // Importante para subir imágenes desde el back

const getServiceAccount = async () => {
    console.log("📍 Directorio actual:", Deno.cwd());

    console.log("📂 Archivos en esta carpeta:");
    for await (const dirEntry of Deno.readDir(Deno.cwd())) {
        console.log(" -", dirEntry.name);
    }

    try {
        const json = await Deno.readTextFile("./src/config/serviceAccountKey.json");
        console.log("✅ ¡Archivo encontrado y leído!");
        return JSON.parse(json);
    } catch (e) {
        console.log("❌ Falló lectura de archivo local:", e.message);

        const envVar = Deno.env.get("FIREBASE_KEY");
        if (envVar) return JSON.parse(envVar);

        throw new Error("❌ No se encontraron credenciales (serviceAccountKey.json o ENV)");
    }
};

const serviceAccount = await getServiceAccount();

initializeApp({
    credential: cert(serviceAccount),
    projectId: "ciarv-2dfcc",
    storageBucket: "ciarv-2dfcc.appspot.com"
});

const db = getFirestore();

try {
    db.settings({
        preferRest: true
    });
    console.log("⚙️ Modo REST activado para compatibilidad con Deno");
} catch (error) {
    console.warn("⚠️ No se pudo activar modo REST:", error);
}

export { db };
export const bucket = getStorage().bucket();

console.log("🔥 Firebase Admin conectado a: ciarv-2dfcc");
