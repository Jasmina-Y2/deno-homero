import { db } from "../config/firebase.ts";
import { uploadToS3 } from "../controllers/aws.controller.ts";

export const syncUserWithGoogleService = async (userData: any) => {
    try {
        const { uid, email, name, photoURL } = userData;
        const userRef = db.collection("users").doc(uid);
        const docSnap = await userRef.get();

        if (docSnap.exists) {
            return docSnap.data();
        }

        let finalPhotoUrl = "https://mybuckethomero2.s3.us-east-1.amazonaws.com/user/imagen.jpg";

        if (photoURL) {
            try {
                const response = await fetch(photoURL);
                if (response.ok) {
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = new Uint8Array(arrayBuffer);

                    finalPhotoUrl = await uploadToS3(buffer, `profile_${uid}.jpg`, blob.type);
                }
            } catch (err) {
                console.error("❌ Falló subida a S3, usando default:", err);
            }
        }
        const nuevoUsuario = {
            email,
            name,
            photoURL: finalPhotoUrl,
            uid,
            createdAt: new Date().toISOString(),
        };

        await userRef.set(nuevoUsuario);
        return nuevoUsuario;

    } catch (error) {
        console.error("❌ Error en syncUserWithGoogleService:", error);
        throw error;
    }
};