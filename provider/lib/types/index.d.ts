/**
 * Provider plugin for dsh-security-pack — "skill 教流程，插件自动执行".
 *
 * Registers two capabilities:
 *  1. a SkillProvider on `ctx.skills` whose candidates are this package's own
 *     `skills/` directory (reusing the official `FileSystemSkillProvider`, so
 *     frontmatter parsing semantics are byte-identical with the built-in
 *     provider), and
 *  2. the `plugin_vet` supply-chain gate tool on `ctx.tools`: an automated
 *     pre-install scanner (license / SBOM / commit pinning / malicious
 *     patterns / five-dimension risk score) whose every finding cites the
 *     pack skill section to continue as a manual audit.
 *
 * The scan engine is zero-dependency (Node built-ins only) and the plugin
 * injects no prompt paragraphs: the gate lives entirely in the tool result,
 * keeping the session persona untouched.
 *
 * @module dsh-security-pack/provider
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type VetConfigInput } from './vet/config.js';
export declare const name = "skill-pack-security";
export declare const inject: string[];
/** The skill language the provider publishes (and the plugin_vet report language). */
export type PackLanguage = 'zh' | 'en';
/** plugin_vet gate policy: warn (default, non-blocking) or deny (blocks install on FAIL). */
export type GatePolicy = 'warn' | 'deny';
/** Configuration for the packaged skill provider. */
export interface Config {
    /** Whether to watch the packaged skills directory; packaged content is static, so default false. */
    watch?: boolean;
    /** Language edition to publish: the Chinese `skills/` or the English `skills-en/`. Ignored when `skillsDir` is set. */
    language?: PackLanguage;
    /** Explicit skills root; overrides the `language`-derived default. Must be a non-empty path to an existing root with `<skill>/SKILL.md` bundles. */
    skillsDir?: string;
    /** plugin_vet scanner + installation-gate configuration. */
    vet?: VetConfigInput;
}
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    watch: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
    language: z<"en" | "zh", "en" | "zh", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
    skillsDir: z<string, string, Mode>;
    vet: z<Schemastery.ObjectS<NoInfer<{
        enable: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        timeoutMs: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFiles: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFileBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxExtractBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxDepNodes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFindingsPerCheck: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        userAgent: z<string, string, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        dataResponsibility: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        externalScanners: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        gate: z<Schemastery.ObjectS<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, "plain">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enable: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        timeoutMs: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFiles: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFileBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxExtractBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxDepNodes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFindingsPerCheck: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        userAgent: z<string, string, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        dataResponsibility: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        externalScanners: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        gate: z<Schemastery.ObjectS<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, "plain">;
    }>>, "plain">;
}>>, Schemastery.ObjectT<NoInfer<{
    watch: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
    language: z<"en" | "zh", "en" | "zh", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
    skillsDir: z<string, string, Mode>;
    vet: z<Schemastery.ObjectS<NoInfer<{
        enable: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        timeoutMs: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFiles: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFileBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxExtractBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxDepNodes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFindingsPerCheck: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        userAgent: z<string, string, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        dataResponsibility: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        externalScanners: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        gate: z<Schemastery.ObjectS<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, "plain">;
    }>>, Schemastery.ObjectT<NoInfer<{
        enable: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        timeoutMs: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFiles: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFileBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxExtractBytes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxDepNodes: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        maxFindingsPerCheck: z<number, number, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        userAgent: z<string, string, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        dataResponsibility: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        externalScanners: z<boolean, boolean, Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        gate: z<Schemastery.ObjectS<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            policy: z<"deny" | "warn", "deny" | "warn", Mode extends "volatile" | "volatile-defined" ? "volatile-defined" : "defined">;
        }>>, "plain">;
    }>>, "plain">;
}>>, "plain">;
/** Register the packaged skills directory as a custom-root provider. */
export declare function apply(ctx: Context, config?: Config): void;
