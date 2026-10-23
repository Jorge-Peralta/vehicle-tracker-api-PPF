/**
 * The business operates in Honduras (America/Tegucigalpa), which is UTC-6 all year
 * (no daylight saving time), so a fixed offset is enough.
 */
export const BUSINESS_UTC_OFFSET = '-06:00'
const BUSINESS_UTC_OFFSET_MS = -6 * 60 * 60 * 1000

/** Formats an instant in local business time for user messages: "10/03/2026 04:00". */
export function formatLocalDateTime(date: Date): string {
  const [day, time] = new Date(date.getTime() + BUSINESS_UTC_OFFSET_MS).toISOString().split('T')
  const [year, month, dayOfMonth] = day!.split('-')
  return `${dayOfMonth}/${month}/${year} ${time!.slice(0, 5)}`
}

/** Start of a local calendar day ("2026-03-10") as a UTC instant. */
export function startOfLocalDay(date: string): Date {
  return new Date(`${date}T00:00:00${BUSINESS_UTC_OFFSET}`)
}

/** Start of the local day after `date`, used as an exclusive upper bound. */
export function startOfNextLocalDay(date: string): Date {
  const start = startOfLocalDay(date)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000)
}
