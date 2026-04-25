import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
];

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Intenta ejecutar una tarea con los modelos disponibles en orden de prioridad
 * @param {Function} task - Función que recibe el modelo y retorna el resultado
 * @returns {Promise<any>} - Resultado de la tarea
 */
const tryWithFallbacks = async (task) => {
  let lastError = null;
  
  for (const modelName of MODELS) {
    try {
      console.log(`Intentando con modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
      return await task(model);
    } catch (error) {
      console.warn(`Fallo con modelo ${modelName}:`, error.message);
      lastError = error;
      // Si es un error de cuota o modelo no encontrado, seguimos con el siguiente
      continue;
    }
  }
  
  console.error("Todos los modelos fallaron.");
  throw lastError;
};

/**
 * Procesa una imagen (captura de pantalla) para extraer datos de pacientes
 * @param {string} base64Image - Imagen en formato base64 (sin el prefijo data:image/...)
 * @returns {Promise<Array>} - Lista de pacientes extraídos
 */
export const extractPatientsFromImage = async (base64Image) => {
  return tryWithFallbacks(async (model) => {
    const prompt = `
      Actúa como un experto en extracción de datos médicos. 
      Analiza la imagen adjunta que es una captura de pantalla de un sistema de turnos llamado GACITUA.
      Extrae todos los pacientes visibles en la tabla.
      
      IMPORTANTE:
      - La columna "HC" o "H.C." contiene el número de DNI.
      - REGLA CRÍTICA: Solo extrae filas donde el número en "HC" tenga 6 o más dígitos. 
      - IGNORA filas con números cortos (ej: 10, 161, etc.) ya que corresponden a códigos de profesionales, no a pacientes.
      - La columna "Paciente" contiene el Nombre completo (Apellido y Nombre). Extráelo completo sin cortes.
      - La columna "Mutual" es la Obra Social.
      - La columna "Teléfono" es el teléfono del paciente.
      - Si existe un email en la fila o cerca, extráelo en minúsculas.
      
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
    const jsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  });
};

/**
 * Procesa texto extraído de un PDF para convertirlo en objetos de pacientes
 * @param {string} pdfText - Texto bruto del PDF
 * @returns {Promise<Array>} - Lista de pacientes extraídos
 */
export const extractPatientsFromText = async (pdfText) => {
  return tryWithFallbacks(async (model) => {
    const prompt = `
      Actúa como un experto en extracción de datos médicos.
      Analiza el siguiente texto extraído de un PDF o imagen de turnos de una clínica (GACITUA).
      Extrae todos los pacientes y conviértelos a un formato estructurado JSON.
      
      INSTRUCCIONES CRÍTICAS:
      1. FILTRADO Y MAPEO:
         - "HC" o "H.C." es el DNI (extrae solo números).
         - REGLA DE ORO: Solo procesa filas donde el DNI/HC tenga 6 o más dígitos.
         - IGNORA filas con códigos cortos (2 o 3 dígitos) como 10, 161, etc. Estos son médicos, NO pacientes.
         - "Paciente" es el Nombre completo (extrae todo el texto de esta columna).
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
  });
};
