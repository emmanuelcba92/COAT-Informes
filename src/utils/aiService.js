import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL_NAME = "gemini-3.1-flash-lite-preview";

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Procesa una imagen (captura de pantalla) para extraer datos de pacientes
 * @param {string} base64Image - Imagen en formato base64 (sin el prefijo data:image/...)
 * @returns {Promise<Array>} - Lista de pacientes extraídos
 */
export const extractPatientsFromImage = async (base64Image) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Actúa como un experto en extracción de datos médicos. 
      Analiza la imagen adjunta que es una captura de pantalla de un sistema de turnos llamado GACITUA.
      Extrae todos los pacientes visibles en la tabla.
      
      IMPORTANTE:
      - La columna "H.C." contiene el número de DNI.
      - La columna "Paciente" contiene Apellido y Nombre.
      - La columna "Mutual" es la Obra Social.
      - La columna "Teléfono" es el teléfono del paciente.
      - Si existe un email, extráelo en minúsculas.
      
      Devuelve los datos estrictamente en formato JSON como un array de objetos con las siguientes claves:
      dni (string, solo números), nombre (string, Apellido y Nombre), obraSocial (string), telefono (string), email (string | null).
      
      Si no puedes extraer nada, devuelve un array vacío [].
      Solo devuelve el JSON, sin texto adicional ni bloques de código.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/png"
        }
      }
    ], {
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dni: { type: "string" },
              nombre: { type: "string" },
              obraSocial: { type: "string" },
              telefono: { type: "string" },
              email: { type: ["string", "null"] }
            }
          }
        }
      }
    });

    const response = await result.response;
    const text = response.text();
    
    // Limpiar el texto en caso de que venga con bloques de código markdown
    const jsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error extracting from image:", error);
    throw error;
  }
};

/**
 * Procesa texto extraído de un PDF para convertirlo en objetos de pacientes
 * @param {string} pdfText - Texto bruto del PDF
 * @returns {Promise<Array>} - Lista de pacientes extraídos
 */
export const extractPatientsFromText = async (pdfText) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Actúa como un experto en extracción de datos médicos.
      Analiza el siguiente texto extraído de un PDF o imagen de turnos de una clínica (GACITUA).
      Extrae todos los pacientes y conviértelos a un formato estructurado JSON.
      
      INSTRUCCIONES CRÍTICAS:
      1. MAPEO DE COLUMNAS:
         - "H.C." es el DNI (extrae solo números).
         - "Paciente" es el Nombre completo (normalmente APELLIDO NOMBRE).
         - "Mutual" es la Obra Social / Seguro Médico.
         - "Teléfono" es el teléfono de contacto.
      2. EXTRACCIÓN DE EMAIL:
         - Busca patrones de correo electrónico (ej: usuario@gmail.com, nombre.apellido@dominio.ar).
         - Si el email aparece en cualquier parte del texto asociado al paciente (o en la misma fila), EXTRÁELO SIN FALTA.
         - Es VITAL capturar el email si está presente para el envío automático de informes.
      
      Texto a procesar:
      ${pdfText}
      
      Devuelve los datos estrictamente en formato JSON como un array de objetos con las siguientes claves:
      dni, nombre, obraSocial, telefono, email.
      
      Si no encuentras el email para un paciente específico, pon null.
      Solo devuelve el JSON, sin texto adicional ni bloques de código.
    `;

    const result = await model.generateContent(prompt, {
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dni: { type: "string" },
              nombre: { type: "string" },
              obraSocial: { type: "string" },
              telefono: { type: "string" },
              email: { type: ["string", "null"] }
            }
          }
        }
      }
    });
    const response = await result.response;
    const text = response.text();
    
    const jsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error extracting from text:", error);
    throw error;
  }
};
