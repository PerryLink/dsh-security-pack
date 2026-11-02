/**
 * Resolved plugin_vet configuration: plain values with defaults applied.
 *
 * The Schemastery schema lives in `../index.ts` next to the skills-provider
 * config; this module only consumes the already-validated plain object so the
 * engine never depends on Schemastery at runtime.
 *
 * @module dsh-security-pack/vet/config
 */
import type { GatePolicy } from './vocabulary.js';
/** Raw config block as validated by the Schemastery schema. */
export interface VetConfigInput {
    readonly enable?: boolean;
    readonly timeoutMs?: number;
    readonly maxFiles?: number;
    readonly maxFileBytes?: number;
    readonly maxExtractBytes?: number;
    readonly maxDepNodes?: number;
    readonly maxFindingsPerCheck?: number;
    readonly userAgent?: string;
    readonly dataResponsibility?: boolean;
    /** Orchestrate osv-scanner/npm audit when their CLIs are present (default true). */
    readonly externalScanners?: boolean;
    readonly gate?: {
        readonly policy?: GatePolicy;
    };
}
/** Fully resolved configuration with defaults applied. */
export interface VetConfig {
    readonly enable: boolean;
    readonly timeoutMs: number;
    readonly maxFiles: number;
    readonly maxFileBytes: number;
    readonly maxExtractBytes: number;
    readonly maxDepNodes: number;
    readonly maxFindingsPerCheck: number;
    readonly userAgent: string;
    readonly dataResponsibility: boolean;
    readonly externalScanners: boolean;
    readonly gate: {
        readonly policy: GatePolicy;
    };
}
export declare const VET_DEFAULTS: VetConfig;
/** Merge raw config over the defaults (the schema already validated shape/ranges). */
export declare function resolveVetConfig(raw: VetConfigInput | undefined): VetConfig;
