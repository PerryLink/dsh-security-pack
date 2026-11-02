/**
 * Bounded file collection: walks a local directory or normalizes an extracted
 * tarball into one shared `ScannedFile` list. Everything is budget-capped so a
 * hostile or simply huge target can never exhaust memory or wall time; caps are
 * reported back as truncation, never hidden.
 *
 * @module dsh-security-pack/vet/walk
 */
/** One collected file: path relative to the target root, decoded text when readable. */
export interface ScannedFile {
    readonly path: string;
    readonly text: string | null;
    /** Binary content (NUL byte detected); text is null. */
    readonly binary: boolean;
    /** Files that exceeded per-file budget or failed to decode; null for normal files. */
    readonly skipped: 'too-large' | 'binary' | 'decode' | null;
}
/** Budget facts so reports never present truncation as completeness. */
export interface ScanBudget {
    filesScanned: number;
    filesSkipped: number;
    bytesScanned: number;
    truncated: boolean;
    truncatedReason?: string;
}
/** Normalize an extracted tarball's file map into the shared scanned-file list. */
export declare function filesFromMap(files: Map<string, Uint8Array>, maxFileBytes: number): {
    files: ScannedFile[];
    budget: ScanBudget;
};
/** Walk a local directory with caps; symlinks are never followed. */
export declare function walkLocal(root: string, maxFiles: number, maxFileBytes: number): Promise<{
    files: ScannedFile[];
    budget: ScanBudget;
}>;
/** Resolve the strip-prefix of a codeload/npm tarball (its single top-level dir). */
export declare function stripRoot(files: Map<string, Uint8Array>): string;
