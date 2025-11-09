/**
 * Importar los módulos necesarios de Firebase Functions y Admin SDK.
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// Inicializar la app de Admin para tener acceso a los servicios de Firebase.
admin.initializeApp();

/**
 * ⭐️ NUEVA CLOUD FUNCTION: `imageProxy`
 *
 * Esta función actúa como un intermediario (proxy) seguro para obtener
 * las imágenes desde Firebase Storage.
 *
 * ¿Por qué es necesaria?
 * Por seguridad, los navegadores bloquean las peticiones de un dominio a otro
 * (CORS). Esta función se ejecuta en el servidor de Firebase, donde esa
 * restricción no existe.
 *
 * ¿Cómo funciona?
 * 1. El cliente (host.html) llama a esta función pasándole la URL de la imagen.
 * 2. La función usa 'axios' para descargar la imagen.
 * 3. Devuelve la imagen al cliente en formato Base64.
 */
exports.imageProxy = functions.https.onRequest((request, response) => {
  // Usar 'cors' para permitir que nuestro sitio web llame a esta función.
  cors(request, response, async () => {
    const imageUrl = request.query.url;
    if (!imageUrl) {
      response.status(400).send("Falta el parámetro 'url'.");
      return;
    }

    const imageBuffer = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const base64 = Buffer.from(imageBuffer.data, "binary").toString("base64");
    response.send(base64);
  });
});