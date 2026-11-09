// Integer money math. Payroll rounds each line half-up to the cent; doing the arithmetic in integers
// avoids binary floating-point surprises such as 1.005 x 100 = 100.49999999999999.

/** Dollars (at most 2 decimals) to integer cents. */
export const toCents = (dollars: number): number => Math.round(dollars * 100)

export const toDollars = (cents: number): number => cents / 100

/** Hours (at most 2 decimals) to integer hundredths of an hour. */
export const toHundredths = (hours: number): number => Math.round(hours * 100)

/** A rate or multiplier to integer millionths (e.g. 0.0652 -> 65200, 41.25 -> 41250000). */
export const toMicros = (value: number): number => Math.round(value * 1e6)

/** n / d rounded half away from zero, for integers. */
export function roundDiv(n: number, d: number): number {
  const sign = n < 0 ? -1 : 1
  const a = Math.abs(n)
  const q = Math.floor(a / d)
  const r = a - q * d
  return sign * (2 * r >= d ? q + 1 : q)
}

/** Cents for `hours` at `rate` dollars per hour, rounded half-up to the cent. */
export const lineCents = (hours: number, rate: number): number =>
  roundDiv(toHundredths(hours) * toMicros(rate), 1e6)

/** `rate` (a fraction such as 0.015) of `cents`, rounded half-up to the cent. */
export const percentOf = (cents: number, rate: number): number => roundDiv(cents * toMicros(rate), 1e6)

/** Round a dollar amount computed in floating point (e.g. annual tax / 26) half-up to the cent. */
export function roundDollarsToCents(dollars: number): number {
  // Shift via the decimal string so values like 1.005 round as written, not as stored.
  const shifted = Number(`${dollars.toFixed(10)}e2`)
  return Math.sign(shifted) * Math.round(Math.abs(shifted))
}
