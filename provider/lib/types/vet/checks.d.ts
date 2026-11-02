/**
 * The eight plugin_vet checks. Every function is pure: it reads the shared
 * inputs and returns one `VetCheck` with redacted, capped findings. No check
 * touches the network or the filesystem — resolution happened upstream in
 * `source.ts`.
 *
 * @module dsh-security-pack/vet/checks
 */
import { type LockData, type Manifest } from './manifest.js';
import { type GitHubMeta, type NpmMeta, type ResolvedTarget } from './source.js';
import { type Lang } from './skills.js';
import type { VetConfig } from './config.js';
import type { ScannedFile } from './walk.js';
import type { CheckId, VetCheck, VetSbom } from './vocabulary.js';
import type { ScannerResult } from './scanners.js';
/** Shared inputs every check reads. */
export interface CheckInputs {
    readonly files: ScannedFile[];
    readonly manifest: Manifest;
    readonly lock: LockData;
    readonly github: GitHubMeta | null;
    readonly npm: NpmMeta | null;
    readonly target: ResolvedTarget;
    readonly config: VetConfig;
    readonly lang: Lang;
    /** 40-hex HEAD of a local git target, when readable without spawning git. */
    readonly localHead: string;
    readonly now: number;
    /** Dependency-scanner result (builtin or an external CLI), when computed. */
    readonly scanner?: ScannerResult;
}
/** One check run: the check plus its optional SBOM payload. */
export interface CheckResult {
    readonly check: VetCheck;
    readonly sbom?: VetSbom;
}
export declare function licenseCheck(inputs: CheckInputs): VetCheck;
export declare function sbomCheck(inputs: CheckInputs): CheckResult;
export declare function commitLockCheck(inputs: CheckInputs): VetCheck;
export declare function installScriptsCheck(inputs: CheckInputs): VetCheck;
export declare function networkExfilCheck(inputs: CheckInputs): VetCheck;
export declare function obfuscationCheck(inputs: CheckInputs): VetCheck;
export declare function sourceCheck(inputs: CheckInputs): VetCheck;
export declare function maintenanceCheck(inputs: CheckInputs): VetCheck;
export declare function dataResponsibilityCheck(inputs: CheckInputs): VetCheck;
/** Run the requested checks over shared inputs. */
export declare function runChecks(inputs: CheckInputs, ids: readonly CheckId[]): CheckResult[];
