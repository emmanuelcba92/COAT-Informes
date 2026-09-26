/**
 * Utilidades para normalización y formateo canónico de nombres de profesionales médicos.
 * Formato canónico requerido en COAT: [Prefijo] [Apellido] [Nombre] (ej: "Dra. Venier Melisa")
 * Formato para carátulas: Solo [Prefijo] [Apellido] (ej: "Dra. Venier")
 */

const KNOWN_PREFIXES = ['dr', 'dra', 'lic', 'dr(a)', 'med', 'méd', 'prof', 'bioq', 'fon'];

const KNOWN_SURNAMES = [
  'venier', 'carranza', 'bruera', 'jasin', 'paredes', 'sanchez', 'sánchez', 
  'romani', 'teilletchea', 'telechter', 'turiella', 'valdez', 'valeriani', 
  'valeri', 'zalazar servino', 'zalazar', 'schafer', 'baffico', 'candolfi', 
  'curet', 'filloy', 'hoyos', 'musri', 'ojeda', 'romero orellano', 'romero', 
  'zernotti', 'navarro pirra', 'navarro', 'corbell', 'perez', 'pérez', 
  'garcia', 'garcía', 'martinez', 'martínez', 'fernandez', 'fernández', 
  'lopez', 'lópez', 'gonzalez', 'gonzález', 'diaz', 'díaz', 'molina', 'torres'
];

/**
 * Normaliza un prefijo a su forma canónica con punto (ej: "Dra.", "Dr.", "Lic.")
 */
export const normalizePrefix = (prefix) => {
  if (!prefix) return 'Dr.';
  const clean = prefix.toLowerCase().replace(/[^a-z()]/g, '');
  if (clean === 'dra') return 'Dra.';
  if (clean === 'lic') return 'Lic.';
  if (clean.includes('dr(a)')) return 'Dr(a).';
  if (clean === 'prof') return 'Prof.';
  if (clean === 'bioq') return 'Bioq.';
  if (clean === 'fon') return 'Lic.';
  return 'Dr.';
};

/**
 * Convierte cualquier formato sucio o duplicado de nombre médico en el formato canónico:
 * [Prefijo] [Apellido] [Nombre]
 */
export const formatDoctorDisplayName = (rawName, fallbackPrefix = 'Dr.') => {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  const cleanCheck = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (cleanCheck === 'tutoras' || cleanCheck.startsWith('tutora')) {
    return 'Tutoras';
  }
  if (cleanCheck === 'administracion' || cleanCheck === 'secretaria') {
    return trimmed;
  }

  // 1. Limpiar caracteres de puntuación como comas y espacios múltiples
  let str = trimmed.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!str) return '';

  // 2. Extraer prefijo y separar tokens restantes
  const rawTokens = str.split(' ').filter(Boolean);
  let detectedPrefix = null;
  const nonPrefixTokens = [];

  for (const token of rawTokens) {
    const cleanToken = token.toLowerCase().replace(/[^a-z()]/g, '');
    if (KNOWN_PREFIXES.includes(cleanToken)) {
      if (!detectedPrefix) {
        detectedPrefix = normalizePrefix(cleanToken);
      }
      continue;
    }
    nonPrefixTokens.push(token);
  }

  const finalPrefix = detectedPrefix || (fallbackPrefix ? normalizePrefix(fallbackPrefix) : '');

  // 3. Deduplicar repeticiones al inicio y fin (ej: ["Carranza", "Maria", "Sol", "Carranza"])
  let tokens = nonPrefixTokens;
  if (tokens.length >= 2) {
    const first = tokens[0].toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');
    const last = tokens[tokens.length - 1].toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');
    if (first && first === last) {
      tokens = tokens.slice(1);
    }
  }

  // 4. Deduplicar tokens repetidos case-insensitive manteniendo el orden
  const seen = new Set();
  const deduped = [];
  for (const t of tokens) {
    const norm = t.toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');
    if (!norm) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      deduped.push(t);
    }
  }

  if (deduped.length === 0) {
    return finalPrefix;
  }

  // 5. Normalizar orden: Apellido primero, luego Nombre
  let reorderedTokens = [...deduped];

  if (deduped.length >= 2) {
    const lastWord = deduped[deduped.length - 1].toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');
    const firstWord = deduped[0].toLowerCase().replace(/[^a-záéíóúüñ]/gi, '');

    if (deduped.length >= 3) {
      const lastTwo = `${deduped[deduped.length - 2]} ${deduped[deduped.length - 1]}`.toLowerCase().replace(/[^a-záéíóúüñ ]/gi, '');
      if (KNOWN_SURNAMES.includes(lastTwo) && !KNOWN_SURNAMES.includes(`${deduped[0]} ${deduped[1]}`.toLowerCase())) {
        const surnameTokens = deduped.slice(-2);
        const nameTokens = deduped.slice(0, -2);
        reorderedTokens = [...surnameTokens, ...nameTokens];
      } else if (KNOWN_SURNAMES.includes(lastWord) && !KNOWN_SURNAMES.includes(firstWord)) {
        const surnameToken = deduped[deduped.length - 1];
        const nameTokens = deduped.slice(0, -1);
        reorderedTokens = [surnameToken, ...nameTokens];
      }
    } else if (deduped.length === 2) {
      if (KNOWN_SURNAMES.includes(lastWord) && !KNOWN_SURNAMES.includes(firstWord)) {
        reorderedTokens = [deduped[1], deduped[0]];
      }
    }
  }

  // 6. Formatear palabras a Title Case
  const formattedWords = reorderedTokens.map(w => {
    if (w === w.toUpperCase() && w.length > 1) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    return w.charAt(0).toUpperCase() + w.slice(1);
  });

  return `${finalPrefix} ${formattedWords.join(' ')}`.trim();
};

/**
 * Retorna versión corta del profesional para Carátulas: SOLO [Prefijo] [Apellido]
 */
export const shortDoctorName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return '';
  const cleanCheck = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (cleanCheck === 'tutoras' || cleanCheck.startsWith('tutora')) {
    return 'Tutoras';
  }
  const full = formatDoctorDisplayName(rawName);
  if (!full) return '';

  const parts = full.split(' ');
  const prefix = parts[0];
  const remaining = parts.slice(1);

  if (remaining.length === 0) return prefix;
  if (remaining.length === 1) return `${prefix} ${remaining[0]}`.trim();

  const firstTwo = `${remaining[0]} ${remaining[1]}`.toLowerCase().replace(/[^a-záéíóúüñ ]/gi, '');
  if (KNOWN_SURNAMES.includes(firstTwo)) {
    return `${prefix} ${remaining[0]} ${remaining[1]}`.trim();
  }

  const surname = remaining[0];
  return `${prefix} ${surname}`.trim();
};
