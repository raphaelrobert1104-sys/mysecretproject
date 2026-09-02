const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = readFileSync(path.join(__dirname, '../outputs/projet-secret.user.js'), 'utf8');
const bootstrap = 'void boot().catch(showStartupError);';
assert.equal(source.split(bootstrap).length, 2);
// Expose the real implementation in an isolated VM, without booting a browser UI.
const testSource = source.replace(bootstrap, `
    globalThis.mechaApi = {
        startMechaAutomation, resumeMechaAutomation, formatMechaDebugProgress,
        getRandomDelayMs, normalizeMechaMode,
        delayBounds: [MECHA_DELAY_MIN_MS, MECHA_DELAY_MAX_MS],
        otherDelayBounds: [POST_ACTION_DELAY_MIN_MS, POST_ACTION_DELAY_MAX_MS],
        hooks(hooks) {
            ensureUi = hooks.ensureUi;
            navigateToUrl = hooks.navigateToUrl;
            setThisTabRunId = hooks.setThisTabRunId;
            clearThisTabRunId = hooks.clearThisTabRunId;
            refreshUi = hooks.refreshUi;
            waitUntilPageUsable = hooks.waitUntilPageUsable;
            waitForElement = hooks.waitForElement;
            delay = hooks.delay;
        },
    };
    return;
`);

const links = Array.from({ length: 13 }, (_, i) => `https://example.test/buildings?link=${i + 1}`);

function harness() {
    const storage = new Map([['secretMechaBuildingsConfig', { links }]]);
    const navigations = [];
    const clicks = [];
    const pauses = [];
    const errors = [];
    let prompts = 0;
    let pageWaits = 0;
    const sandbox = {
        URL, console, crypto: webcrypto,
        window: { location: { href: 'https://example.test/home' } },
        GM_getValue: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
        GM_setValue: (key, value) => storage.set(key, structuredClone(value)),
    };
    vm.createContext(sandbox);
    vm.runInContext(testSource, sandbox);
    const api = sandbox.mechaApi;
    api.hooks({
        ensureUi: async () => ({
            openMechaRunner: () => { prompts++; },
            open: () => {}, showError: (message) => errors.push(message), refresh: () => {},
        }),
        navigateToUrl: (url) => {
            navigations.push(url);
            sandbox.window.location.href = url;
        },
        setThisTabRunId: async () => {}, clearThisTabRunId: async () => {}, refreshUi: () => {},
        waitUntilPageUsable: async () => { pageWaits++; return { timedOut: false }; },
        waitForElement: async (selector) => ({
            click: () => clicks.push({ selector, url: sandbox.window.location.href }),
        }),
        delay: async (ms) => pauses.push(ms),
    });
    return {
        api, storage, navigations, clicks, pauses, errors,
        get prompts() { return prompts; },
        get pageWaits() { return pageWaits; },
        get run() { return storage.get('secretMultiLinkRun'); },
    };
}

async function finish(h) {
    for (let navigation = 0; navigation < 300 && h.run.status === 'running'; navigation++) {
        await h.api.resumeMechaAutomation(h.run.runId);
    }
    assert.equal(h.run.status, 'completed', h.run.message);
    assert.equal(h.run.mechaCycleNumber, 10);
}

test('every launch without an explicit choice opens the chooser before navigating', async () => {
    const h = harness();
    h.storage.set('secretMechaBuildingsMode', 'biosphere');
    await h.api.startMechaAutomation();
    assert.equal(h.prompts, 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.run, undefined);
    await h.api.startMechaAutomation();
    assert.equal(h.prompts, 2);
});

test('the chooser does not bypass the 13-link validation', async () => {
    const h = harness();
    h.storage.set('secretMechaBuildingsConfig', { links: links.slice(0, 12) });
    await h.api.startMechaAutomation('residential');
    assert.equal(h.errors.length, 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.run, undefined);
});

for (const mode of ['alternate', 'residential', 'biosphere']) {
    test(`${mode}: real runner preserves link order, building choice, waits and termination`, async () => {
        const h = harness();
        await h.api.startMechaAutomation(mode);
        assert.equal(h.run.mechaMode, mode);
        assert.equal(h.storage.get('secretMechaBuildingsMode'), mode);
        await finish(h);
        const expectedClicks = mode === 'alternate' ? 260 : 130;
        assert.equal(h.clicks.length, expectedClicks);
        assert.equal(h.run.mechaClickCount, expectedClicks);
        assert.equal(h.navigations.length, expectedClicks);
        assert.equal(h.pageWaits, expectedClicks);
        assert.equal(h.pauses.length, expectedClicks * 2 - 1);
        for (let i = 0; i < expectedClicks; i++) {
            const building = mode === 'alternate'
                ? (Math.floor(i / 13) % 2 === 0 ? '11101' : '11102')
                : mode === 'residential' ? '11101' : '11102';
            assert.equal(h.clicks[i].selector, `button.upgrade[data-technology="${building}"]`);
            assert.equal(h.clicks[i].url, links[i % 13]);
            assert.equal(h.navigations[i], links[i % 13]);
        }
        assert.ok(h.pauses.every((ms) => ms >= 637 && ms <= 1547));
        assert.match(h.api.formatMechaDebugProgress(h.run), /Boucle 10\/10/);
        assert.match(h.run.message, /10 boucles complètes/);
    });
}

test('a persisted legacy run without a mode keeps alternating', async () => {
    const h = harness();
    await h.api.startMechaAutomation('alternate');
    delete h.run.mechaMode;
    await finish(h);
    assert.equal(h.clicks.length, 260);
});

test('only Mecha random delay bounds are increased by 30 percent', () => {
    const h = harness();
    assert.deepEqual(Array.from(h.api.otherDelayBounds), [700, 1700]);
    assert.deepEqual(Array.from(h.api.delayBounds), [910, 2210]);
    for (let i = 0; i < 100; i++) {
        const normal = h.api.getRandomDelayMs(...h.api.otherDelayBounds);
        assert.ok(normal >= 490 && normal <= 1190);
    }
});
