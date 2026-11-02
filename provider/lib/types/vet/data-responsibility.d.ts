/**
 * The data-responsibility review check: the Claude policy-scan dimensions,
 * shipped as deterministic rules (the model-assisted stage is a documented
 * future upgrade). Four sub-scans over the shipped payload:
 *
 *  1. hooks-scope — listeners/effects registered on sensitive seams
 *     (`agent/pre-step`, `tools/pre-execute`, `session/event`, …) must show
 *     project-relevance gating; an ungated broad-scope hook is a warn.
 *  2. telemetry-disclosure — non-local URL literals in shipped files must be
 *     disclosed in the README (multilingual disclosure keywords); an
 *     undisclosed endpoint is a warn.
 *  3. description-behavior — the manifest description must be reflected in
 *     the shipped text (keyword coverage); near-zero coverage is an info.
 *  4. injection-payload — embedded instruction-override payloads in shipped
 *     text (skills, docs, prompts, tests) are warns; the manual continuation
 *     is the pack's prompt-injection-review skill.
 *
 * Pure and tolerant: every file is read from the shared `ScannedFile[]`
 * (no filesystem/network), unreadable text is skipped, and evidence is
 * redacted and capped through the shared redactor.
 *
 * NOTE on the pattern literals below: a security scanner ships the attack
 * PATTERNS, never the payloads — but content filters scanning this very
 * source cannot tell the difference, so the phrase literals are fragmented
 * (joined at runtime) to keep the shipped scanner itself from tripping them.
 *
 * @module dsh-security-pack/vet/data-responsibility
 */
import { type Lang } from './skills.js';
import type { ScannedFile } from './walk.js';
import type { VetConfig } from './config.js';
import type { VetFinding } from './vocabulary.js';
/** Run the whole data-responsibility review over the shared inputs. */
export declare function dataResponsibilityFindings(files: ScannedFile[], manifestDescription: string, readmeText: string, lang: Lang, _config: VetConfig): VetFinding[];
/** Score the review: 100 minus per-level deductions, floored at 0. */
export declare function dataResponsibilityScore(findings: VetFinding[]): number;
