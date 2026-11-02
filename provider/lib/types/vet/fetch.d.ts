/**
 * Zero-dependency network access for the scan engine.
 *
 * Only `globalThis.fetch` (Node 18+ built-in undici) is used. Every request:
 *  - honors the caller's AbortSignal AND a cooperative timeout
 *    (`AbortSignal.any` + `AbortSignal.timeout`), so a hung upstream can never
 *    stall a session;
 *  - enforces a hard byte cap while reading the body (stream-counted, no
 *    unbounded buffering);
 *  - sends a fixed User-Agent and never attaches credentials.
 *
 * @module dsh-security-pack/vet/fetch
 */
/** Options shared by all fetch helpers. */
export interface FetchOptions {
    readonly signal?: AbortSignal;
    readonly timeoutMs: number;
    readonly userAgent: string;
    /** Hard cap on the response body in bytes; oversized bodies abort early. */
    readonly maxBytes: number;
}
/** A successfully read (possibly truncated) text body. */
export interface FetchedText {
    readonly status: number;
    readonly text: string;
    readonly truncated: boolean;
}
/** A successfully read binary body (kept in memory; capped). */
export interface FetchedBuffer {
    readonly status: number;
    readonly buffer: Uint8Array;
    readonly truncated: boolean;
}
/** A network failure — always surfaced as a check `skip`, never as a finding. */
export declare class VetFetchError extends Error {
    readonly kind: 'timeout' | 'aborted' | 'http' | 'network' | 'too-large';
    constructor(kind: VetFetchError['kind'], message: string);
}
/** Fetch a text body with size cap. */
export declare function fetchText(url: string, options: FetchOptions): Promise<FetchedText>;
/** Fetch a binary body with size cap (tarballs). */
export declare function fetchBuffer(url: string, options: FetchOptions): Promise<FetchedBuffer>;
