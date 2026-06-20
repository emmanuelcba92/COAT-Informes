const SECURITY_TOKEN = "COAT0821";

function doGet(e) {
  // Mantengo esto por compatibilidad, pero usaremos POST
  return getDriveQuota();
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.token !== SECURITY_TOKEN) return response("error", "Token inválido");

    // NUEVO: Acción para ver el espacio
    if (data.action === 'getQuota') {
      return getDriveQuota();
    }

    const decodedPdf = Utilities.base64Decode(data.pdfBase64);
    const blob = Utilities.newBlob(decodedPdf, 'application/pdf', data.fileName || "Pedido.pdf");

    // 1. DRIVE
    try {
      if (data.folderId) {
        const mainFolder = DriveApp.getFolderById(data.folderId);
        let targetFolder = mainFolder;
        if (data.dni) {
          const folderName = "DNI " + data.dni;
          const subFolders = mainFolder.getFoldersByName(folderName);
          targetFolder = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(folderName);
        }
        targetFolder.createFile(blob);
      }
    } catch (e) { console.log("Drive error: " + e); DriveApp.createFile(blob); }

    // 2. EMAILS
    if (data.recipientEmails) {
      data.recipientEmails.forEach(email => {
        if (email && email.includes("@")) {
          MailApp.sendEmail({
            to: email,
            subject: data.subject || "Documento COAT",
            htmlBody: data.message || "Adjunto su pedido médico.",
            attachments: [blob]
          });
        }
      });
    }

    return response("success", "OK");
  } catch (err) {
    return response("error", err.toString());
  }
}

function getDriveQuota() {
  const limit = DriveApp.getStorageLimit();
  const used = DriveApp.getStorageUsed();
  return response("success", {
    usedGB: (used / (1024 ** 3)).toFixed(2),
    limitGB: (limit / (1024 ** 3)).toFixed(2),
    percent: ((used / limit) * 100).toFixed(2)
  });
}

function response(status, message) {
  const res = (status === "success" && typeof message === 'object') ? message : { status, message };
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}
