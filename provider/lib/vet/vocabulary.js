/**
 * Shared vocabulary for the plugin_vet supply-chain gate.
 *
 * Everything here is plain data (JSON-safe, no live runtime objects) so the
 * scan engine stays a pure, harness-free module: the tool definition in
 * `tool.ts` is the only part that touches ctx/defineTool.
 *
 * @module dsh-security-pack/vet/vocabulary
 */
export const ALL_CHECK_IDS = [
    'license',
    'sbom',
    'commit-lock',
    'install-scripts',
    'network-exfil',
    'obfuscation',
    'source',
    'maintenance',
    'data-responsibility',
];
