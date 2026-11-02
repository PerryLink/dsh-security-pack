/**
 * Model-facing renderers for the plugin_vet report: the canonical JSON value
 * becomes a compact markdown report (render), a pending-call card
 * (presentCall), and a completed gate card (presentResult). Everything is
 * pure and capped — no secrets (the engine redacts before this layer), no
 * unbounded trees.
 *
 * @module dsh-security-pack/vet/report
 */
import { type Lang } from './skills.js';
import type { VetReport, VetScores } from './vocabulary.js';
/** Five-dimension score line. */
export declare function scoresLine(scores: VetScores, lang: Lang): string;
/** Render the canonical report as model-facing markdown. */
export declare function renderReport(report: VetReport, lang: Lang): string;
/** Short gate summary for the completed card (≤ a few lines). */
export declare function gateSummary(report: VetReport, lang: Lang): string;
