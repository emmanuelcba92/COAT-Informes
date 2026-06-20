/**
 * Google Apps Script para gestionar envío de emails y respaldos en Google Drive.
 * 
 * Instrucciones de Despliegue:
 * 1. Ve a https://script.google.com y crea un nuevo proyecto.
 * 2. Reemplaza el contenido de Código.gs con este script.
 * 3. En la línea 13, define el TOKEN de seguridad (ej: "coat123" o el configurado en tu Panel Admin).
 * 4. Haz clic en "Desplegar" -> "Nuevo despliegue".
 * 5. Selecciona Tipo: "Aplicación web".
 * 6. Configura:
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquiera"
 * 7. Copia la URL de la aplicación web obtenida y pégala en el Panel de Administración de la WebApp.
 */

const TOKEN = "coat123"; // Debe coincidir con el configurado en el Panel Admin de la WebApp

function doGet(e) {
  return createResponse({ success: true, message: "Google Apps Script para COAT está online" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Validar Token
    if (data.token !== TOKEN) {
      return createResponse({ success: false, error: "Unauthorized" }, 401);
    }

    // Acción: Obtener cuota de almacenamiento
    if (data.action === "getQuota") {
      var limit = DriveApp.getStorageLimit();
      var used = DriveApp.getStorageUsed();
      var usedGB = (used / (1024 * 1024 * 1024)).toFixed(2);
      var limitGB = (limit / (1024 * 1024 * 1024)).toFixed(2);
      var percent = ((used / limit) * 100).toFixed(1);
      return createResponse({
        success: true,
        usedGB: parseFloat(usedGB),
        limitGB: parseFloat(limitGB),
        percent: parseFloat(percent)
      });
    }

    // Acción: Restablecer contraseña (Puente)
    if (data.action === "resetPassword") {
      const email = data.email;
      if (!email) return createResponse({ success: false, error: "Missing email" }, 400);
      return createResponse({ 
        success: true, 
        message: "Petición de restablecimiento recibida para " + email 
      });
    }

    // Guardar en Google Drive si se proporciona folderId y pdfBase64
    var fileSaved = false;
    var fileUrl = "";
    if (data.folderId && data.pdfBase64) {
      var parentFolder = DriveApp.getFolderById(data.folderId);
      var targetFolder = parentFolder;
      
      // Si viene DNI, creamos o buscamos la subcarpeta del paciente
      if (data.dni) {
        var folderName = "DNI " + data.dni.toString().trim();
        targetFolder = getOrCreateFolder(parentFolder, folderName);
      }
      
      var blob = Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), 'application/pdf', data.fileName);
      var file = targetFolder.createFile(blob);
      fileSaved = true;
      fileUrl = file.getUrl();
    }

    // Enviar correo si viene recipientEmails y pdfBase64
    if (data.recipientEmails && data.recipientEmails.length > 0 && data.pdfBase64) {
      var attachments = [Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), 'application/pdf', data.fileName)];
      
      for (var i = 0; i < data.recipientEmails.length; i++) {
        var emailAddress = data.recipientEmails[i];
        if (emailAddress && emailAddress.trim() !== "") {
          MailApp.sendEmail({
            to: emailAddress.trim(),
            subject: data.subject || "Documento Médico - COAT",
            htmlBody: data.message || "Adjunto encontrará el informe médico en formato PDF.",
            attachments: attachments
          });
        }
      }
    }

    return createResponse({ 
      success: true, 
      fileSaved: fileSaved, 
      fileUrl: fileUrl 
    });

  } catch (err) {
    return createResponse({ success: false, error: err.toString() }, 500);
  }
}

// Función auxiliar para buscar o crear una carpeta
function getOrCreateFolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(name);
  }
}

// Helper para crear respuesta JSON
function createResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
