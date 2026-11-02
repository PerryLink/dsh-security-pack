/**
 * Target resolution: one `plugin_vet` target string becomes either
 *  - a local directory walk,
 *  - a GitHub repo (API metadata + codeload tarball, ref-aware), or
 *  - an npm package (registry metadata + published tarball).
 *
 * All remote work flows through the zero-dependency fetch helpers; every
 * failure is typed so the caller can mark affected checks `skip` instead of
 * inventing findings.
 *
 * @module dsh-security-pack/vet/source
 */
import { type ScannedFile, type ScanBudget } from './walk.js';
import type { VetConfig } from './config.js';
import type { TargetKind } from './vocabulary.js';
/** GitHub repo metadata the checks consume (subset of the REST API response). */
export interface GitHubMeta {
    readonly exists: boolean;
    readonly defaultBranch: string;
    readonly licenseSpdx: string | null;
    readonly licenseName: string | null;
    readonly pushedAt: string;
    readonly createdAt: string;
    readonly archived: boolean;
    readonly stars: number;
    readonly description: string;
    /** The REST API was rate-limited: timestamps/stars are unavailable (files still scanned). */
    readonly rateLimited: boolean;
}
/** npm registry metadata the checks consume. */
export interface NpmMeta {
    readonly exists: boolean;
    readonly name: string;
    readonly version: string;
    readonly license: string;
    readonly gitHead: string;
    readonly repository: string;
    readonly scripts: Record<string, string>;
    readonly dependencies: Record<string, string>;
    readonly devDependencies: Record<string, string>;
    readonly distIntegrity: string;
    readonly timeModified: string;
    readonly deprecated: string;
}
/** A resolved scan target: files, metadata, and identity. */
export interface ResolvedTarget {
    readonly kind: TargetKind;
    readonly resolved: string;
    readonly ref: string;
    readonly files: ScannedFile[];
    readonly budget: ScanBudget;
    readonly github: GitHubMeta | null;
    readonly npm: NpmMeta | null;
}
/** Resolve one target string into scan inputs. Never throws for network skips; hard budget violations propagate. */
export declare function resolveTarget(raw: string, config: VetConfig, signal?: AbortSignal): Promise<ResolvedTarget>;
/** Whether a ref string is a 40-hex immutable commit. */
export declare function isCommitRef(ref: string): boolean;
