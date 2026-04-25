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
      
      Devuelve los datos estrictamente en formato JSON como un array de objetos con las siguientes claves:
      dni (string, solo números), nombre (string, Apellido y Nombre), obraSocial (string), telefono (string).
      
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
    ]);

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
      Analiza el siguiente texto extraído de un PDF de turnos de una clínica.
      Extrae todos los pacientes y conviértelos a un formato estructurado.
      
      Buscamos: DNI (está en la columna H.C.), Nombre (columna Paciente), Obra Social (columna Mutual) y Teléfono.
      
      Texto del PDF:
      ${pdfText}
      
      Devuelve los datos estrictamente en formato JSON como un array de objetos con las siguientes claves:
      dni, nombre, obraSocial, telefono.
      
      Solo devuelve el JSON, sin texto adicional.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error extracting from text:", error);
    throw error;
  }
};
