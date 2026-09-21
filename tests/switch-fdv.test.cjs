const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = readFileSync(path.join(__dirname, '../outputs/projet-secret.user.js'), 'utf8');
const bootstrap = 'void boot().catch(showStartupError);';
assert.equal(source.split(bootstrap).length, 2);
const testSource = source.replace(bootstrap, `
    globalThis.switchApi = {
        startSwitchFdvAutomation, resumeAutomationForThisTab, startFromStoredConfiguration,
        getStoredConfig, saveConfig, getProfileLabel, getProfileLinkLimit, formatDebugProgress,
        hooks(h) {
            ensureUi = h.ensureUi;
            navigateToUrl = h.navigateToUrl;
            setThisTabRunId = h.setThisTabRunId;
            getThisTabRunId = h.getThisTabRunId;
            clearThisTabRunId = h.clearThisTabRunId;
            refreshUi = () => {};
            waitForWindowLoad = h.waitForWindowLoad;
            waitUntilPageUsable = h.waitUntilPageUsable;
            waitForPageExit = h.waitForPageExit;
            delay = h.delay;
        },
    };
    return;
`);
const links = Array.from({ length: 13 }, (_, i) => `https://example.test/lifeform?planet=${i + 1}`);
const key = 'secretSwitchFdvConfig';
const runKey = 'secretMultiLinkRun';

function harness(options = {}) {
    const storage = new Map([[key, { links }]]);
    const navigations = [], clicks = [], pauses = [], selectors = [], errors = [];
    let clock = 100000, tabRunId, chooserCount = 0, configCount = 0;
    let loadWaits = 0, usableWaits = 0, selectorPolls = 0;
    const sandbox = {
        URL, crypto: webcrypto, Date: class extends Date { static now() { return clock; } },
        console: { error: (...args) => errors.push(args) },
        window: {
            location: { href: 'https://example.test/home' },
            getComputedStyle: (element) => ({
                display: element.hidden ? 'none' : 'block', visibility: 'visible',
                opacity: '1', pointerEvents: 'auto',
            }),
        },
        document: {
            querySelector: (selector) => {
                selectors.push(selector);
                const remove = selector.startsWith('#removeLifeform');
                assert.match(selector, /:not\(\.disabled\)/);
                assert.ok(remove || selector === '#selectLifeform2[data-lifeformid="2"]:not(.disabled)');
                if (options.missing === (remove ? 'remove' : 'select')) return null;
                if (!remove && selectorPolls++ < (options.disabledPolls || 0)) return null;
                return {
                    hidden: Boolean(options.hidden),
                    getBoundingClientRect: () => ({ width: 50, height: 30 }),
                    getAttribute: () => null,
                    click: () => {
                        // The next phase must already be durable when the handler navigates.
                        assert.equal(storage.get(runKey).phase,
                            remove ? 'switch-fdv-after-remove' : 'switch-fdv-after-select');
                        clicks.push({ action: remove ? 'remove' : 'select', url: sandbox.window.location.href });
                    },
                };
            },
        },
        GM_getValue: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
        GM_setValue: (key, value) => storage.set(key, structuredClone(value)),
    };
    vm.createContext(sandbox);
    vm.runInContext(testSource, sandbox);
    const api = sandbox.switchApi;
    api.hooks({
        ensureUi: async () => ({
            open: () => configCount++, openSwitchFdvRunner: () => chooserCount++,
            showError: (message) => errors.push(message), refresh: () => {},
        }),
        navigateToUrl: (url) => { navigations.push(url); sandbox.window.location.href = url; },
        setThisTabRunId: async (id) => { tabRunId = id; },
        getThisTabRunId: async () => options.otherTab ? 'other-tab' : tabRunId,
        clearThisTabRunId: async () => { tabRunId = null; },
        waitForWindowLoad: async () => { loadWaits++; },
        waitUntilPageUsable: async () => {
            usableWaits++;
            if (options.stopDuringLoad) storage.get(runKey).status = 'stopped';
            return { timedOut: Boolean(options.pageTimeout) };
        },
        waitForPageExit: async () => Boolean(options.reloadAfterClick),
        delay: async (ms) => {
            pauses.push(ms);
            clock += ms;
            if (options.stopDuringPause) storage.get(runKey).status = 'stopped';
        },
    });
    return {
        api, storage, navigations, clicks, pauses, selectors, errors,
        get run() { return storage.get(runKey); },
        get chooserCount() { return chooserCount; },
        get configCount() { return configCount; },
        get loadWaits() { return loadWaits; },
        get usableWaits() { return usableWaits; },
        get tabRunId() { return tabRunId; },
    };
}

async function finish(h) {
    for (let i = 0; i < 45 && h.run.status === 'running'; i++) {
        await h.api.resumeAutomationForThisTab();
    }
    assert.equal(h.run.status, 'completed', h.run.message);
    assert.deepEqual(h.navigations, links);
    assert.deepEqual(h.clicks, links.flatMap((url) => [
        { action: 'remove', url }, { action: 'select', url },
    ]));
    assert.equal(h.loadWaits, 39);
    assert.equal(h.usableWaits, 39);
    assert.equal(h.tabRunId, null);
    assert.match(h.api.formatDebugProgress(h.run), /Switch FDV → Roctas — Lien 13\/13/);
}

test('configuration has a private key and does not overwrite other actions', () => {
    const h = harness();
    h.storage.set('secretMultiLinkConfig', { links: ['https://example.test/resources'] });
    h.api.saveConfig(15, { links });
    assert.deepEqual(Array.from(h.api.getStoredConfig(15).links), links);
    assert.equal(h.api.getProfileLabel(15), 'Switch FDV');
    assert.equal(h.api.getProfileLinkLimit(15), 13);
    assert.deepEqual(h.storage.get('secretMultiLinkConfig').links, ['https://example.test/resources']);
});

test('clicking the simple action opens the chooser without navigating', async () => {
    const h = harness();
    await h.api.startFromStoredConfiguration(15);
    assert.equal(h.chooserCount, 1);
    assert.equal(h.navigations.length, 0);
    assert.equal(h.run, undefined);
});

test('humans is disabled in the UI and cannot start a run through the runner', async () => {
    assert.match(source, /<button[^>]*disabled[^>]*>Switch vers humains<\/button>/);
    const h = harness();
    await h.api.startSwitchFdvAutomation('humans');
    assert.equal(h.chooserCount, 1);
    assert.equal(h.run, undefined);
});

test('incomplete configuration opens settings without any page action', async () => {
    const h = harness();
    h.storage.set(key, { links: links.slice(0, 12) });
    await h.api.startSwitchFdvAutomation('roctas');
    assert.equal(h.configCount, 1);
    assert.equal(h.navigations.length, 0);
    assert.match(h.errors[0], /13 liens/);
});

test('13 links are visited in order with two clicks and fresh delays on each page', async () => {
    const h = harness();
    await h.api.startSwitchFdvAutomation('roctas');
    await finish(h);
    assert.equal(h.pauses.length, 39);
    assert.ok(h.pauses.every((ms) => ms >= 490 && ms <= 1190));
    assert.ok(new Set(h.pauses).size > 1);
});

test('reload after each click resumes the next phase without duplicate clicks', async () => {
    const h = harness({ reloadAfterClick: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await finish(h);
});

test('temporarily disabled Roctas is waited for, never forced', async () => {
    const h = harness({ disabledPolls: 4 });
    await h.api.startSwitchFdvAutomation('roctas');
    await finish(h);
    assert.equal(h.pauses.filter((ms) => ms === 75).length, 4);
});

test('Roctas absent or permanently disabled times out without selecting or advancing', async () => {
    const h = harness({ missing: 'select' });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'error');
    assert.match(h.run.message, /7000 ms/);
    assert.deepEqual(h.clicks.map((click) => click.action), ['remove']);
    assert.equal(h.navigations.length, 1);
});

test('missing deactivate button never triggers selection', async () => {
    const h = harness({ missing: 'remove' });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'error');
    assert.equal(h.clicks.length, 0);
});

test('hidden controls are not clicked', async () => {
    const h = harness({ hidden: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'error');
    assert.equal(h.clicks.length, 0);
});

test('stopping during the pause prevents any subsequent action', async () => {
    const h = harness({ stopDuringPause: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'stopped');
    assert.equal(h.clicks.length, 0);
    assert.equal(h.navigations.length, 1);
});

test('stopping during a load prevents subsequent actions', async () => {
    const h = harness({ stopDuringLoad: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'stopped');
    assert.equal(h.clicks.length, 0);
});

test('load timeout does not click', async () => {
    const h = harness({ pageTimeout: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.run.status, 'error');
    assert.equal(h.clicks.length, 0);
});

test('other tabs do not execute the action', async () => {
    const h = harness({ otherTab: true });
    await h.api.startSwitchFdvAutomation('roctas');
    await h.api.resumeAutomationForThisTab();
    assert.equal(h.clicks.length, 0);
    assert.equal(h.loadWaits, 0);
});
