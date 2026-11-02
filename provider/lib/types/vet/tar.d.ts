/**
 * Minimal gzip + ustar (POSIX tar) extractor — zero dependencies.
 *
 * Only the pieces needed to unpack registry/codeload tarballs: regular files,
 * directories, symlinks (recorded, never followed), GNU long-name (`L`) and
 * pax (`x`/`g`) extended headers. Hard constraints:
 *  - path traversal is rejected (absolute paths, `..`, drive letters);
 *  - total bytes, per-file bytes, and file count are capped;
 *  - symlink targets are stored as strings only (never materialized).
 *
 * @module dsh-security-pack/vet/tar
 */
/** Budget caps for one extraction. */
export interface TarBudget {
    /** Hard cap on total extracted payload bytes. */
    readonly maxTotalBytes: number;
    /** Per-file cap; larger members are dropped and `truncated` is set. */
    readonly maxFileBytes: number;
    /** Hard cap on the number of extracted file members. */
    readonly maxFiles: number;
}
/** One extracted member. Directories are implied by file paths. */
export interface TarEntry {
    readonly path: string;
    readonly content: Uint8Array;
}
/** Result of one extraction. */
export interface TarResult {
    readonly files: Map<string, Uint8Array>;
    readonly symlinks: Map<string, string>;
    readonly truncated: boolean;
    readonly totalBytes: number;
}
/** Extract one gzipped ustar archive into an in-memory file map. */
export declare function extractTarGz(gzipped: Uint8Array, budget: TarBudget): TarResult;
