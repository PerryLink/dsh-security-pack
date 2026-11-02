/**
 * The `plugin_vet` tool definition: schema-validated arguments, a strictly
 * validated canonical report, a model-facing markdown render, and the
 * pending/completed UI cards. This is the only module in the vet engine that
 * imports harness packages; everything below it is plain zero-dependency code.
 *
 * @module dsh-security-pack/vet/tool
 */
import type { VetConfig } from './config.js';
import type { Lang } from './skills.js';
/**
 * Build the plugin_vet tool bound to the resolved plugin configuration.
 * @param config - resolved vet configuration (defaults already applied).
 * @param lang - report language, driven by the plugin's `language` config.
 */
export declare function buildVetTool(config: VetConfig, lang: Lang): import("@deepseek-ai/dsh-tools").ToolDefinition;
