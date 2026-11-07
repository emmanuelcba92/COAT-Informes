export const isParticularInsurance = (insurance) =>
  typeof insurance === 'string' && insurance.trim().toLowerCase() === 'particular';
