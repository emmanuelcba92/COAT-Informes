/**
 * Script para gestionar el reseteo de contraseñas de Firebase Auth
 * Desplegar como Web App:
 * - Execute as: Me (Tu cuenta)
 * - Who has access: Anyone (Cualquiera)
 */

const TOKEN = "TU_TOKEN_AQUI"; // Debe coincidir con el configurado en el Panel Admin

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Validar Token
    if (data.token !== TOKEN) {
      return createResponse({ success: false, error: "Unauthorized" }, 401);
    }

    if (data.action === "resetPassword") {
      const email = data.email;
      if (!email) return createResponse({ success: false, error: "Missing email" }, 400);

      // El script por sí solo en Google Apps Script no puede resetear Firebase directamente
      // sin la librería de FirebaseApp. 
      // Por ahora, este script sirve como puente. 
      // Si necesitas que sea automático, avísame para darte el código con la Service Account.
      
      return createResponse({ 
        success: true, 
        message: "Petición recibida para " + email 
      });
    }

    return createResponse({ success: false, error: "Unknown action" }, 400);

  } catch (err) {
    return createResponse({ success: false, error: err.toString() }, 500);
  }
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
