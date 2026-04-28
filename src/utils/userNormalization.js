
/**
 * Utilidades para la normalización de nombres y desduplicación de profesionales
 * en el sistema Informes COAT.
 */

/**
 * Extrae las palabras significativas de un nombre, eliminando prefijos de títulos
 * y caracteres especiales.
 */
export const getWords = (n) => (n || "").toUpperCase()
  .replace(/^(DR\s*\.?|DRA\s*\.?|LIC\s*\.?|PROF\s*\.?|BIOQ\s*\.?|FON\s*\.?)\s+/g, '')
  .replace(/(,\s*|DR\s*\.?|DRA\s*\.?|LIC\s*\.?|PROF\s*\.?|BIOQ\s*\.?|FON\s*\.?)/g, ' ')
  .replace(/\./g, '')
  .split(/\s+/)
  .filter(word => word.length > 2);

/**
 * Genera una clave única de normalización basada en las palabras del nombre ordenadas.
 */
export const normalizeName = (n) => getWords(n).sort().join(' ');

/**
 * Determina si un ID es de tipo "legacy" (contiene @ o _coat_com_ar).
 */
export const isLegacyId = (uid) => uid && (uid.includes('_coat_com_ar') || uid.includes('@'));

/**
 * Desduplica una lista de usuarios basada en sus nombres normalizados.
 * Prioriza IDs reales sobre legacy y perfiles con firma.
 */
export const deduplicateProfessionals = (rawUsers) => {
  return rawUsers.reduce((acc, current) => {
    const currentRawName = current.nombre || current.n || current.u || "";
    const currentNorm = normalizeName(currentRawName);
    const id = current.id || current.uid;
    
    // Filtros de exclusión específicos
    if (id === 'cromani_coat_com_ar' || id === 'ccuret_coat_com_ar') return acc;

    const existingIdx = acc.findIndex(item => normalizeName(item.nombre || item.n || item.u || "") === currentNorm);

    if (existingIdx === -1) {
      acc.push({ ...current, id });
    } else {
      const existing = acc[existingIdx];
      
      // Lógica de Prioridad:
      // 1. Si el existente es legacy y el actual NO, reemplazamos.
      if (isLegacyId(existing.id) && !isLegacyId(id)) {
        acc[existingIdx] = { ...current, id };
      } 
      // 2. Si ambos son del mismo tipo de ID, pero el actual tiene firma y el otro no, reemplazamos.
      else if (isLegacyId(existing.id) === isLegacyId(id)) {
        if (!existing.signatureBase64 && current.signatureBase64) {
          acc[existingIdx] = { ...current, id };
        }
      }
      // En cualquier otro caso, mantenemos el que ya estaba (el primero encontrado o el ya priorizado).
    }
    return acc;
  }, []);
};

/**
 * Formatea un nombre para mostrar (Camel Case) quitando prefijos.
 */
export const formatDisplayName = (n) => {
  const clean = (n || "")
    .replace(/(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/gi, '')
    .replace(/^[.\s,]+/, '')
    .trim();
  
  if (!clean) return "Profesional";

  return clean.toLowerCase().split(' ').map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};
