import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 for storage (e.g. "+233544053900"),
 * using the same country-aware semantics as the mobile app (src/lib/phone.ts).
 *
 * - When `countryCode` (ISO-3166 alpha-2, e.g. "GH") is provided, the input is
 *   parsed as a national number for that country, so both local formats
 *   ("0544053900", "544053900") and international ("+233 54 405 3900") work.
 * - When no country code is provided, the input must be a full international
 *   number (must include a leading "+" with a valid country code).
 *
 * Returns the E.164 string, or null when the input is not a valid number.
 */
export function normalizePhoneToE164(phone: string, countryCode?: string): string | null {
    const trimmed = phone.trim();
    if (!trimmed) return null;

    let parsed;
    try {
        if (countryCode) {
            // Provided country lets libphonenumber accept local/national formats.
            parsed = trimmed.startsWith('+')
                ? parsePhoneNumberFromString(trimmed)
                : parsePhoneNumberFromString(trimmed, countryCode.toUpperCase() as CountryCode);
        } else {
            parsed = parsePhoneNumberFromString(trimmed);
        }
    } catch {
        return null;
    }

    if (!parsed || !parsed.isValid()) return null;

    // When the caller supplied a country and the input was local (no "+"), the
    // resolved country must match so we don't accept a mismatched international
    // number under the wrong country label.
    if (
        countryCode &&
        !trimmed.startsWith('+') &&
        parsed.country !== countryCode.toUpperCase()
    ) {
        return null;
    }

    return parsed.format('E.164');
}
