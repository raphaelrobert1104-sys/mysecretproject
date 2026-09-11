const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = readFileSync(path.join(__dirname, '../outputs/projet-secret.user.js'), 'utf8');
const bootstrap = 'void boot().catch(showStartupError);';
assert.equal(source.split(bootstrap).length, 2);
// Exercise the real runner and selector logic without opening private target pages.
const testSource = source.replace(bootstrap, `
    globalThis.mechaApi = {
        startMechaAutomation, resumeMechaAutomation, formatMechaDebugProgress,
        getRandomDelayMs, getStoredConfig, saveConfig, parseLinks,
        delayBounds: [MECHA_DELAY_MIN_MS, MECHA_DELAY_MAX_MS],
        otherDelayBounds: [POST_ACTION_DELAY_MIN_MS, POST_ACTION_DELAY_MAX_MS],
        hooks(hooks) {
            ensureUi = hooks.ensureUi;
            navigateToUrl = hooks.navigateToUrl;
            setThisTabRunId = hooks.setThisTabRunId;
            clearThisTabRunId = hooks.clearThisTabRunId;
            refreshUi = hooks.refreshUi;
            waitUntilPageUsable = hooks.waitUntilPageUsable;
            delay = hooks.delay;
        },
    };
    return;
`);
const links = Array.from({ length: 13 }, (_, i) => `https://example.test/buildings?link=${i + 1}`);
const priorities = ['11101', '11102', '11103', '11104', '11105', '11107', '11109', '11110', '11111'];
const links2 = Array.from({ length: 13 }, (_, i) => `https://example.test/research?link=${i + 1}`);
const allLinks = [...links, ...links2];
const priorities2 = ['11206', '14207', '11211'];

function harness(available = () => [...priorities, ...priorities2], options = {}) {
    const storage = new Map([['secretMechaBuildingsConfig', { links, mechaLinks2: links2 }]]);
    const navigations = [], clicks = [], pauses = [], errors = [], queried = [];
    let pageWaits = 0, uiOpens = 0;
    const sandbox = {
        URL, crypto: webcrypto,
        console: { error: (...args) => errors.push(args) },
        window: {
            location: { href: 'https://example.test/home' },
            getComputedStyle: (element) => ({
                display: element.hidden ? 'none' : 'block',
                visibility: 'visible', opacity: '1', pointerEvents: 'auto',
            }),
        },
        document: {
            querySelectorAll: (selector) => {
                const technology = selector.match(/data-technology="(\d+)"/)[1];
                queried.push(technology);
                const index = allLinks.indexOf(sandbox.window.location.href);
                return available(index).map((item) => typeof item === 'string'
                    ? { technology: item } : item
                ).filter((item) => item.technology === technology).map((item) => ({
                    ...item,
                    getBoundingClientRect: () => ({ width: 30, height: 30 }),
                    getAttribute: () => null,
                    click: () => clicks.push({ technology, url: sandbox.window.location.href }),
                }));
            },
        },
        GM_getValue: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
        GM_setValue: (key, value) => storage.set(key, structuredClone(value)),
    };
    vm.createContext(sandbox);
    vm.runInContext(testSource, sandbox);
    const api = sandbox.mechaApi;
    api.hooks({
        ensureUi: async () => {
            uiOpens++;
            return { open: () => {}, showError: (message) => errors.push(message), refresh: () => {} };
        },
        navigateToUrl: (url) => {
            navigations.push(url);
            sandbox.window.location.href = url;
        },
        setThisTabRunId: async () => {}, clearThisTabRunId: async () => {}, refreshUi: () => {},
        waitUntilPageUsable: async () => {
            pageWaits++;
            return { timedOut: Boolean(options.pageTimeout) };
        },
        delay: async (ms) => {
            pauses.push(ms);
            if (options.stopDuringPause) storage.get('secretMultiLinkRun').status = 'stopped';
        },
    });
    return {
        api, storage, navigations, clicks, pauses, errors, queried,
        get uiOpens() { return uiOpens; },
        get pageWaits() { return pageWaits; },
        get run() { return storage.get('secretMultiLinkRun'); },
    };
}

async function finish(h) {
    for (let navigation = 0; navigation < 40 && h.run.status === 'running'; navigation++) {
        await h.api.resumeMechaAutomation(h.run.runId);
    }
    assert.equal(h.run.status, 'completed', h.run.message);
    assert.deepEqual(h.navigations, allLinks);
    assert.equal(h.pageWaits, 26);
    assert.equal(h.run.currentLinkIndex, 12);
    assert.equal(h.run.mechaRound, 2);
    assert.equal(h.pauses.length, 52);
    assert.ok(h.pauses.every((ms) => ms >= 637 && ms <= 1547));
    assert.match(h.api.formatMechaDebugProgress(h.run), /passage 2\/2 — Lien 13\/13/);
}

test('launch immediately navigates to link 1, ignoring the previously saved mode', async () => {
    const h = harness();
    h.storage.set('secretMechaBuildingsMode', 'biosphere');
    await h.api.startMechaAutomation();
    assert.equal(h.uiOpens, 0);
    assert.deepEqual(h.navigations, [links[0]]);
    assert.equal(h.run.phase, 'mecha-open-link');
});

test('launch still requires 13 configured links', async () => {
    const h = harness();
    h.storage.set('secretMechaBuildingsConfig', { links: links.slice(0, 12), mechaLinks2: links2 });
    await h.api.startMechaAutomation();
    assert.equal(h.errors.length, 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.run, undefined);
});

test('each round uses its own priority 1 even when all twelve buttons exist', async () => {
    const h = harness(() => [...priorities, ...priorities2].reverse());
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 26);
    assert.ok(h.clicks.slice(0, 13).every((click) => click.technology === '11101'));
    assert.ok(h.clicks.slice(13).every((click) => click.technology === '11206'));
    assert.deepEqual(h.clicks.map((click) => click.url), allLinks);
    assert.equal(h.queried.length, 26);
    assert.equal(h.run.mechaClickCount, 26);
    assert.equal(h.run.mechaSkippedCount, 0);
});

test('both rounds follow every fallback priority, including 11107 and 14207', async () => {
    const h = harness((index) => index < 13
        ? priorities.slice(index % 9).reverse()
        : priorities2.slice((index - 13) % 3).reverse());
    await h.api.startMechaAutomation();
    await finish(h);
    assert.deepEqual(h.clicks.map((click) => click.technology),
        [...links.map((_, index) => priorities[index % 9]),
            ...links2.map((_, index) => priorities2[index % 3])]);
});

test('an empty page is skipped and subsequent pages are still processed', async () => {
    const h = harness((index) => [0, 12, 13, 25].includes(index)
        ? [] : index < 13 ? ['11111'] : ['11211']);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 22);
    assert.equal(h.run.mechaSkippedCount, 4);
    assert.equal(h.errors.length, 0);
});

test('all pages without buttons complete successfully after 26 visits', async () => {
    const h = harness(() => []);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 0);
    assert.equal(h.run.mechaSkippedCount, 26);
    assert.equal(h.queried.length, 13 * 9 + 13 * 3);
    assert.equal(h.errors.length, 0);
});

test('hidden and disabled buttons are skipped; duplicate selectors pick the usable element', async () => {
    const h = harness((index) => index < 13 ? [
        { technology: '11101', hidden: true },
        { technology: '11102', disabled: true },
        { technology: '11103', hidden: true },
        { technology: '11103' },
        { technology: '11104' },
    ] : [
        { technology: '11206', hidden: true },
        { technology: '14207', disabled: true },
        { technology: '11211', hidden: true },
        { technology: '11211' },
    ]);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.ok(h.clicks.slice(0, 13).every((click) => click.technology === '11103'));
    assert.ok(h.clicks.slice(13).every((click) => click.technology === '11211'));
    assert.equal(h.clicks.length, 26);
});

test('resuming after a click does not click the same page again', async () => {
    const h = harness();
    await h.api.startMechaAutomation();
    Object.assign(h.run, {
        phase: 'mecha-after-upgrade', mechaClickCount: 1,
        mechaPendingDelayMs: 700, mechaPendingDelayLabel: 'le clic',
    });
    await h.api.resumeMechaAutomation(h.run.runId);
    assert.equal(h.clicks.length, 0);
    assert.deepEqual(h.navigations, links.slice(0, 2));
    assert.equal(h.run.currentLinkIndex, 1);
});

test('a saved run without a round starts with round 1 and completes round 2', async () => {
    const h = harness();
    await h.api.startMechaAutomation();
    Object.assign(h.run, { mechaMode: 'alternate', mechaCycleNumber: 4, mechaBuildingType: 'biosphere' });
    delete h.run.mechaRound;
    await finish(h);
    assert.equal(h.clicks.length, 26);
    assert.ok(h.clicks.slice(0, 13).every((click) => click.technology === '11101'));
    assert.ok(h.clicks.slice(13).every((click) => click.technology === '11206'));
});

test('stopping during a delay prevents further clicks and navigation', async () => {
    const h = harness(undefined, { stopDuringPause: true });
    await h.api.startMechaAutomation();
    await h.api.resumeMechaAutomation(h.run.runId);
    assert.equal(h.run.status, 'stopped');
    assert.equal(h.clicks.length, 0);
    assert.equal(h.navigations.length, 1);
});

test('a page loading timeout remains an error and never triggers a click', async () => {
    const h = harness(undefined, { pageTimeout: true });
    await h.api.startMechaAutomation();
    await h.api.resumeMechaAutomation(h.run.runId);
    assert.equal(h.run.status, 'error');
    assert.equal(h.clicks.length, 0);
});

test('random delay bounds retain the previous Mecha increase', () => {
    const h = harness();
    assert.deepEqual(Array.from(h.api.otherDelayBounds), [700, 1700]);
    assert.deepEqual(Array.from(h.api.delayBounds), [910, 2210]);
});

test('old configuration retains its first list and asks for the missing second list before launch', async () => {
    const h = harness();
    h.storage.set('secretMechaBuildingsConfig', { links });
    const config = h.api.getStoredConfig(12);
    assert.deepEqual(Array.from(config.links), links);
    assert.deepEqual(Array.from(config.mechaLinks2), []);
    await h.api.startMechaAutomation();
    assert.equal(h.navigations.length, 0);
    assert.match(h.errors[0], /Liens à traiter 2/);
    assert.deepEqual(h.storage.get('secretMechaBuildingsConfig').links, links);
});

test('saving both lists preserves their independent order and other profiles', () => {
    const h = harness();
    const other = { links: ['https://example.test/resources'], repeat: true };
    h.storage.set('secretMultiLinkConfig', other);
    const parsed = h.api.parseLinks(links2.join('\n'), 13);
    assert.equal(parsed.error, '');
    h.api.saveConfig(12, { links, mechaLinks2: parsed.links });
    const stored = h.api.getStoredConfig(12);
    assert.deepEqual(Array.from(stored.links), links);
    assert.deepEqual(Array.from(stored.mechaLinks2), links2);
    assert.deepEqual(h.storage.get('secretMultiLinkConfig'), other);
});

test('second-list validation rejects missing and invalid URLs before any navigation', async () => {
    for (const second of [[], links2.slice(0, 12), [...links2.slice(0, 12), 'invalid']]) {
        const h = harness();
        h.storage.set('secretMechaBuildingsConfig', { links, mechaLinks2: second });
        await h.api.startMechaAutomation();
        assert.equal(h.navigations.length, 0);
        assert.equal(h.run, undefined);
        assert.match(h.errors[0], /Liens à traiter 2/);
    }
    const h = harness();
    assert.ok(h.api.parseLinks([...links2, links2[0]].join('\n'), 13).error);
});

test('round boundary opens second-list link 1 and persists round 2 before navigation', async () => {
    const h = harness();
    await h.api.startMechaAutomation();
    for (let i = 0; i < 13; i++) await h.api.resumeMechaAutomation(h.run.runId);
    assert.equal(h.run.status, 'running');
    assert.equal(h.run.mechaRound, 2);
    assert.equal(h.run.currentLinkIndex, 0);
    assert.equal(h.run.phase, 'mecha-open-link');
    assert.equal(h.clicks.length, 13);
    assert.deepEqual(h.navigations, [...links, links2[0]]);
    // Resume from storage, as on each page load: round 2 must not fall back to round 1.
    h.storage.set('secretMultiLinkRun', structuredClone(h.run));
    await finish(h);
    assert.equal(h.clicks.length, 26);
    assert.equal(h.clicks[13].technology, '11206');
});

test('only first-round buttons on second-round pages are skipped, never clicked', async () => {
    const h = harness(() => priorities);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 13);
    assert.equal(h.run.mechaSkippedCount, 13);
    assert.ok(h.clicks.every((click) => links.includes(click.url)));
});

test('resume after last second-round click finishes without a repeat or third round', async () => {
    const h = harness();
    await h.api.startMechaAutomation();
    Object.assign(h.run, {
        mechaRound: 2, currentLinkIndex: 12, phase: 'mecha-after-upgrade',
        mechaClickCount: 26, mechaPendingDelayMs: 700,
    });
    await h.api.resumeMechaAutomation(h.run.runId);
    assert.equal(h.run.status, 'completed');
    assert.equal(h.clicks.length, 0);
    assert.equal(h.navigations.length, 1);
    assert.match(h.run.message, /26 liens traités/);
});
