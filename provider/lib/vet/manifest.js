/**
 * Manifest and lockfile parsing for the SBOM check — pure text/JSON parsing,
 * zero dependencies. Supports package.json plus pnpm-lock.yaml,
 * package-lock.json (v1–v3) and yarn.lock (v1); unknown formats are reported
 * as `unsupported`, never guessed.
 *
 * @module dsh-security-pack/vet/manifest
 */
const LOCKFILE_NAMES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'npm-shrinkwrap.json', 'bun.lockb'];
/** Find and parse the first supported lockfile in the scan set. */
export function parseLockfile(files) {
    for (const name of LOCKFILE_NAMES) {
        const hit = files.find(file => file.path === name || file.path.endsWith(`/${name}`));
        if (hit === undefined || hit.text === null)
            continue;
        if (name === 'pnpm-lock.yaml')
            return parsePnpmLock(hit.text);
        if (name === 'package-lock.json' || name === 'npm-shrinkwrap.json')
            return parseNpmLock(hit.text, name);
        if (name === 'yarn.lock')
            return parseYarnLock(hit.text);
        if (name === 'bun.lockb') {
            return { kind: 'unsupported', lockfile: name, lockfileVersion: '', entries: new Map(), hasIntegrity: false };
        }
    }
    return { kind: null, lockfile: null, lockfileVersion: '', entries: new Map(), hasIntegrity: false };
}
/** Parse package.json when present. */
export function parseManifest(files) {
    const hit = files.find(file => file.path === 'package.json' || file.path.endsWith('/package.json'));
    const empty = {
        name: '', version: '', license: '', scripts: {},
        dependencies: {}, devDependencies: {}, optionalDependencies: {}, peerDependencies: {},
        repository: '', description: '', present: false,
    };
    if (hit === undefined || hit.text === null)
        return empty;
    let json;
    try {
        json = JSON.parse(hit.text);
    }
    catch {
        return empty;
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json))
        return empty;
    const pkg = json;
    const record = (value) => {
        if (typeof value !== 'object' || value === null || Array.isArray(value))
            return {};
        const out = {};
        for (const [key, spec] of Object.entries(value)) {
            if (typeof spec === 'string')
                out[key] = spec;
        }
        return out;
    };
    const licenseField = pkg['license'];
    let license = '';
    if (typeof licenseField === 'string')
        license = licenseField;
    else if (typeof licenseField === 'object' && licenseField !== null && !Array.isArray(licenseField)) {
        const type = licenseField['type'];
        if (typeof type === 'string')
            license = type;
    }
    const repository = pkg['repository'];
    let repositoryString = '';
    if (typeof repository === 'string')
        repositoryString = repository;
    else if (typeof repository === 'object' && repository !== null && !Array.isArray(repository)) {
        const url = repository['url'];
        if (typeof url === 'string')
            repositoryString = url;
    }
    return {
        name: typeof pkg['name'] === 'string' ? pkg['name'] : '',
        version: typeof pkg['version'] === 'string' ? pkg['version'] : '',
        license,
        scripts: record(pkg['scripts']),
        dependencies: record(pkg['dependencies']),
        devDependencies: record(pkg['devDependencies']),
        optionalDependencies: record(pkg['optionalDependencies']),
        peerDependencies: record(pkg['peerDependencies']),
        repository: repositoryString,
        description: typeof pkg['description'] === 'string' ? pkg['description'] : '',
        present: true,
    };
}
// --- pnpm-lock.yaml ----------------------------------------------------------
/** Normalize a pnpm packages-section key to `name@version` (strip `/` and `(suffix)`). */
function normalizePnpmKey(key) {
    const trimmed = key.replace(/^['"]|['"]$/g, '');
    const noSuffix = trimmed.replace(/\(.*\)$/, '');
    return noSuffix.startsWith('/') ? noSuffix.slice(1) : noSuffix;
}
function parsePnpmLock(text) {
    const entries = new Map();
    const hasIntegrity = text.includes('integrity');
    const versionMatch = /lockfileVersion:\s*['"]?([0-9.]+)/.exec(text);
    const version = versionMatch?.[1] ?? '';
    // Only the `packages:` section is needed: `<key>` entries whose children list dependencies.
    const packagesAt = text.indexOf('\npackages:');
    const body = packagesAt === -1 ? text : text.slice(packagesAt + 1);
    const lines = body.split('\n');
    let current = null;
    let inDependencies = false;
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.trim() === '')
            continue;
        const indent = line.length - line.trimStart().length;
        const trimmedLine = line.trim();
        if (indent === 0) {
            current = null;
            inDependencies = false;
            continue;
        }
        if (indent === 2 && trimmedLine.endsWith(':')) {
            // New package entry: `name@version:`, `'name@version':` or `/name@version:`.
            const keyMatch = /^(?:'([^']+)'|"([^"]+)"|(\S+)):$/.exec(trimmedLine);
            if (keyMatch !== null) {
                const key = keyMatch[1] ?? keyMatch[2] ?? keyMatch[3];
                current = {};
                entries.set(normalizePnpmKey(key), current);
            }
            else {
                current = null;
            }
            inDependencies = false;
            continue;
        }
        if (indent === 4) {
            inDependencies = trimmedLine === 'dependencies:' || trimmedLine === 'optionalDependencies:';
            continue;
        }
        if (indent === 6 && current !== null && inDependencies) {
            const depMatch = /^(?:'([^']+)'|"([^"]+)"|(@?[^:\s][^:]*)):\s*(.+)$/.exec(trimmedLine);
            if (depMatch !== null) {
                const name = depMatch[1] ?? depMatch[2] ?? depMatch[3];
                current[name] = depMatch[4].trim();
            }
        }
    }
    return { kind: 'pnpm', lockfile: 'pnpm-lock.yaml', lockfileVersion: version, entries, hasIntegrity };
}
// --- package-lock.json -------------------------------------------------------
function parseNpmLock(text, lockfile) {
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        return { kind: 'unsupported', lockfile, lockfileVersion: '', entries: new Map(), hasIntegrity: false };
    }
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
        return { kind: 'unsupported', lockfile, lockfileVersion: '', entries: new Map(), hasIntegrity: false };
    }
    const root = json;
    const entries = new Map();
    let hasIntegrity = false;
    const version = typeof root['lockfileVersion'] === 'number' ? String(root['lockfileVersion']) : '';
    const packages = root['packages'];
    if (typeof packages === 'object' && packages !== null && !Array.isArray(packages)) {
        for (const [location, raw] of Object.entries(packages)) {
            if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                continue;
            const entry = raw;
            const name = typeof entry['name'] === 'string' ? entry['name'] : location.split('node_modules/').pop() ?? '';
            const ver = typeof entry['version'] === 'string' ? entry['version'] : '';
            if (location !== '' && name !== '') {
                const deps = {};
                if (typeof entry['dependencies'] === 'object' && entry['dependencies'] !== null) {
                    for (const [dep, spec] of Object.entries(entry['dependencies'])) {
                        if (typeof spec === 'string')
                            deps[dep] = spec;
                    }
                }
                entries.set(`${name}@${ver}`, deps);
                if (typeof entry['integrity'] === 'string' && entry['integrity'] !== '')
                    hasIntegrity = true;
            }
        }
    }
    else {
        // v1 shape: nested `dependencies` objects.
        const walk = (node) => {
            if (typeof node !== 'object' || node === null || Array.isArray(node))
                return;
            for (const [name, raw] of Object.entries(node)) {
                if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
                    continue;
                const entry = raw;
                const ver = typeof entry['version'] === 'string' ? entry['version'] : '';
                const deps = {};
                if (typeof entry['requires'] === 'object' && entry['requires'] !== null) {
                    for (const [dep, spec] of Object.entries(entry['requires'])) {
                        if (typeof spec === 'string')
                            deps[dep] = spec;
                    }
                }
                if (name !== '' && ver !== '')
                    entries.set(`${name}@${ver}`, deps);
                if (typeof entry['integrity'] === 'string' && entry['integrity'] !== '')
                    hasIntegrity = true;
                walk(entry['dependencies']);
            }
        };
        walk(root['dependencies']);
    }
    return { kind: 'npm', lockfile, lockfileVersion: version, entries, hasIntegrity };
}
// --- yarn.lock (v1) ----------------------------------------------------------
/** Extract the package name from a yarn key line (`name@^range` / `@scope/name@^range`). */
function yarnKeyName(key) {
    const unquoted = key.replace(/^["']|["']$/g, '').trim();
    const at = unquoted.lastIndexOf('@');
    return at <= 0 ? unquoted : unquoted.slice(0, at);
}
function parseYarnLock(text) {
    const entries = new Map();
    let hasIntegrity = text.includes('integrity') || text.includes('resolved "');
    const lines = text.split('\n');
    let current = null;
    let key = '';
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.trim() === '' || line.trimStart().startsWith('#'))
            continue;
        if (!/^\s/.test(line)) {
            key = line.replace(/:$/, '').trim();
            if (current !== null && current.version !== '') {
                entries.set(`${current.key}@${current.version}`, current.deps);
            }
            current = null;
            continue;
        }
        const match = /^\s+(.+?)\s+(.+)$/.exec(line);
        if (match === null)
            continue;
        const fieldName = match[1];
        const value = match[2].trim();
        if (fieldName === 'version') {
            if (current !== null && current.version !== '') {
                entries.set(`${current.key}@${current.version}`, current.deps);
            }
            current = { key: yarnKeyName(key), deps: {}, version: value.replace(/^"|"$/g, '') };
            continue;
        }
        if (fieldName === 'integrity') {
            hasIntegrity = true;
            continue;
        }
        if (fieldName === 'dependencies' || fieldName === 'optionalDependencies')
            continue;
        if (current !== null && !['resolved', 'uid'].includes(fieldName)) {
            current.deps[fieldName.replace(/^["']|["']$/g, '')] = value;
        }
    }
    if (current !== null && current.version !== '') {
        entries.set(`${current.key}@${current.version}`, current.deps);
    }
    return { kind: 'yarn', lockfile: 'yarn.lock', lockfileVersion: '1', entries, hasIntegrity };
}
// --- tree building ------------------------------------------------------------
/** Normalize a dependency spec into a bare version when possible. */
export function specVersion(spec) {
    const trimmed = spec.trim();
    const match = /^(?:[\^~<>=*| ]+|npm:|workspace:|file:|link:)*(.+)$/.exec(trimmed);
    return match?.[1] ?? trimmed;
}
/** Resolve a name+spec against lockfile entries (exact match, then prefix scan). */
function resolveLockedVersion(name, spec, entries) {
    const bare = specVersion(spec);
    if (entries.has(`${name}@${bare}`))
        return bare;
    for (const key of entries.keys()) {
        if (key.startsWith(`${name}@`))
            return key.slice(name.length + 1);
    }
    return undefined;
}
/**
 * Build the dependency tree: BFS from the manifest's direct dependencies
 * through lockfile edges, deduped by name@version, depth- and node-capped.
 */
export function buildDependencyTree(manifest, lock, maxNodes) {
    const packages = [];
    const seen = new Set();
    const queue = [];
    const direct = [
        ...Object.entries(manifest.dependencies).map(([name, spec]) => ({ name, spec, depth: 0, dev: false })),
        ...Object.entries(manifest.devDependencies).map(([name, spec]) => ({ name, spec, depth: 0, dev: true })),
    ];
    let total = 0;
    let truncated = false;
    for (const root of direct) {
        total += 1;
        const version = lock.entries.size > 0 ? resolveLockedVersion(root.name, root.spec, lock.entries) ?? specVersion(root.spec) : specVersion(root.spec);
        const key = `${root.name}@${version}`;
        if (!seen.has(key) && packages.length < maxNodes) {
            seen.add(key);
            packages.push({ name: root.name, version, depth: 0, dev: root.dev });
        }
        else if (!seen.has(key)) {
            truncated = true;
        }
        queue.push(root);
    }
    while (queue.length > 0) {
        const item = queue.shift();
        if (item.depth >= 20)
            continue;
        const version = lock.entries.size > 0 ? resolveLockedVersion(item.name, item.spec, lock.entries) : undefined;
        const locked = version === undefined ? `${item.name}@${specVersion(item.spec)}` : `${item.name}@${version}`;
        const edges = lock.entries.get(locked);
        if (edges === undefined)
            continue;
        for (const [depName, depSpec] of Object.entries(edges)) {
            if (depName === '' || depSpec === '')
                continue;
            const depVersion = resolveLockedVersion(depName, depSpec, lock.entries) ?? specVersion(depSpec);
            const depKey = `${depName}@${depVersion}`;
            total += 1;
            if (!seen.has(depKey)) {
                if (packages.length >= maxNodes) {
                    truncated = true;
                    continue;
                }
                seen.add(depKey);
                packages.push({ name: depName, version: depVersion, depth: item.depth + 1, dev: item.dev });
                queue.push({ name: depName, spec: depSpec, depth: item.depth + 1, dev: item.dev });
            }
        }
    }
    return { packages, truncated, total };
}
/** Direct specs that are not exact-version pinned (a supply-chain signal). */
export function unpinnedSpecs(manifest) {
    const out = [];
    for (const [name, spec] of Object.entries(manifest.dependencies)) {
        if (!/^\d/.test(spec.trim()))
            out.push(`${name}@${spec}`);
    }
    return out;
}
