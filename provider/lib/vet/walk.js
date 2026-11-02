/**
 * Bounded file collection: walks a local directory or normalizes an extracted
 * tarball into one shared `ScannedFile` list. Everything is budget-capped so a
 * hostile or simply huge target can never exhaust memory or wall time; caps are
 * reported back as truncation, never hidden.
 *
 * @module dsh-security-pack/vet/walk
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
/** Directories never descended into (generated/third-party content). */
const SKIPPED_DIRS = new Set([
    'node_modules', '.git', '.hg', '.svn', '.pnpm-store',
    'dist', 'build', '.next', '.nuxt', '.cache', '.parcel-cache', 'coverage',
    'target', '.venv', 'venv', '__pycache__', '.tmp', '.idea', '.vscode', '.turbo',
    'pack', 'out',
]);
/** File names never collected. */
const SKIPPED_FILES = new Set(['.DS_Store', 'Thumbs.db', '.gitignore', '.npmignore', '.eslintcache']);
/** Detect binary content cheaply: NUL bytes within the first 8 KiB. */
function looksBinary(buffer) {
    const probe = buffer.subarray(0, Math.min(buffer.byteLength, 8192));
    return probe.includes(0);
}
/** Decode UTF-8 lossily; the decoder replaces invalid sequences instead of throwing. */
function decodeText(buffer) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}
/** Normalize an extracted tarball's file map into the shared scanned-file list. */
export function filesFromMap(files, maxFileBytes) {
    const scanned = [];
    let bytesScanned = 0;
    let skipped = 0;
    let truncated = false;
    let truncatedReason;
    for (const [path, content] of files) {
        const name = basename(path);
        if (SKIPPED_FILES.has(name))
            continue;
        if (content.byteLength > maxFileBytes) {
            skipped += 1;
            truncated = true;
            truncatedReason = `file ${path} exceeded the ${maxFileBytes}-byte per-file cap`;
            scanned.push({ path, text: null, binary: false, skipped: 'too-large' });
            continue;
        }
        if (looksBinary(content)) {
            skipped += 1;
            scanned.push({ path, text: null, binary: true, skipped: 'binary' });
            continue;
        }
        scanned.push({ path, text: decodeText(content), binary: false, skipped: null });
        bytesScanned += content.byteLength;
    }
    return {
        files: scanned,
        budget: { filesScanned: scanned.length, filesSkipped: skipped, bytesScanned, truncated, truncatedReason },
    };
}
/** Walk a local directory with caps; symlinks are never followed. */
export async function walkLocal(root, maxFiles, maxFileBytes) {
    const scanned = [];
    let skipped = 0;
    let truncated = false;
    let truncatedReason;
    let bytesScanned = 0;
    let seen = 0;
    async function visit(dir, base) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (truncated)
                return;
            const abs = join(dir, entry.name);
            const rel = (base === '' ? entry.name : `${base}/${entry.name}`);
            if (entry.isDirectory()) {
                if (SKIPPED_DIRS.has(entry.name))
                    continue;
                await visit(abs, rel);
                continue;
            }
            if (!entry.isFile())
                continue;
            seen += 1;
            if (seen > maxFiles) {
                truncated = true;
                truncatedReason = `target exceeds the ${maxFiles}-file scan cap`;
                return;
            }
            if (SKIPPED_FILES.has(entry.name))
                continue;
            let buffer;
            try {
                const info = await stat(abs);
                if (info.size > maxFileBytes) {
                    skipped += 1;
                    scanned.push({ path: rel, text: null, binary: false, skipped: 'too-large' });
                    continue;
                }
                buffer = await readFile(abs);
            }
            catch {
                skipped += 1;
                scanned.push({ path: rel, text: null, binary: false, skipped: 'decode' });
                continue;
            }
            if (looksBinary(buffer)) {
                skipped += 1;
                scanned.push({ path: rel, text: null, binary: true, skipped: 'binary' });
                continue;
            }
            scanned.push({ path: rel, text: decodeText(buffer), binary: false, skipped: null });
            bytesScanned += buffer.byteLength;
        }
    }
    await visit(root, '');
    return {
        files: scanned,
        budget: {
            filesScanned: scanned.length,
            filesSkipped: skipped,
            bytesScanned,
            truncated: truncated || scanned.some(f => f.skipped === 'too-large'),
            truncatedReason: truncatedReason ?? (scanned.some(f => f.skipped === 'too-large') ? 'some files exceeded the per-file byte cap' : undefined),
        },
    };
}
/** Resolve the strip-prefix of a codeload/npm tarball (its single top-level dir). */
export function stripRoot(files) {
    let prefix = '';
    for (const path of files.keys()) {
        const slash = path.indexOf('/');
        if (slash === -1)
            continue;
        const candidate = path.slice(0, slash);
        if (prefix === '')
            prefix = candidate;
        else if (candidate !== prefix)
            return '';
    }
    return prefix;
}
