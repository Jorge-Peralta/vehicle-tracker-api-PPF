/** Display form of a driver's name: trimmed, with single spaces ("  Ana   López " -> "Ana López"). */
export function cleanDriverName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ')
}

/**
 * Key used to recognize the same driver regardless of case or spacing
 * ("Ana López" and " ana  LÓPEZ" -> "ana lópez").
 */
export function normalizeDriverName(fullName: string): string {
  return cleanDriverName(fullName).toLowerCase()
}
