/**
 * Manifest and lockfile parsing for the SBOM check — pure text/JSON parsing,
 * zero dependencies. Supports package.json plus pnpm-lock.yaml,
 * package-lock.json (v1–v3) and yarn.lock (v1); unknown formats are reported
 * as `unsupported`, never guessed.
 *
 * @module dsh-security-pack/vet/manifest
 */
import type { ScannedFile } from './walk.js';
import type { VetPackage } from './vocabulary.js';
/** Parsed package.json facts the checks consume. */
export interface Manifest {
    readonly name: string;
    readonly version: string;
    readonly license: string;
    readonly scripts: Record<string, string>;
    readonly dependencies: Record<string, string>;
    readonly devDependencies: Record<string, string>;
    readonly optionalDependencies: Record<string, string>;
    readonly peerDependencies: Record<string, string>;
    readonly repository: string;
    readonly description: string;
    readonly present: boolean;
}
/** One dependency edge inside a lockfile entry: name → raw spec. */
type DepMap = Record<string, string>;
/** Parsed lockfile summary. */
export interface LockData {
    readonly kind: 'pnpm' | 'npm' | 'yarn' | 'unsupported' | null;
    readonly lockfile: string | null;
    readonly lockfileVersion: string;
    /** name@version → its dependencies (name → spec). */
    readonly entries: Map<string, DepMap>;
    /** Whether any integrity/shasum field was seen (pinning signal). */
    readonly hasIntegrity: boolean;
}
/** Find and parse the first supported lockfile in the scan set. */
export declare function parseLockfile(files: ScannedFile[]): LockData;
/** Parse package.json when present. */
export declare function parseManifest(files: ScannedFile[]): Manifest;
/** Normalize a dependency spec into a bare version when possible. */
export declare function specVersion(spec: string): string;
/**
 * Build the dependency tree: BFS from the manifest's direct dependencies
 * through lockfile edges, deduped by name@version, depth- and node-capped.
 */
export declare function buildDependencyTree(manifest: Manifest, lock: LockData, maxNodes: number): {
    packages: VetPackage[];
    truncated: boolean;
    total: number;
};
/** Direct specs that are not exact-version pinned (a supply-chain signal). */
export declare function unpinnedSpecs(manifest: Manifest): string[];
export {};
