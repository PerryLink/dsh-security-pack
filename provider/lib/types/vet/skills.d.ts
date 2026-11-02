/**
 * Skill cross-references and report-language strings for plugin_vet.
 *
 * Every check cites the pack skill (and section) that continues its subject
 * as a manual audit — "skill 教流程，插件自动执行". Skill names are identical
 * in the zh/en editions, so the reference is language-neutral.
 *
 * @module dsh-security-pack/vet/skills
 */
import type { CheckId, Dimension } from './vocabulary.js';
export type Lang = 'zh' | 'en';
/** check id → pack skill + section (the manual deep-dive continuation). */
export declare const SKILL_REF: Record<CheckId, string>;
/** check id → human-readable check name per language. */
export declare const CHECK_NAME: Record<Lang, Record<CheckId, string>>;
/** dimension → label per language. */
export declare const DIMENSION_LABEL: Record<Lang, Record<Dimension, string>>;
/** Messages shared by checks and the report renderer. */
export declare const T: {
    readonly zh: {
        readonly pass: '通过';
        readonly warn: '警告';
        readonly fail: '失败';
        readonly skip: '跳过';
        readonly verdictPass: 'PASS';
        readonly verdictWarn: 'WARN';
        readonly verdictFail: 'FAIL';
        readonly gateDenyTitle: '门禁 DENY：此插件未通过供应链检查，安装已被策略拒绝';
        readonly gateDenyBody: '请加载 supply-chain-review / dependency-audit 技能人工深审；或由可信维护者修改门禁策略后重试。';
        readonly gateWarnTitle: '门禁警告：plugin_vet 结果为 FAIL，强烈建议停止安装';
        readonly gateWarnBody: '默认策略 warn 不阻断。继续安装前请按下方 skill 引用人工深审，确认风险可接受。';
        readonly followup: '人工深审建议（加载对应技能继续）';
        readonly budget: '扫描预算';
        readonly budgetTruncated: '扫描被预算截断：结果不完整';
        readonly offline: '离线/受限';
        readonly evidence: '证据';
    };
    readonly en: {
        readonly pass: 'pass';
        readonly warn: 'warn';
        readonly fail: 'fail';
        readonly skip: 'skip';
        readonly verdictPass: 'PASS';
        readonly verdictWarn: 'WARN';
        readonly verdictFail: 'FAIL';
        readonly gateDenyTitle: 'Gate DENY: this plugin failed the supply-chain checks; installation is blocked by policy';
        readonly gateDenyBody: 'Load the supply-chain-review / dependency-audit skills for a manual deep-dive, or have a trusted maintainer change the gate policy and retry.';
        readonly gateWarnTitle: 'Gate warning: plugin_vet returned FAIL — installation is strongly discouraged';
        readonly gateWarnBody: 'The default policy is warn (non-blocking). Before continuing the install, follow the skill references below for a manual review and confirm the risk is acceptable.';
        readonly followup: 'Manual deep-dive (load these skills to continue)';
        readonly budget: 'Scan budget';
        readonly budgetTruncated: 'Scan truncated by budget: results are incomplete';
        readonly offline: 'Offline/limited';
        readonly evidence: 'Evidence';
    };
};
