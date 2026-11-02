/**
 * Report redaction: no secret-shaped text may ever leave the scan engine.
 *
 * Applied to every evidence snippet and finding message before a value enters
 * the canonical report, mirroring the pack's `secret-scan` redaction rule
 * (type marker only, never the value). Patterns cover the token families the
 * `secret-scan` skill documents plus webhook/bot URLs.
 *
 * @module dsh-security-pack/vet/redact
 */
/** Replace every secret-shaped substring with a type marker. */
export declare function redact(text: string): string;
/** Cap a raw snippet and redact it for use as finding evidence. */
export declare function redactSnippet(text: string, maxChars?: number): string;
