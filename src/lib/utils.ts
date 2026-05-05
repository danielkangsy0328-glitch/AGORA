/**
 * Encodes a name into an ASCII-safe string for use in virtual emails.
 * Handles non-ASCII characters like Korean by escaping them.
 */
export const encodeNameForEmail = (name: string): string => {
  const cleanName = name.trim();
  // Simple escape mechanism for non-ASCII characters
  return Array.from(cleanName).map(c => {
    const charCode = c.charCodeAt(0);
    // Escape non-ASCII and preserve alphanumeric
    return charCode > 127 ? `u${charCode.toString(16)}` : c.toLowerCase();
  }).join('').replace(/[^a-z0-9]/g, '_');
};

/**
 * Generates a consistent virtual email address from a user's name.
 */
export const generateVirtualEmail = (name: string): string => {
  return `${encodeNameForEmail(name)}@v2.agora.internal`;
};

/**
 * Legacy virtual email generator for backward compatibility.
 */
export const generateLegacyVirtualEmail = (name: string): string => {
  // Try v1 first as legacy if needed
  return `${encodeNameForEmail(name)}@agora.internal`;
};
