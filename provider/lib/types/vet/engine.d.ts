/**
 * plugin_vet engine: resolves a target, runs the eight checks, scores the five
 * risk dimensions, applies the installation gate, and returns the canonical
 * report. Pure orchestration — all side effects live in `source.ts`/`fetch.ts`
 * and every value produced here is JSON-safe and redacted.
 *
 * @module dsh-security-pack/vet/engine
 */
import { type GatePolicy, type VetReport } from './vocabulary.js';
import type { VetConfig } from './config.js';
import { type Lang } from './skills.js';
/** Engine-level failure: target unusable (not found, offline, budget). */
export declare class VetTargetError extends Error {
    constructor(message: string);
}
/** Tool argument shape (already JSON-validated by defineTool). */
export interface VetArgs {
    readonly target: string;
    readonly ref?: string;
    readonly checks?: string[];
    readonly policy?: 'inherit' | GatePolicy;
}
/** Run the whole pipeline for one tool call. */
export declare function runVet(args: VetArgs, config: VetConfig, lang: Lang, signal: AbortSignal | undefined): Promise<VetReport>;
