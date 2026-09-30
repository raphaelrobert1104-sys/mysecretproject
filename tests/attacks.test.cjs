const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../outputs/projet-secret.user.js'), 'utf8');
const bootstrap = 'void boot().catch(showStartupError);';
assert.equal(source.split(bootstrap).length, 2);
const testSource = source.replace(bootstrap, `
    globalThis.attackApi = {
        resumeAttackAutomation, chooseLeastUsedAttackTarget, formatAttackDebugProgress,
        hooks(h) {
            navigateToUrl = h.navigateToUrl;
            clearThisTabRunId = async () => {};
            refreshUi = () => {};
            waitUntilPageUsable = h.waitUntilPageUsable;
            waitForPageExit = h.waitForPageExit;
            waitForElement = h.waitForElement;
            delay = h.delay;
        },
    };
    return;
`);
const links = ['https://example.test/a', 'https://example.test/b'];
const runKey = 'secretMultiLinkRun';

function harness(options = {}) {
    let now = 100000, transitioned = false, firstClickAt = null;
    const clicks = [], lookups = [], navigations = [], errors = [];
    const storage = new Map([
        ['secretAttacksConfig', {
            startUrl: 'https://example.test/start', links,
            attackCounters: { [links[0]]: 1, [links[1]]: 0 },
        }],
        [runKey, {
            runId: 'test', profileId: 13, status: 'running', phase: 'attack-send',
            currentLinkIndex: 0, attackCurrentUrl: links[0],
            attackTargetExecutions: options.target || 2, attackCompletedExecutions: 0,
            attackSendAttempts: 0, attackSendClicked: false,
        }],
    ]);
    const node = { getBoundingClientRect: () => ({ width: 20, height: 20 }) };
    const sandbox = {
        URL, Date: class extends Date { static now() { return now; } },
        console: { error: (...args) => errors.push(args) },
        window: {
            location: { href: 'https://example.test/send' },
            getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
        },
        document: {
            querySelector: (selector) => {
                if (selector === '#sendFleet') return transitioned || options.emptyPage ? null : node;
                if (selector === '#sendall') return transitioned ? node : null;
                throw new Error('Unexpected selector: ' + selector);
            },
        },
        GM_getValue: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
        GM_setValue: (key, value) => storage.set(key, structuredClone(value)),
    };
    vm.createContext(sandbox);
    vm.runInContext(testSource, sandbox);
    const api = sandbox.attackApi;
    api.hooks({
        navigateToUrl: (url) => { navigations.push(url); sandbox.window.location.href = url; },
        waitUntilPageUsable: async () => ({ timedOut: Boolean(options.loadTimeout) }),
        waitForPageExit: (ms) => ({ then(resolve) { now += ms; resolve(Boolean(options.reload)); } }),
        waitForElement: async (selector, settings) => {
            assert.equal(selector, '#sendFleet > span');
            lookups.push(now);
            if (options.missing || (options.missingFirst && lookups.length === 1)) {
                now += settings.timeoutMs;
                throw new Error(`Element not found after ${settings.timeoutMs} ms`);
            }
            return {
                click() {
                    assert.equal(storage.get(runKey).phase, 'attack-wait-after-send');
                    clicks.push(now);
                    firstClickAt ??= now;
                    if (options.clickThrows) throw new Error('Click failed');
                    if (clicks.length === (options.succeedOn || 0)) transitioned = true;
                },
            };
        },
        delay: async (ms) => {
            now += ms;
            if (options.lateSuccess && firstClickAt !== null && now - firstClickAt >= 5000) {
                transitioned = true;
            }
            if (options.stopDuringRetry && storage.get(runKey).phase === 'attack-retry-send') {
                storage.get(runKey).status = 'stopped';
            }
            if (options.replaceDuringRetry && storage.get(runKey).phase === 'attack-retry-send') {
                storage.set(runKey, { runId: 'replacement', profileId: 1, status: 'running' });
            }
        },
    });
    return {
        api, storage, clicks, lookups, navigations, errors,
        set transitioned(value) { transitioned = value; },
        get run() { return storage.get(runKey); },
        get now() { return now; },
        async resume() { await api.resumeAttackAutomation('test'); },
    };
}

test('first successful send advances without any retry', async () => {
    const h = harness({ succeedOn: 1 });
    await h.resume();
    assert.equal(h.clicks.length, 1);
    assert.equal(h.run.attackCompletedExecutions, 1);
    assert.equal(h.run.attackSkippedExecutions, 0);
    assert.deepEqual(h.navigations, [links[1]]);
});

test('no transition retries after a full unscaled five-second delay', async () => {
    const h = harness({ succeedOn: 2 });
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.clicks[1] - h.clicks[0], 3000 + 5000);
    assert.equal(h.run.attackSkippedExecutions, 0);
    assert.deepEqual(h.navigations, [links[1]]);
});

test('two unsuccessful clicks skip the URL, consume one tour and preserve its visit counter', async () => {
    const h = harness();
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.run.attackSkippedExecutions, 1);
    assert.equal(h.run.attackCompletedExecutions, 1);
    assert.deepEqual(h.navigations, [links[1]]);
    assert.equal(h.storage.get('secretAttacksConfig').attackCounters[links[0]], 1);
    assert.match(h.api.formatAttackDebugProgress(h.run), /URL ignorées après deux tentatives : 1/);
});

test('absent send button gets exactly two lookups separated by five seconds after timeout', async () => {
    const h = harness({ missing: true });
    await h.resume();
    assert.equal(h.lookups.length, 2);
    assert.equal(h.lookups[1] - h.lookups[0], 7000 + 5000);
    assert.equal(h.clicks.length, 0);
    assert.equal(h.run.attackSkippedExecutions, 1);
    assert.deepEqual(h.navigations, [links[1]]);
});

test('missing first button can succeed on retry', async () => {
    const h = harness({ missingFirst: true, succeedOn: 1 });
    await h.resume();
    assert.equal(h.lookups.length, 2);
    assert.equal(h.clicks.length, 1);
    assert.equal(h.run.attackSkippedExecutions, 0);
});

test('late first response cancels the retry instead of sending twice', async () => {
    const h = harness({ lateSuccess: true });
    await h.resume();
    assert.equal(h.clicks.length, 1);
    assert.equal(h.run.attackSkippedExecutions, 0);
});

test('reload to the same send form is not assumed successful; two clicks remain the maximum', async () => {
    const h = harness({ reload: true });
    await h.resume();
    assert.equal(h.run.phase, 'attack-wait-after-send');
    assert.equal(h.run.attackSendAttempts, 1);
    await h.resume();
    assert.equal(h.run.attackSendAttempts, 2);
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.run.attackSkippedExecutions, 1);
    assert.deepEqual(h.navigations, [links[1]]);
});

test('reload after successful send never repeats the click', async () => {
    const h = harness({ reload: true, succeedOn: 1 });
    await h.resume();
    await h.resume();
    assert.equal(h.clicks.length, 1);
    assert.equal(h.run.attackSkippedExecutions, 0);
});

test('resuming a pending retry waits only its persisted remaining delay', async () => {
    const h = harness({ succeedOn: 1 });
    const resumedAt = h.now;
    h.storage.set(runKey, {
        ...h.run, phase: 'attack-retry-send', attackSendAttempts: 1,
        attackSendClicked: true, attackRetryAt: resumedAt + 2000,
    });
    await h.resume();
    assert.equal(h.lookups[0] - resumedAt, 2000);
    assert.equal(h.clicks.length, 1);
    assert.equal(h.run.attackSkippedExecutions, 0);
});

test('an empty page is not mistaken for a successful send', async () => {
    const h = harness({ emptyPage: true });
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.run.attackSkippedExecutions, 1);
});

test('click exceptions are retried once and then skipped', async () => {
    const h = harness({ clickThrows: true });
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.clicks[1] - h.clicks[0], 5000);
    assert.equal(h.run.attackSkippedExecutions, 1);
});

test('post-send loading timeouts are retried then skipped, not fatal', async () => {
    const h = harness({ loadTimeout: true });
    await h.resume();
    assert.equal(h.clicks.length, 2);
    assert.equal(h.run.attackSkippedExecutions, 1);
    assert.deepEqual(h.navigations, [links[1]]);
});

test('stop or replacement during the five-second wait prevents a retry', async () => {
    for (const options of [{ stopDuringRetry: true }, { replaceDuringRetry: true }]) {
        const h = harness(options);
        await h.resume();
        assert.equal(h.clicks.length, 1);
        assert.equal(h.navigations.length, 0);
    }
});

test('last failed tour completes with a skipped count rather than running forever', async () => {
    const h = harness({ target: 1 });
    await h.resume();
    assert.equal(h.run.status, 'completed');
    assert.equal(h.run.attackCompletedExecutions, 1);
    assert.equal(h.run.attackSkippedExecutions, 1);
    assert.equal(h.clicks.length, 2);
    assert.equal(h.navigations.length, 0);
    assert.match(h.run.message, /1 URL ignorée/);
});

test('failed URL is excluded from next choice when there are alternatives', () => {
    const h = harness();
    const config = { links, attackCounters: { [links[0]]: 1, [links[1]]: 1 } };
    for (let i = 0; i < 10; i++) {
        assert.equal(h.api.chooseLeastUsedAttackTarget(config, links[0]).url, links[1]);
    }
    assert.equal(h.api.chooseLeastUsedAttackTarget({ links: [links[0]], attackCounters: {} }, links[0]).url, links[0]);
});
