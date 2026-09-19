import { db } from "../config/firebase.ts";
import { uploadToS3 } from "../controllers/aws.controller.ts";
import { crearUsuarioService, normalizarUsuarioDoc } from "./users.service.ts";

export const syncUserWithGoogleService = async (userData: any) => {
    try {
        const fcmToken = userData.fcmToken || userData.fcm_token || userData.sistema?.fcmToken || "";
        const { uid, email, name, photoURL } = userData;

        // 1. Buscar si el usuario ya existe por doc ID directo o por campo 'uid'
        let userRef = db.collection("users").doc(uid);
        let docSnap = await userRef.get();

        if (!docSnap.exists) {
            const querySnap = await db.collection("users").where("uid", "==", uid).limit(1).get();
            if (!querySnap.empty) {
                docSnap = querySnap.docs[0];
                userRef = querySnap.docs[0].ref;
            }
        }

        if (docSnap.exists) {
            const existingData = docSnap.data();
            if (fcmToken && fcmToken.trim().length > 0) {
                await userRef.update({
                    "sistema.fcmToken": fcmToken,
                    "sistema.fechaActualizacion": new Date().toISOString(),
                });
            }
            return normalizarUsuarioDoc({ ...existingData, idDoc: docSnap.id, uid: existingData?.uid || uid });
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

        const nuevoUsuario = await crearUsuarioService({
            uid,
            email,
            name,
            photoURL: finalPhotoUrl,
            metodo: "google",
            fcmToken,
            perfil: {
                name,
                email,
                photoURL: finalPhotoUrl,
            },
            sistema: {
                fcmToken,
            },
        });

        return nuevoUsuario;

    } catch (error) {
        console.error("❌ Error en syncUserWithGoogleService:", error);
        throw error;
    }
};