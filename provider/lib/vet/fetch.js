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
/** A network failure — always surfaced as a check `skip`, never as a finding. */
export class VetFetchError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = 'VetFetchError';
        this.kind = kind;
    }
}
/** Compose the caller signal with the cooperative timeout. */
function combinedSignal(options) {
    const timeout = AbortSignal.timeout(options.timeoutMs);
    return options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout]);
}
/** Map a fetch rejection into a classified VetFetchError. */
function classify(error) {
    if (error instanceof VetFetchError)
        return error;
    if (error instanceof Error && error.name === 'TimeoutError') {
        return new VetFetchError('timeout', `network request timed out: ${error.message}`);
    }
    if (error instanceof Error && error.name === 'AbortError') {
        return new VetFetchError('aborted', 'network request was aborted');
    }
    const message = error instanceof Error ? error.message : String(error);
    return new VetFetchError('network', `network request failed: ${message}`);
}
/** Fetch a text body with size cap. */
export async function fetchText(url, options) {
    let response;
    try {
        response = await fetch(url, {
            signal: combinedSignal(options),
            headers: { 'user-agent': options.userAgent, accept: 'application/json, text/plain, */*' },
            redirect: 'follow',
        });
    }
    catch (error) {
        throw classify(error);
    }
    if (!response.ok) {
        throw new VetFetchError('http', `HTTP ${response.status} for ${url}`);
    }
    const reader = response.body?.getReader();
    if (reader === undefined) {
        return { status: response.status, text: await response.text(), truncated: false };
    }
    const chunks = [];
    let bytes = 0;
    let truncated = false;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes += value.byteLength;
            if (bytes > options.maxBytes) {
                truncated = true;
                await reader.cancel();
                break;
            }
            chunks.push(value);
        }
    }
    catch (error) {
        throw classify(error);
    }
    const buffer = Buffer.concat(chunks);
    return { status: response.status, text: buffer.toString('utf8'), truncated };
}
/** Fetch a binary body with size cap (tarballs). */
export async function fetchBuffer(url, options) {
    let response;
    try {
        response = await fetch(url, {
            signal: combinedSignal(options),
            headers: { 'user-agent': options.userAgent },
            redirect: 'follow',
        });
    }
    catch (error) {
        throw classify(error);
    }
    if (!response.ok) {
        throw new VetFetchError('http', `HTTP ${response.status} for ${url}`);
    }
    const reader = response.body?.getReader();
    if (reader === undefined) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        return { status: response.status, buffer, truncated: buffer.byteLength > options.maxBytes };
    }
    const chunks = [];
    let bytes = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes += value.byteLength;
            if (bytes > options.maxBytes) {
                await reader.cancel();
                throw new VetFetchError('too-large', `response exceeds the ${options.maxBytes} byte cap`);
            }
            chunks.push(value);
        }
    }
    catch (error) {
        throw classify(error);
    }
    return { status: response.status, buffer: Buffer.concat(chunks), truncated: false };
}
