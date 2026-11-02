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
import { resolve } from 'node:path';
import { VetFetchError, fetchBuffer, fetchText } from './fetch.js';
import { extractTarGz } from './tar.js';
import { filesFromMap, stripRoot, walkLocal } from './walk.js';
const GITHUB_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@(.+))?$/;
const NPM_RE = /^npm:((?:@[^/]+\/)?[^@/]+)@?(.+)$/;
const HEX40 = /^[0-9a-f]{40}$/i;
function record(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return {};
    const out = {};
    for (const [key, spec] of Object.entries(value)) {
        if (typeof spec === 'string')
            out[key] = spec;
    }
    return out;
}
async function githubMeta(owner, repo, config, signal) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const empty = {
        exists: false, defaultBranch: '', licenseSpdx: null, licenseName: null,
        pushedAt: '', createdAt: '', archived: false, stars: 0, description: '', rateLimited: false,
    };
    try {
        const fetched = await fetchText(url, { signal, timeoutMs: config.timeoutMs, userAgent: config.userAgent, maxBytes: 512 * 1024 });
        const json = JSON.parse(fetched.text);
        const license = json['license'];
        return {
            exists: true,
            defaultBranch: typeof json['default_branch'] === 'string' ? json['default_branch'] : 'main',
            licenseSpdx: typeof license?.['spdx_id'] === 'string' ? license['spdx_id'] : null,
            licenseName: typeof license?.['name'] === 'string' ? license['name'] : null,
            pushedAt: typeof json['pushed_at'] === 'string' ? json['pushed_at'] : '',
            createdAt: typeof json['created_at'] === 'string' ? json['created_at'] : '',
            archived: json['archived'] === true,
            stars: typeof json['stargazers_count'] === 'number' ? json['stargazers_count'] : 0,
            description: typeof json['description'] === 'string' ? json['description'] : '',
            rateLimited: false,
        };
    }
    catch (error) {
        if (error instanceof VetFetchError && error.kind === 'http' && error.message.includes('404')) {
            return empty;
        }
        if (error instanceof VetFetchError && error.kind === 'http' && /(403|429)/.test(error.message)) {
            // Rate-limited: fall back to rate-limit-free endpoints for the tarball
            // and default branch; timestamps/stars stay unknown.
            return { ...empty, exists: true, rateLimited: true, defaultBranch: await defaultBranchViaRefs(owner, repo, config, signal) };
        }
        throw error;
    }
}
/**
 * Default-branch discovery without the REST API: the git smart-HTTP refs
 * advertisement carries `symref=HEAD:refs/heads/<branch>`. No rate limit.
 */
async function defaultBranchViaRefs(owner, repo, config, signal) {
    try {
        const fetched = await fetchText(`https://github.com/${owner}/${repo}.git/info/refs?service=git-upload-pack`, { signal, timeoutMs: config.timeoutMs, userAgent: 'git/dsh-security-pack', maxBytes: 1024 * 1024 });
        const symref = /symref=HEAD:refs\/heads\/([^\s]+)/.exec(fetched.text);
        if (symref !== null)
            return symref[1];
        const main = /refs\/heads\/(main|master)\s*$/.exec(fetched.text);
        if (main !== null)
            return main[1];
    }
    catch {
        // best effort; caller falls back to 'main'
    }
    return 'main';
}
function stripPrefix(files, prefix) {
    if (prefix === '')
        return files;
    const out = new Map();
    for (const [path, content] of files) {
        if (path.startsWith(`${prefix}/`))
            out.set(path.slice(prefix.length + 1), content);
        else
            out.set(path, content);
    }
    return out;
}
async function resolveRemote(kind, resolved, ref, tarballUrl, config, signal, github, npm) {
    let fetched;
    try {
        // Tarballs are the slow part of a scan: give them triple the cooperative
        // timeout while keeping the caller's AbortSignal authoritative.
        fetched = await fetchBuffer(tarballUrl, {
            signal, timeoutMs: config.timeoutMs * 3, userAgent: config.userAgent, maxBytes: config.maxExtractBytes,
        });
    }
    catch (error) {
        if (error instanceof VetFetchError && error.kind === 'http' && error.message.includes('404')) {
            return { kind, resolved, ref, files: [], budget: { filesScanned: 0, filesSkipped: 0, bytesScanned: 0, truncated: false, truncatedReason: `tarball not found for ${resolved}@${ref}` }, github, npm };
        }
        throw error;
    }
    const extracted = extractTarGz(fetched.buffer, {
        maxTotalBytes: config.maxExtractBytes,
        maxFileBytes: config.maxFileBytes,
        maxFiles: config.maxFiles,
    });
    const root = stripRoot(extracted.files);
    const stripped = stripPrefix(extracted.files, root);
    const { files, budget } = filesFromMap(stripped, config.maxFileBytes);
    if (extracted.truncated && budget.truncatedReason === undefined) {
        budget.truncated = true;
        budget.truncatedReason = 'tarball extraction hit the byte/file budget';
    }
    return { kind, resolved, ref, files, budget, github, npm };
}
async function npmMeta(name, version, config, signal) {
    const escaped = name.startsWith('@') ? name.replace('/', '%2F') : name;
    const url = `https://registry.npmjs.org/${escaped}/${version}`;
    const empty = {
        exists: false, name, version, license: '', gitHead: '', repository: '',
        scripts: {}, dependencies: {}, devDependencies: {}, distIntegrity: '', timeModified: '', deprecated: '',
    };
    try {
        const fetched = await fetchText(url, { signal, timeoutMs: config.timeoutMs, userAgent: config.userAgent, maxBytes: 8 * 1024 * 1024 });
        const json = JSON.parse(fetched.text);
        const repository = json['repository'];
        let repositoryString = '';
        if (typeof repository === 'string')
            repositoryString = repository;
        else if (typeof repository === 'object' && repository !== null && !Array.isArray(repository)) {
            const repoUrl = repository['url'];
            if (typeof repoUrl === 'string')
                repositoryString = repoUrl;
        }
        const dist = json['dist'];
        const license = json['license'];
        let licenseString = '';
        if (typeof license === 'string')
            licenseString = license;
        else if (typeof license === 'object' && license !== null && !Array.isArray(license)) {
            const type = license['type'];
            if (typeof type === 'string')
                licenseString = type;
        }
        return {
            exists: true,
            name: typeof json['name'] === 'string' ? json['name'] : name,
            version: typeof json['version'] === 'string' ? json['version'] : version,
            license: licenseString,
            gitHead: typeof json['gitHead'] === 'string' ? json['gitHead'] : '',
            repository: repositoryString,
            scripts: record(json['scripts']),
            dependencies: record(json['dependencies']),
            devDependencies: record(json['devDependencies']),
            distIntegrity: typeof dist?.['integrity'] === 'string' ? dist['integrity'] : '',
            timeModified: '',
            deprecated: '',
        };
    }
    catch (error) {
        if (error instanceof VetFetchError && error.kind === 'http' && error.message.includes('404'))
            return empty;
        throw error;
    }
}
/** Resolve one target string into scan inputs. Never throws for network skips; hard budget violations propagate. */
export async function resolveTarget(raw, config, signal) {
    const trimmed = raw.trim();
    const npmMatch = NPM_RE.exec(trimmed);
    if (npmMatch !== null) {
        const name = npmMatch[1];
        const version = npmMatch[2];
        const meta = await npmMeta(name, version, config, signal);
        if (!meta.exists) {
            return {
                kind: 'npm-package', resolved: `${name}@${version}`, ref: version, files: [],
                budget: { filesScanned: 0, filesSkipped: 0, bytesScanned: 0, truncated: false, truncatedReason: 'package not found on the npm registry' },
                github: null, npm: meta,
            };
        }
        const escaped = name.startsWith('@') ? name.replace('/', '%2F') : name;
        const tarball = `https://registry.npmjs.org/${escaped}/-/${name.split('/').pop()}-${version}.tgz`;
        return resolveRemote('npm-package', `${name}@${version}`, version, tarball, config, signal, null, meta);
    }
    const githubMatch = GITHUB_RE.exec(trimmed);
    if (githubMatch !== null) {
        const owner = githubMatch[1];
        const repo = githubMatch[2];
        const meta = await githubMeta(owner, repo, config, signal);
        if (!meta.exists) {
            return {
                kind: 'github-repo', resolved: `${owner}/${repo}`, ref: githubMatch[3] ?? '', files: [],
                budget: { filesScanned: 0, filesSkipped: 0, bytesScanned: 0, truncated: false, truncatedReason: 'repository not found on GitHub' },
                github: meta, npm: null,
            };
        }
        const ref = githubMatch[3] ?? meta.defaultBranch;
        const tarball = `https://codeload.github.com/${owner}/${repo}/tar.gz/${ref}`;
        return resolveRemote('github-repo', `${owner}/${repo}`, ref, tarball, config, signal, meta, null);
    }
    // Local path fallback: relative paths resolve against the process cwd.
    const abs = resolve(trimmed);
    const { files, budget } = await walkLocal(abs, config.maxFiles, config.maxFileBytes);
    return { kind: 'local-path', resolved: abs, ref: '', files, budget, github: null, npm: null };
}
/** Whether a ref string is a 40-hex immutable commit. */
export function isCommitRef(ref) {
    return HEX40.test(ref.trim());
}
