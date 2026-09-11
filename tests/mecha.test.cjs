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
        getRandomDelayMs,
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

function harness(available = () => priorities, options = {}) {
    const storage = new Map([['secretMechaBuildingsConfig', { links }]]);
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
                const index = links.indexOf(sandbox.window.location.href);
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
    for (let navigation = 0; navigation < 20 && h.run.status === 'running'; navigation++) {
        await h.api.resumeMechaAutomation(h.run.runId);
    }
    assert.equal(h.run.status, 'completed', h.run.message);
    assert.deepEqual(h.navigations, links);
    assert.equal(h.pageWaits, 13);
    assert.equal(h.run.currentLinkIndex, 12);
    assert.equal(h.pauses.length, 26);
    assert.ok(h.pauses.every((ms) => ms >= 637 && ms <= 1547));
    assert.match(h.api.formatMechaDebugProgress(h.run), /passage unique — Lien 13\/13/);
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
    h.storage.set('secretMechaBuildingsConfig', { links: links.slice(0, 12) });
    await h.api.startMechaAutomation();
    assert.equal(h.errors.length, 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.run, undefined);
});

test('when all buttons exist, only priority 1 is clicked once per page, for one pass', async () => {
    const h = harness(() => [...priorities].reverse());
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 13);
    assert.ok(h.clicks.every((click) => click.technology === '11101'));
    assert.deepEqual(h.clicks.map((click) => click.url), links);
    assert.equal(h.queried.length, 13);
    assert.equal(h.run.mechaClickCount, 13);
    assert.equal(h.run.mechaSkippedCount, 0);
});

test('each of the nine fallback priorities is used in order, including the gap after 11105', async () => {
    const h = harness((index) => priorities.slice(index % 9).reverse());
    await h.api.startMechaAutomation();
    await finish(h);
    assert.deepEqual(h.clicks.map((click) => click.technology),
        links.map((_, index) => priorities[index % 9]));
});

test('an empty page is skipped and subsequent pages are still processed', async () => {
    const h = harness((index) => index === 0 || index === 12 ? [] : ['11111']);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 11);
    assert.equal(h.run.mechaSkippedCount, 2);
    assert.equal(h.errors.length, 0);
});

test('all pages without buttons complete successfully after 13 visits', async () => {
    const h = harness(() => []);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.equal(h.clicks.length, 0);
    assert.equal(h.run.mechaSkippedCount, 13);
    assert.equal(h.queried.length, 13 * 9);
    assert.equal(h.errors.length, 0);
});

test('hidden and disabled buttons are skipped; duplicate selectors pick the usable element', async () => {
    const h = harness(() => [
        { technology: '11101', hidden: true },
        { technology: '11102', disabled: true },
        { technology: '11103', hidden: true },
        { technology: '11103' },
        { technology: '11104' },
    ]);
    await h.api.startMechaAutomation();
    await finish(h);
    assert.ok(h.clicks.every((click) => click.technology === '11103'));
    assert.equal(h.clicks.length, 13);
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

test('an old alternating run completes the current remaining links without another cycle', async () => {
    const h = harness();
    await h.api.startMechaAutomation();
    Object.assign(h.run, { mechaMode: 'alternate', mechaCycleNumber: 4, mechaBuildingType: 'biosphere' });
    await finish(h);
    assert.equal(h.clicks.length, 13);
    assert.ok(h.clicks.every((click) => click.technology === '11101'));
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
