/**
 * Dependency-vulnerability scanner Provider seam.
 *
 * The `sbom` check can hand its dependency evidence to an external scanner
 * (`osv-scanner` or `npm audit`) when that CLI is present, and degrade to the
 * built-in zero-dependency tree scan otherwise. Every scanner declares its
 * `source`, so the report never misattributes findings. Probing is
 * "detect → use → graceful degrade": any spawn failure (CLI absent, sandbox
 * restriction, non-zero exit, unparseable output) resolves to an unavailable
 * scanner instead of throwing.
 *
 * @module dsh-security-pack/vet/scanners
 */
import type { ScannerSource, VulnIssue } from './vocabulary.js';
/** Result of probing and (optionally) running one scanner. */
export interface ScannerResult {
    readonly source: ScannerSource;
    /** Whether the scanner could run against `dir`. */
    readonly available: boolean;
    /** Why it was unavailable (CLI missing, no lockfile, timeout, parse error). */
    readonly reason?: string;
    /** Vulnerabilities found; empty on a clean scan or when unavailable. */
    readonly issues: VulnIssue[];
}
/** The Provider contract a dependency scanner implements. */
export interface DependencyScanner {
    readonly source: ScannerSource;
    readonly label: string;
    /** Whether the scanner can run against `dir` (CLI present + target suitable). */
    probe(dir: string, timeoutMs: number, signal?: AbortSignal): Promise<boolean>;
    /** Run the scanner; never throws — failures degrade to an empty issue list. */
    scan(dir: string, timeoutMs: number, signal?: AbortSignal): Promise<VulnIssue[]>;
}
/** osv-scanner adapter: detects the CLI, scans the directory. */
export declare const osvScanner: DependencyScanner;
/** npm-audit adapter: detects a lockfile + the npm CLI, runs `npm audit`. */
export declare const npmAuditScanner: DependencyScanner;
/**
 * Probe the external scanners in preference order and return the first that is
 * available, or a `builtin` result (always available) when none is.
 * @param dir - the local target directory to scan (external scanners need it).
 * @param timeoutMs - per-CLI probe/scan timeout.
 * @param signal - caller abort signal (the tool-call signal).
 * @returns a result whose `source` names the effective scanner.
 */
export declare function probeDependencyScanner(dir: string, timeoutMs: number, signal?: AbortSignal): Promise<ScannerResult>;
