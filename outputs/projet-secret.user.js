// ==UserScript==
// @name         Projet secret — boucle multi-liens
// @namespace    local.projet-secret
// @version      6.7.1
// @updateURL    https://raw.githubusercontent.com/raphaelrobert1104-sys/mysecretproject/main/outputs/projet-secret.user.js
// @downloadURL  https://raw.githubusercontent.com/raphaelrobert1104-sys/mysecretproject/main/outputs/projet-secret.user.js
// @description  Automatise Ressources, Expéditions V1/V2, Forme de vie, Import, Constructions et Ghost avec configurations privées.
// @author       Vous
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_getTab
// @grant        GM_saveTab
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG_KEYS = {
        1: 'secretMultiLinkConfig',
        2: 'secretMultiLinkConfig2',
        4: 'secretLifeformConfig',
        6: 'secretImportConfig',
        7: 'secretConstructionConfig',
        8: 'secretGhostConfig',
        9: 'secretExpeditionV2Config',
    };
    const RUN_KEY = 'secretMultiLinkRun';
    const TAB_RUN_ID_KEY = 'secretMultiLinkRunId';
    const DEBUG_DISMISSED_RUN_KEY = 'secretMultiLinkDebugDismissedRunId';
    const GHOST_TIME_KEY = 'secretMultiLinkGhostTime';
    const MAX_LINKS_BY_PROFILE = {
        1: 15,
        2: 10,
        4: 14,
        6: 1,
        7: 13,
        8: 1,
        9: 1,
    };
    const PAGE_TIMEOUT_MS = 45000;
    const ELEMENT_TIMEOUT_MS = 7000;
    const DOM_QUIET_MS = 1200;
    const ACTION_DELAY_FACTOR = 0.7;
    const MAX_CONSTRUCTION_ORDERS = 13;
    const POST_ACTION_DELAY_MIN_MS = 700;
    const POST_ACTION_DELAY_MAX_MS = 1700;
    const LIFEFORM_DELAY_MIN_MS = POST_ACTION_DELAY_MIN_MS;
    const LIFEFORM_DELAY_MAX_MS = POST_ACTION_DELAY_MAX_MS;
    const IMPORT_DELAY_MIN_MS = POST_ACTION_DELAY_MIN_MS;
    const IMPORT_DELAY_MAX_MS = POST_ACTION_DELAY_MAX_MS;
    const CONSTRUCTION_DELAY_MIN_MS = POST_ACTION_DELAY_MIN_MS;
    const CONSTRUCTION_DELAY_MAX_MS = POST_ACTION_DELAY_MAX_MS;
    const GHOST_DELAY_MIN_MS = POST_ACTION_DELAY_MIN_MS;
    const GHOST_DELAY_MAX_MS = POST_ACTION_DELAY_MAX_MS;
    const EXPEDITION_V2_DELAY_MIN_MS = POST_ACTION_DELAY_MIN_MS;
    const EXPEDITION_V2_DELAY_MAX_MS = POST_ACTION_DELAY_MAX_MS;
    const EXPEDITION_SLOTS_SELECTOR = '#slots > div:nth-child(2) > span';
    const LIFEFORM_DISCOVER_SELECTOR = '#discoverSystemBtn';
    const LIFEFORM_SLOT_USED_SELECTOR = '#slots #slotUsed';
    const LIFEFORM_SLOT_VALUE_SELECTOR = '#slots #slotValue';
    const LIFEFORM_DIRECTIONS = {
        next: '#galaxyHeader > form > span.galaxy_icons.next.ipiHintable',
        prev: '#galaxyHeader > form > span.galaxy_icons.prev.ipiHintable',
    };
    const EXPEDITION_V2_TEMPLATE_SELECTOR =
        '#galaxyExpeditionFleetTemplateContainer > span > a';
    const EXPEDITION_V2_EXPE_SELECTOR = '#dropdown579 > li:nth-child(2) > a';
    const EXPEDITION_V2_BUTTON_SELECTOR = '#expeditionbutton';
    const EXPEDITION_V2_STOP_TEXT = 'trop d`expéditions simultanées';
    const EXPEDITION_V2_MAX_LAUNCHES = 100;
    const IMPORT_MAX_SELECTOR =
        '#div_importexport > div.content > div.right_box > div.right_content > div.payment > div > table > tbody > tr:nth-child(5) > td:nth-child(5) > a';
    const IMPORT_PAY_SELECTOR =
        '#div_importexport > div.content > div.right_box > div.right_content > div.payment > a';
    const IMPORT_TAKE_SELECTOR =
        '#div_importexport > div.content > div.right_box > div.right_content > div.bargain_overlay > a.bargain.import_bargain.take';
    const CONSTRUCTION_TRANSPORTER_SELECTOR =
        '#civil > li.technology.transporterSmall.interactive.hasDetails.tooltip.hideTooltipOnMouseenter.js_hideTipOnMobile.ipiHintable > input[type="text"]';
    const CONSTRUCTION_RESOURCE_SELECTORS = {
        r1: '#metal',
        r2: '#crystal',
        r3: '#deuterium',
    };
    const CONSTRUCTION_CONTINUE_SELECTOR = '#continueToFleet2 > span';
    const CONSTRUCTION_SEND_SELECTOR = '#sendFleet > span';
    const GHOST_SEND_ALL_SELECTOR = '#sendall';

    class ElementNotFoundError extends Error {
        constructor(selector, timeoutMs) {
            super(`Élément introuvable après ${timeoutMs} ms : ${selector}`);
            this.name = 'ElementNotFoundError';
            this.selector = selector;
        }
    }

    // Cette série sera exécutée, dans le même ordre, pour chacun des liens.
    // Elle sera complétée lorsque les boutons et les pages auront été identifiés.
    // Formats déjà pris en charge par le moteur :
    // { type: 'click', selector: '...', waitAfter: 'page' }
    // { type: 'waitFor', selector: '...' }
    // { type: 'setValue', selector: '...', value: '...' }
    // { type: 'waitPage' }
    // { type: 'delay', ms: 500 }
    // { type: 'pause', message: '...' }
    const ACTION_STEPS_1 = [
        {
            name: 'Sélectionner transporterLarge',
            type: 'click',
            selector: '#civil > li.technology.transporterLarge.interactive > span.icon.transporterLarge',
        },
        {
            name: 'Continuer vers la page suivante',
            type: 'click',
            selector: '#continueToFleet2 > span',
            waitAfter: 'page',
            timeoutMs: PAGE_TIMEOUT_MS,
        },
        {
            name: 'Sélectionner toutes les ressources',
            type: 'click',
            selector: '#allresources > img',
        },
        {
            name: 'Envoyer la flotte',
            type: 'click',
            selector: '#sendFleet',
            randomDelayBefore: {
                minMs: 100,
                maxMs: 1700,
            },
            clickCount: 2,
            clickIntervalMs: 500,
            waitAfter: 'page',
            timeoutMs: PAGE_TIMEOUT_MS,
        },
    ];

    const ACTION_STEPS_2 = [
        {
            name: 'Saisir 1 reaper',
            type: 'setValue',
            selector: '#military input[name="reaper"]',
            value: '1',
        },
        {
            name: 'Saisir 1 explorer',
            type: 'setValue',
            selector: '#military input[name="explorer"]',
            value: '1',
        },
        {
            name: 'Saisir le nombre de petites voitures',
            type: 'setValue',
            selector: '#civil input[name="transporterSmall"]',
            configValue: 'smallVehicleCount',
            defaultValue: '6400',
        },
        {
            name: 'Continuer vers la page suivante',
            type: 'click',
            selector: '#continueToFleet2 > span',
            randomDelayBefore: {
                minMs: 100,
                maxMs: 2000,
            },
            waitAfter: 'page',
            timeoutMs: PAGE_TIMEOUT_MS,
        },
        {
            name: 'Envoyer la flotte',
            type: 'click',
            selector: '#sendFleet > span',
            clickCount: 2,
            clickIntervalMs: 1000,
            waitAfter: 'page',
            timeoutMs: PAGE_TIMEOUT_MS,
        },
    ];

    let uiPromise;
    let uiHost = null;
    let uiRestoreInProgress = false;

    registerMenuCommandSafely('Configurer Ressources', () => {
        void openControlPanel(1);
    });
    registerMenuCommandSafely('Démarrer Ressources', () => {
        void startFromStoredConfiguration(1);
    });
    registerMenuCommandSafely('Configurer Expéditions', () => {
        void openControlPanel(2);
    });
    registerMenuCommandSafely('Démarrer Expéditions', () => {
        void startFromStoredConfiguration(2);
    });
    registerMenuCommandSafely('Configurer Ressources & Expéditions', () => {
        void openControlPanel(3);
    });
    registerMenuCommandSafely('Démarrer Ressources & Expéditions', () => {
        void startCombinedAutomation();
    });
    registerMenuCommandSafely('Configurer Forme de vie', () => {
        void openControlPanel(4);
    });
    registerMenuCommandSafely('Démarrer Forme de vie', () => {
        void startFromStoredConfiguration(4);
    });
    registerMenuCommandSafely('Configurer Expédition & Forme de vie', () => {
        void openControlPanel(5);
    });
    registerMenuCommandSafely('Démarrer Expédition & Forme de vie', () => {
        void startExpeditionsLifeformAutomation();
    });
    registerMenuCommandSafely('Configurer Import', () => {
        void openControlPanel(6);
    });
    registerMenuCommandSafely('Démarrer Import', () => {
        void startFromStoredConfiguration(6);
    });
    registerMenuCommandSafely('Configurer Constructions', () => {
        void openControlPanel(7);
    });
    registerMenuCommandSafely('Démarrer Constructions', () => {
        void startFromStoredConfiguration(7);
    });
    registerMenuCommandSafely('Configurer Ghost', () => {
        void openControlPanel(8);
    });
    registerMenuCommandSafely('Ouvrir Ghost', () => {
        void ensureUi().then((ui) => ui.openGhostRunner());
    });
    registerMenuCommandSafely('Configurer Expédition V2', () => {
        void openControlPanel(9);
    });
    registerMenuCommandSafely('Démarrer Expédition V2', () => {
        void startFromStoredConfiguration(9);
    });
    registerMenuCommandSafely('Configurer Expédition V2 & Forme de vie', () => {
        void openControlPanel(10);
    });
    registerMenuCommandSafely('Démarrer Expédition V2 & Forme de vie', () => {
        void startExpeditionV2LifeformAutomation();
    });
    registerMenuCommandSafely('Arrêter la boucle', () => {
        void stopAutomation('Arrêt demandé depuis le menu Tampermonkey.');
    });

    void boot().catch(showStartupError);

    function registerMenuCommandSafely(label, callback) {
        if (typeof GM_registerMenuCommand !== 'function') return;
        try {
            GM_registerMenuCommand(label, callback);
        } catch (error) {
            console.warn(`[Projet secret] Commande de menu indisponible : ${label}`, error);
        }
    }

    function showStartupError(error) {
        console.error('[Projet secret] Erreur de démarrage', error);

        const display = () => {
            if (!document.documentElement) return;
            const previous = document.getElementById('secret-multi-link-startup-error');
            if (previous) previous.remove();

            const message = document.createElement('button');
            message.id = 'secret-multi-link-startup-error';
            message.type = 'button';
            message.textContent = `Erreur Projet secret : ${error?.message || String(error)}`;
            message.title = 'Touchez pour fermer';
            message.style.cssText = [
                'all:initial',
                'position:fixed',
                'top:max(12px,env(safe-area-inset-top))',
                'left:12px',
                'right:12px',
                'z-index:2147483647',
                'display:block',
                'box-sizing:border-box',
                'padding:14px',
                'border:2px solid #fff',
                'border-radius:10px',
                'background:#b91c1c',
                'color:#fff',
                'font:700 15px/1.4 system-ui,sans-serif',
                'text-align:left',
                'box-shadow:0 6px 24px rgba(0,0,0,.4)',
            ].join(';');
            message.addEventListener('click', () => message.remove());
            document.documentElement.appendChild(message);
        };

        if (document.documentElement) {
            display();
        } else {
            document.addEventListener('DOMContentLoaded', display, { once: true });
        }
    }

    async function boot() {
        await waitForDocumentReady();
        const ui = await ensureUi();
        ui.refresh();
        startUiWatchdog();
        await resumeAutomationForThisTab();
    }

    async function ensureUi() {
        const hostIsMounted =
            uiHost &&
            uiHost.isConnected &&
            document.documentElement &&
            document.documentElement.contains(uiHost);

        if (!uiPromise || !hostIsMounted) {
            uiPromise = Promise.resolve(createControlUi());
        }
        return uiPromise;
    }

    function startUiWatchdog() {
        const restoreUi = async () => {
            if (uiRestoreInProgress || !document.documentElement) return;

            const hostIsMounted =
                uiHost &&
                uiHost.isConnected &&
                document.documentElement.contains(uiHost);
            if (hostIsMounted) return;

            uiRestoreInProgress = true;
            try {
                uiPromise = null;
                uiHost = null;
                const ui = await ensureUi();
                ui.refresh();
                console.info('[Projet secret] Interface restaurée automatiquement.');
            } catch (error) {
                showStartupError(error);
            } finally {
                uiRestoreInProgress = false;
            }
        };

        window.setInterval(() => {
            void restoreUi();
        }, 1200);
        window.addEventListener('pageshow', () => {
            void restoreUi();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void restoreUi();
            }
        });
    }

    async function openControlPanel(profileId = 1) {
        await waitForDocumentReady();
        const ui = await ensureUi();
        ui.open(profileId);
        ui.refresh();
    }

    function createControlUi() {
        const existing = document.getElementById('secret-multi-link-controls');
        if (existing) {
            existing.remove();
        }

        const host = document.createElement('div');
        host.id = 'secret-multi-link-controls';
        host.style.cssText = [
            'all:initial',
            'position:fixed',
            'right:max(10px,env(safe-area-inset-right))',
            'top:max(10px,env(safe-area-inset-top))',
            'z-index:2147483647',
        ].join(';');
        host.style.setProperty('display', 'block', 'important');
        host.style.setProperty('position', 'fixed', 'important');
        host.style.setProperty('right', 'max(10px,env(safe-area-inset-right))', 'important');
        host.style.setProperty('top', 'max(10px,env(safe-area-inset-top))', 'important');
        host.style.setProperty('bottom', 'auto', 'important');
        host.style.setProperty('z-index', '2147483647', 'important');
        host.style.setProperty('visibility', 'visible', 'important');
        host.style.setProperty('opacity', '1', 'important');
        host.style.setProperty('pointer-events', 'auto', 'important');

        const constructionLinkRows = Array.from({ length: 13 }, (_, index) => `
            <div class="named-link-row">
                <span>${index + 1}</span>
                <input class="named-link-name" type="text" maxlength="60" autocomplete="off" placeholder="Nom">
                <input class="named-link-url" type="url" spellcheck="false" autocomplete="off" placeholder="https://…">
            </div>
        `).join('');
        const ghostHourOptions = Array.from({ length: 24 }, (_, hour) => {
            const value = String(hour).padStart(2, '0');
            return `<option value="${value}">${value}</option>`;
        }).join('');
        const ghostMinuteOptions = Array.from({ length: 60 }, (_, minute) => {
            const value = String(minute).padStart(2, '0');
            return `<option value="${value}">${value}</option>`;
        }).join('');
        const shadow = host.attachShadow({ mode: 'closed' });
        shadow.innerHTML = `
            <style>
                *, *::before, *::after { box-sizing: border-box; }
                :host { color-scheme: dark; }
                @keyframes secret-enter {
                    from { opacity: 0; transform: translateY(-7px) scale(.985); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .dock {
                    position: relative;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                .toolbar {
                    display: flex;
                    flex-wrap: nowrap;
                    justify-content: flex-end;
                    align-items: center;
                    gap: 8px;
                    max-width: calc(100vw - 20px);
                    padding: 6px;
                    border: 1px solid rgba(255, 255, 255, .16);
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(15, 23, 42, .88), rgba(30, 41, 59, .78));
                    box-shadow: 0 14px 38px rgba(2, 6, 23, .32), inset 0 1px 0 rgba(255, 255, 255, .11);
                    backdrop-filter: blur(18px) saturate(150%);
                    -webkit-backdrop-filter: blur(18px) saturate(150%);
                    overflow: visible;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                .menu-group { position: relative; flex: 0 0 auto; }
                .menu-toggle {
                    min-height: 42px;
                    padding: 9px 15px;
                    border: 1px solid rgba(255, 255, 255, .14);
                    border-radius: 11px;
                    background: linear-gradient(135deg, rgba(30, 41, 59, .96), rgba(51, 65, 85, .9));
                    color: #f8fafc;
                    font-weight: 760;
                    font-size: 12px;
                    letter-spacing: .01em;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
                    white-space: nowrap;
                }
                .menu-toggle::after { content: '⌄'; margin-left: 9px; color: #93c5fd; }
                .menu-toggle:hover, .menu-toggle.open { background: linear-gradient(135deg, #334155, #475569); }
                .menu-toggle.running { box-shadow: inset 0 0 0 1px #fb7185, 0 0 18px rgba(244,63,94,.24); }
                .dropdown-menu {
                    display: none;
                    position: absolute;
                    top: calc(100% + 10px);
                    right: 0;
                    width: 270px;
                    padding: 8px;
                    border: 1px solid rgba(148, 163, 184, .26);
                    border-radius: 14px;
                    background: linear-gradient(150deg, rgba(15, 23, 42, .99), rgba(30, 41, 59, .98));
                    box-shadow: 0 24px 65px rgba(2, 6, 23, .5), inset 0 1px 0 rgba(255,255,255,.08);
                    backdrop-filter: blur(22px);
                    -webkit-backdrop-filter: blur(22px);
                }
                .dropdown-menu.open { display: grid; gap: 7px; animation: secret-enter .18s ease-out; }
                .dropdown-menu .control-group { width: 100%; }
                .dropdown-menu .quick { flex: 1 1 auto; min-width: 0 !important; text-align: left; }
                .control-group {
                    display: flex;
                    flex: 0 0 auto;
                    align-items: stretch;
                    min-height: 42px;
                    border: 1px solid rgba(255, 255, 255, .13);
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, .055);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
                }
                button, textarea, input, select { font: inherit; }
                button {
                    min-height: 42px;
                    cursor: pointer;
                    touch-action: manipulation;
                    -webkit-tap-highlight-color: transparent;
                }
                button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
                    outline: 2px solid #7dd3fc;
                    outline-offset: 2px;
                }
                .quick, .settings {
                    border: 0;
                    color: #fff;
                    transition: transform .16s ease, background .16s ease, box-shadow .16s ease;
                }
                .quick {
                    min-width: 116px;
                    padding: 9px 14px;
                    background: linear-gradient(135deg, rgba(37, 99, 235, .95), rgba(79, 70, 229, .95));
                    font-weight: 760;
                    font-size: 12px;
                    letter-spacing: .01em;
                    white-space: nowrap;
                }
                .control-group.expeditions .quick {
                    background: linear-gradient(135deg, rgba(5, 150, 105, .96), rgba(13, 148, 136, .96));
                }
                .control-group.expeditions-v2 .quick {
                    background: linear-gradient(135deg, rgba(14, 116, 144, .97), rgba(79, 70, 229, .96));
                }
                .control-group.combined .quick {
                    min-width: 196px;
                    background: linear-gradient(135deg, rgba(124, 58, 237, .97), rgba(219, 39, 119, .94));
                }
                .control-group.lifeform .quick {
                    min-width: 126px;
                    background: linear-gradient(135deg, rgba(217, 119, 6, .97), rgba(234, 88, 12, .95));
                }
                .control-group.expeditions-lifeform .quick {
                    min-width: 210px;
                    background: linear-gradient(135deg, rgba(8, 145, 178, .97), rgba(124, 58, 237, .96));
                }
                .control-group.import .quick {
                    background: linear-gradient(135deg, rgba(14, 116, 144, .97), rgba(37, 99, 235, .96));
                }
                .control-group.constructions .quick {
                    background: linear-gradient(135deg, rgba(180, 83, 9, .97), rgba(202, 138, 4, .96));
                }
                .control-group.ghost .quick {
                    background: linear-gradient(135deg, rgba(71, 85, 105, .98), rgba(88, 28, 135, .96));
                }
                .control-group.expeditions-v2-lifeform .quick {
                    min-width: 230px;
                    background: linear-gradient(135deg, rgba(8, 145, 178, .97), rgba(109, 40, 217, .96), rgba(217, 119, 6, .94));
                }
                .quick.pending:disabled {
                    cursor: not-allowed;
                    filter: saturate(.72);
                    opacity: .78;
                }
                .quick:hover, .settings:hover { filter: brightness(1.1); }
                .quick:active, .settings:active { transform: translateY(1px) scale(.985); }
                .quick.running {
                    background: linear-gradient(135deg, #dc2626, #e11d48) !important;
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
                }
                .settings {
                    width: 40px;
                    height: 42px;
                    padding: 0;
                    border-left: 1px solid rgba(255, 255, 255, .16);
                    background: rgba(15, 23, 42, .72);
                    color: #dbeafe;
                    font-size: 15px;
                }
                .panel {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 62px;
                    width: min(430px, calc(100vw - 20px));
                    max-height: min(720px, calc(100vh - 82px));
                    overflow: auto;
                    overscroll-behavior: contain;
                    padding: 18px;
                    border: 1px solid #3b4963;
                    border-radius: 16px;
                    background: linear-gradient(150deg, rgba(15, 23, 42, .98), rgba(30, 41, 59, .97));
                    color: #fff;
                    box-shadow: 0 24px 70px rgba(2, 6, 23, .52), inset 0 1px 0 rgba(255,255,255,.08);
                    backdrop-filter: blur(22px);
                    -webkit-backdrop-filter: blur(22px);
                }
                .panel.open { display: block; animation: secret-enter .2s ease-out; }
                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 5px;
                }
                h2 { margin: 0; font-size: 18px; line-height: 1.25; }
                .close {
                    border: 0;
                    padding: 2px 5px;
                    background: transparent;
                    color: #cbd5e1;
                    font-size: 20px;
                }
                .help { margin: 0 0 13px; color: #cbd5e1; font-size: 12px; line-height: 1.45; }
                label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; }
                .start-url-group, .small-vehicle-group { display: none; margin-bottom: 13px; }
                .start-url, .small-vehicle-count {
                    display: block;
                    width: 100%;
                    padding: 9px 10px;
                    border: 1px solid #64748b;
                    border-radius: 7px;
                    background: #fff;
                    color: #111827;
                    font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
                    outline: none;
                }
                .start-url:focus, .small-vehicle-count:focus { border-color: #60a5fa; box-shadow: 0 0 0 2px rgba(96, 165, 250, .25); }
                .field-help { margin: 5px 0 0; color: #94a3b8; font-size: 11px; line-height: 1.4; }
                .combined-config {
                    display: none;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin: 14px 0;
                }
                .combined-config button {
                    min-height: 74px;
                    padding: 12px;
                    border: 1px solid rgba(148, 163, 184, .28);
                    border-radius: 12px;
                    background: rgba(15, 23, 42, .72);
                    color: #e2e8f0;
                    font-weight: 750;
                    line-height: 1.35;
                }
                .combined-config button:hover { background: rgba(51, 65, 85, .82); }
                textarea {
                    display: block;
                    width: 100%;
                    min-height: 205px;
                    resize: vertical;
                    padding: 10px;
                    border: 1px solid #64748b;
                    border-radius: 7px;
                    background: #fff;
                    color: #111827;
                    font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
                    outline: none;
                }
                textarea:focus { border-color: #60a5fa; box-shadow: 0 0 0 2px rgba(96, 165, 250, .25); }
                .named-links-field-group { display: none; }
                .named-links-grid {
                    display: grid;
                    gap: 7px;
                    max-height: min(430px, calc(100vh - 290px));
                    overflow: auto;
                    padding-right: 3px;
                }
                .named-link-row {
                    display: grid;
                    grid-template-columns: 24px minmax(92px, .8fr) minmax(170px, 1.45fr);
                    align-items: center;
                    gap: 7px;
                }
                .named-link-row > span {
                    color: #94a3b8;
                    font-size: 11px;
                    text-align: right;
                }
                .named-link-row input,
                .construction-runner input,
                .construction-runner select {
                    width: 100%;
                    min-width: 0;
                    padding: 9px 10px;
                    border: 1px solid #64748b;
                    border-radius: 7px;
                    background: #fff;
                    color: #111827;
                    outline: none;
                }
                .named-link-row input:focus,
                .construction-runner input:focus,
                .construction-runner select:focus {
                    border-color: #60a5fa;
                    box-shadow: 0 0 0 2px rgba(96, 165, 250, .25);
                }
                .under-input {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 5px;
                    color: #94a3b8;
                    font-size: 11px;
                }
                .repeat-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 13px 0;
                    color: #e2e8f0;
                    font-size: 12px;
                }
                .repeat-row input { width: 15px; height: 15px; }
                .status {
                    margin: 12px 0;
                    padding: 9px 10px;
                    border-radius: 7px;
                    background: #0f172a;
                    color: #dbeafe;
                    font-size: 12px;
                    line-height: 1.4;
                    overflow-wrap: anywhere;
                }
                .error { display: none; margin: 8px 0; color: #fecaca; font-size: 12px; }
                .error.visible { display: block; }
                .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
                .actions button {
                    padding: 8px 11px;
                    border: 0;
                    border-radius: 9px;
                    color: #fff;
                    font-weight: 650;
                    font-size: 12px;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 7px 18px rgba(2,6,23,.18);
                    transition: transform .16s ease, filter .16s ease, box-shadow .16s ease;
                }
                .actions button:hover { filter: brightness(1.1); transform: translateY(-1px); }
                .actions button:active { transform: translateY(0) scale(.98); }
                .save { background: linear-gradient(135deg, #475569, #334155); }
                .start { background: linear-gradient(135deg, #2563eb, #4f46e5); }
                .stop { background: linear-gradient(135deg, #9f2436, #be123c); }
                .debug-progress {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 62px;
                    width: min(390px, calc(100vw - 20px));
                    grid-template-columns: 8px minmax(0, 1fr) 28px;
                    align-items: start;
                    gap: 10px;
                    padding: 11px 10px 11px 12px;
                    border: 1px solid rgba(147, 197, 253, .9);
                    border-radius: 14px;
                    background: linear-gradient(135deg, rgba(15, 23, 42, .62), rgba(15, 23, 42, .48));
                    color: #f0f9ff;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, .18);
                    font: 750 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    text-shadow: 0 1px 3px rgba(0, 0, 0, .95);
                    pointer-events: auto;
                    backdrop-filter: blur(12px) saturate(135%);
                    -webkit-backdrop-filter: blur(12px) saturate(135%);
                    transition: border-color .2s ease, background .2s ease, box-shadow .2s ease;
                }
                .debug-progress::before {
                    content: '';
                    width: 8px;
                    height: 8px;
                    margin-top: 5px;
                    border-radius: 999px;
                    background: #93c5fd;
                    box-shadow: 0 0 0 4px rgba(147, 197, 253, .14);
                }
                .debug-progress-content {
                    min-width: 0;
                    white-space: pre-line;
                    overflow-wrap: anywhere;
                }
                .debug-progress-close {
                    display: grid;
                    place-items: center;
                    width: 28px;
                    height: 28px;
                    margin: -4px -3px 0 0;
                    padding: 0;
                    border: 1px solid rgba(255, 255, 255, .14);
                    border-radius: 9px;
                    background: rgba(15, 23, 42, .28);
                    color: currentColor;
                    font: 700 18px/1 system-ui, sans-serif;
                    text-shadow: none;
                    cursor: pointer;
                    opacity: .78;
                    transition: opacity .16s ease, background .16s ease, transform .16s ease;
                }
                .debug-progress-close:hover {
                    background: rgba(255, 255, 255, .14);
                    opacity: 1;
                    transform: scale(1.05);
                }
                .debug-progress-close:active { transform: scale(.94); }
                .debug-progress.running {
                    border-color: rgba(251, 146, 60, .92);
                    background: linear-gradient(135deg, rgba(124, 45, 18, .66), rgba(67, 31, 14, .56));
                    color: #fff7ed;
                    box-shadow: 0 10px 30px rgba(124, 45, 18, .24);
                }
                .debug-progress.running::before {
                    background: #fb923c;
                    box-shadow: 0 0 0 4px rgba(251, 146, 60, .18), 0 0 14px rgba(251, 146, 60, .7);
                }
                .debug-progress.completed {
                    border-color: rgba(74, 222, 128, .92);
                    background: linear-gradient(135deg, rgba(20, 83, 45, .68), rgba(10, 52, 31, .58));
                    color: #ecfdf5;
                    box-shadow: 0 10px 30px rgba(20, 83, 45, .24);
                }
                .debug-progress.completed::before {
                    background: #4ade80;
                    box-shadow: 0 0 0 4px rgba(74, 222, 128, .17), 0 0 14px rgba(74, 222, 128, .55);
                }
                .debug-progress.error {
                    border-color: #f87171;
                    background: linear-gradient(135deg, rgba(127, 29, 29, .7), rgba(69, 10, 10, .62));
                    color: #fff;
                    box-shadow: 0 10px 30px rgba(127, 29, 29, .25);
                }
                .debug-progress.error::before {
                    background: #f87171;
                    box-shadow: 0 0 0 4px rgba(248, 113, 113, .17), 0 0 14px rgba(248, 113, 113, .55);
                }
                .construction-runner {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 62px;
                    width: min(680px, calc(100vw - 20px));
                    max-height: calc(100vh - 82px - env(safe-area-inset-top));
                    overflow: auto;
                    padding: 18px;
                    border: 1px solid rgba(251, 191, 36, .58);
                    border-radius: 20px;
                    background:
                        radial-gradient(circle at 92% 4%, rgba(245, 158, 11, .22), transparent 34%),
                        linear-gradient(150deg, rgba(9, 15, 29, .985), rgba(30, 41, 59, .975));
                    color: #fff;
                    box-shadow: 0 26px 80px rgba(2, 6, 23, .58), inset 0 1px 0 rgba(255,255,255,.1);
                    backdrop-filter: blur(24px) saturate(145%);
                    -webkit-backdrop-filter: blur(24px) saturate(145%);
                }
                .construction-runner.open { display: block; animation: secret-enter .22s ease-out; }
                .construction-kicker {
                    display: block;
                    margin-bottom: 3px;
                    color: #fbbf24;
                    font-size: 9px;
                    font-weight: 850;
                    letter-spacing: .16em;
                }
                .construction-flow {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 5px;
                    margin: 13px 0;
                    padding: 4px;
                    border: 1px solid rgba(148, 163, 184, .16);
                    border-radius: 11px;
                    background: rgba(2, 6, 23, .28);
                }
                .construction-flow span {
                    padding: 6px 4px;
                    border-radius: 8px;
                    color: #cbd5e1;
                    font-size: 10px;
                    font-weight: 720;
                    text-align: center;
                }
                .construction-flow span:first-child {
                    background: rgba(245, 158, 11, .18);
                    color: #fde68a;
                }
                .construction-orders {
                    display: grid;
                    gap: 9px;
                    margin: 14px 0 10px;
                }
                .construction-orders-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    color: #e2e8f0;
                    font-size: 11px;
                    font-weight: 780;
                }
                .construction-orders-counter {
                    color: #fbbf24;
                    font-variant-numeric: tabular-nums;
                }
                .construction-orders-list {
                    display: grid;
                    gap: 10px;
                    max-height: min(51vh, 520px);
                    overflow: auto;
                    padding: 1px 4px 1px 1px;
                    scrollbar-width: thin;
                }
                .construction-order-row {
                    padding: 11px;
                    border: 1px solid rgba(148, 163, 184, .2);
                    border-radius: 13px;
                    background: rgba(15, 23, 42, .52);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
                }
                .construction-order-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 9px;
                }
                .construction-order-title {
                    color: #fde68a;
                    font-size: 11px;
                    font-weight: 850;
                    letter-spacing: .05em;
                    text-transform: uppercase;
                }
                .construction-order-summary {
                    flex: 1;
                    color: #a7f3d0;
                    font-size: 10px;
                    font-weight: 700;
                    text-align: right;
                }
                .construction-order-remove {
                    display: grid;
                    place-items: center;
                    width: 25px;
                    height: 25px;
                    padding: 0;
                    border: 1px solid rgba(248, 113, 113, .3);
                    border-radius: 8px;
                    background: rgba(127, 29, 29, .22);
                    color: #fecaca;
                    font: 800 15px/1 system-ui, sans-serif;
                    cursor: pointer;
                }
                .construction-order-remove:hover { background: rgba(185, 28, 28, .4); }
                .construction-order-remove:disabled { visibility: hidden; }
                .construction-order-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(82px, .72fr)) minmax(145px, 1.35fr);
                    gap: 8px;
                    align-items: end;
                }
                .construction-order-field > label {
                    display: block;
                    margin-bottom: 5px;
                }
                .amount-input-shell { position: relative; }
                .amount-input-shell input { padding-right: 31px; }
                .amount-input-shell > span {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #fbbf24;
                    font-size: 11px;
                    font-weight: 850;
                    pointer-events: none;
                }
                .construction-add-order {
                    width: 100%;
                    min-height: 38px;
                    border: 1px dashed rgba(251, 191, 36, .55);
                    border-radius: 11px;
                    background: rgba(120, 53, 15, .16);
                    color: #fde68a;
                    font: 800 12px/1 system-ui, sans-serif;
                    cursor: pointer;
                    transition: background .16s ease, border-color .16s ease, transform .16s ease;
                }
                .construction-add-order:hover {
                    border-color: rgba(251, 191, 36, .9);
                    background: rgba(120, 53, 15, .3);
                    transform: translateY(-1px);
                }
                .construction-add-order:disabled {
                    cursor: default;
                    opacity: .45;
                    transform: none;
                }
                .construction-runner input,
                .construction-runner select {
                    border-color: rgba(148, 163, 184, .38);
                    background: rgba(15, 23, 42, .76);
                    color: #f8fafc;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
                }
                .construction-runner select option { background: #0f172a; color: #f8fafc; }
                .construction-calculation {
                    margin: 12px 0;
                    padding: 10px 11px;
                    border: 1px solid rgba(251, 191, 36, .28);
                    border-radius: 9px;
                    background: linear-gradient(135deg, rgba(120, 53, 15, .34), rgba(67, 56, 202, .16));
                    color: #fef3c7;
                    font-size: 12px;
                    font-weight: 720;
                    line-height: 1.45;
                }
                .construction-runner-error {
                    display: none;
                    margin: 9px 0;
                    color: #fecaca;
                    font-size: 12px;
                }
                .construction-runner-error.visible { display: block; }
                .ghost-runner {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 62px;
                    width: min(360px, calc(100vw - 20px));
                    padding: 18px;
                    border: 1px solid rgba(167, 139, 250, .55);
                    border-radius: 20px;
                    background:
                        radial-gradient(circle at 88% 2%, rgba(139, 92, 246, .25), transparent 38%),
                        linear-gradient(150deg, rgba(9, 15, 29, .985), rgba(30, 41, 59, .975));
                    color: #fff;
                    box-shadow: 0 26px 80px rgba(2, 6, 23, .58), inset 0 1px 0 rgba(255,255,255,.1);
                    backdrop-filter: blur(24px) saturate(145%);
                    -webkit-backdrop-filter: blur(24px) saturate(145%);
                }
                .ghost-runner.open { display: block; animation: secret-enter .22s ease-out; }
                .ghost-kicker {
                    display: block;
                    margin-bottom: 3px;
                    color: #c4b5fd;
                    font-size: 9px;
                    font-weight: 850;
                    letter-spacing: .16em;
                }
                .ghost-time-grid {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    align-items: end;
                    gap: 10px;
                    margin: 16px 0 12px;
                }
                .ghost-time-separator {
                    padding-bottom: 10px;
                    color: #c4b5fd;
                    font-size: 22px;
                    font-weight: 900;
                }
                .ghost-time-field label { margin-bottom: 6px; }
                .ghost-time-field select {
                    width: 100%;
                    min-height: 46px;
                    padding: 9px 11px;
                    border: 1px solid rgba(167, 139, 250, .46);
                    border-radius: 11px;
                    background: rgba(15, 23, 42, .8);
                    color: #f8fafc;
                    font-size: 16px;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                }
                .ghost-time-field select:focus {
                    border-color: #a78bfa;
                    box-shadow: 0 0 0 3px rgba(167, 139, 250, .2);
                }
                .ghost-time-field select option { background: #0f172a; color: #f8fafc; }
                .ghost-time-preview {
                    margin: 0 0 14px;
                    padding: 10px 12px;
                    border: 1px solid rgba(167, 139, 250, .25);
                    border-radius: 11px;
                    background: rgba(76, 29, 149, .16);
                    color: #ede9fe;
                    font-size: 12px;
                    font-weight: 760;
                    text-align: center;
                }
                @media (max-width: 600px) {
                    .toolbar { justify-content: flex-end; gap: 6px; }
                    .menu-toggle { padding-inline: 11px; }
                    .dropdown-menu { width: min(290px, calc(100vw - 20px)); }
                    .panel {
                        width: calc(100vw - 20px);
                        max-height: calc(100vh - 88px - env(safe-area-inset-top));
                        padding: 14px;
                    }
                    .start-url, .small-vehicle-count, textarea { font-size: 16px; }
                    textarea { min-height: 165px; }
                    .actions button { min-height: 44px; }
                    .named-link-row { grid-template-columns: 22px minmax(82px, .7fr) minmax(145px, 1.3fr); }
                    .named-link-row input, .construction-runner input, .construction-runner select { font-size: 16px; }
                    .construction-runner, .ghost-runner { padding: 14px; }
                    .construction-order-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                    .construction-order-field.destination { grid-column: 1 / -1; }
                    .construction-orders-list { max-height: min(48vh, 480px); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .dropdown-menu.open, .panel.open, .construction-runner.open, .ghost-runner.open { animation: none; }
                    *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
                }
            </style>
            <div class="dock">
                <div class="debug-progress">
                    <div class="debug-progress-content" role="status" aria-live="polite"></div>
                    <button type="button" class="debug-progress-close" title="Fermer le résumé" aria-label="Fermer le résumé des actions">×</button>
                </div>
                <div class="toolbar">
                    <div class="menu-group simple-menu-group">
                        <button type="button" class="menu-toggle simple-menu-toggle" aria-expanded="false">Actions simples</button>
                        <div class="dropdown-menu simple-menu">
                            <div class="control-group resources">
                                <button type="button" class="quick quick-1" title="Lancer Ressources">Ressources</button>
                                <button type="button" class="settings settings-1" title="Configurer Ressources" aria-label="Configurer Ressources">⚙</button>
                            </div>
                            <div class="control-group expeditions">
                                <button type="button" class="quick quick-2" title="Lancer Expéditions">Expéditions</button>
                                <button type="button" class="settings settings-2" title="Configurer Expéditions" aria-label="Configurer Expéditions">⚙</button>
                            </div>
                            <div class="control-group expeditions-v2">
                                <button type="button" class="quick quick-9" title="Lancer Expédition V2">Expédition V2</button>
                                <button type="button" class="settings settings-9" title="Configurer Expédition V2" aria-label="Configurer Expédition V2">⚙</button>
                            </div>
                            <div class="control-group lifeform">
                                <button type="button" class="quick quick-4" title="Lancer Forme de vie">Forme de vie</button>
                                <button type="button" class="settings settings-4" title="Configurer Forme de vie" aria-label="Configurer Forme de vie">⚙</button>
                            </div>
                            <div class="control-group import">
                                <button type="button" class="quick quick-6" title="Lancer Import">Import</button>
                                <button type="button" class="settings settings-6" title="Configurer Import" aria-label="Configurer Import">⚙</button>
                            </div>
                            <div class="control-group constructions">
                                <button type="button" class="quick quick-7" title="Lancer Constructions">Constructions</button>
                                <button type="button" class="settings settings-7" title="Configurer Constructions" aria-label="Configurer Constructions">⚙</button>
                            </div>
                            <div class="control-group ghost">
                                <button type="button" class="quick quick-8" title="Ouvrir Ghost">Ghost</button>
                                <button type="button" class="settings settings-8" title="Configurer Ghost" aria-label="Configurer Ghost">⚙</button>
                            </div>
                        </div>
                    </div>
                    <div class="menu-group grouped-menu-group">
                        <button type="button" class="menu-toggle grouped-menu-toggle" aria-expanded="false">Actions groupées</button>
                        <div class="dropdown-menu grouped-menu">
                            <div class="control-group combined">
                                <button type="button" class="quick quick-3" title="Lancer Ressources puis Expéditions">Ressources &amp; Expéditions</button>
                                <button type="button" class="settings settings-3" title="Configurer le mode combiné" aria-label="Configurer Ressources et Expéditions">⚙</button>
                            </div>
                            <div class="control-group expeditions-lifeform">
                                <button type="button" class="quick quick-5" title="Lancer Expédition puis Forme de vie">Expédition &amp; Forme de vie</button>
                                <button type="button" class="settings settings-5" title="Configurer Expédition et Forme de vie" aria-label="Configurer Expédition et Forme de vie">⚙</button>
                            </div>
                            <div class="control-group expeditions-v2-lifeform">
                                <button type="button" class="quick quick-10" title="Lancer Expédition V2 puis Forme de vie">Expédition V2 &amp; Forme de vie</button>
                                <button type="button" class="settings settings-10" title="Configurer Expédition V2 et Forme de vie" aria-label="Configurer Expédition V2 et Forme de vie">⚙</button>
                            </div>
                        </div>
                    </div>
                </div>
                <section class="panel" role="dialog" aria-label="Configuration de la boucle">
                    <div class="header">
                        <h2 class="panel-title">Configuration — série 1</h2>
                        <button type="button" class="close" aria-label="Fermer">×</button>
                    </div>
                    <p class="help">
                        Un lien par ligne. Les adresses sont conservées dans le stockage privé de Tampermonkey,
                        jamais dans le code du script.
                    </p>
                    <div class="start-url-group">
                        <label for="secret-start-url-2">Lien de départ</label>
                        <input id="secret-start-url-2" class="start-url" type="url" spellcheck="false" autocomplete="off" placeholder="Lien chargé avant la première action">
                        <p class="field-help">Chargé une seule fois avant le lien choisi aléatoirement.</p>
                    </div>
                    <div class="small-vehicle-group">
                        <label for="secret-small-vehicle-count">Nombre de petites voitures</label>
                        <input id="secret-small-vehicle-count" class="small-vehicle-count" type="number" min="0" step="1" inputmode="numeric" value="6400">
                        <p class="field-help">Cette valeur remplace automatiquement 6400 dans l’action correspondante.</p>
                    </div>
                    <div class="links-field-group">
                        <label for="secret-links" class="links-label">Liens à traiter</label>
                        <textarea id="secret-links" spellcheck="false" autocomplete="off" placeholder="Lien 1&#10;Lien 2&#10;…"></textarea>
                        <div class="under-input">
                            <span class="limit-label">Minimum 1, maximum 15</span>
                            <span class="counter">0 / 15</span>
                        </div>
                    </div>
                    <div class="named-links-field-group">
                        <label>Destinations de Constructions</label>
                        <p class="field-help">Renseignez un nom d’affichage et son URL. Les lignes entièrement vides sont ignorées.</p>
                        <div class="named-links-grid">${constructionLinkRows}</div>
                        <div class="under-input">
                            <span>Minimum 1, maximum 13</span>
                            <span class="named-links-counter">0 / 13</span>
                        </div>
                    </div>
                    <label class="repeat-row">
                        <input type="checkbox" class="repeat">
                        Recommencer au premier lien après le dernier
                    </label>
                    <div class="combined-config">
                        <button type="button" class="combined-resources">Configurer<br>Ressources</button>
                        <button type="button" class="combined-expeditions">Configurer<br>Expéditions</button>
                    </div>
                    <div class="error" role="alert"></div>
                    <div class="status" role="status">Prêt.</div>
                    <div class="actions">
                        <button type="button" class="stop">Arrêter</button>
                        <button type="button" class="save">Enregistrer</button>
                        <button type="button" class="start">Enregistrer et lancer</button>
                    </div>
                </section>
                <section class="construction-runner" role="dialog" aria-label="Lancer Constructions">
                    <div class="header">
                        <div>
                            <span class="construction-kicker">NOUVEL ORDRE</span>
                            <h2>Constructions</h2>
                        </div>
                        <button type="button" class="close construction-runner-close" aria-label="Fermer">×</button>
                    </div>
                    <div class="construction-flow" aria-hidden="true">
                        <span>1 · Montants</span><span>2 · Destination</span><span>3 · Exécution</span>
                    </div>
                    <p class="help">Chaque ligne correspond à une exécution complète des actions 3 à 6. Les ressources sont exprimées en millions.</p>
                    <div class="construction-orders">
                        <div class="construction-orders-header">
                            <span>Ordres à exécuter</span>
                            <span class="construction-orders-counter">1 / 13</span>
                        </div>
                        <div class="construction-orders-list"></div>
                        <button type="button" class="construction-add-order">＋ Ajouter une ligne</button>
                    </div>
                    <div class="construction-calculation">1 exécution · Total réel : 0 · Petites voitures : 0</div>
                    <p class="field-help">Exemple : 3.3 M devient 3 300 000. Le total réel est ensuite divisé par 9000 et arrondi au supérieur.</p>
                    <div class="construction-runner-error" role="alert"></div>
                    <div class="actions">
                        <button type="button" class="save construction-runner-cancel">Annuler</button>
                        <button type="button" class="start construction-runner-start">Démarrer</button>
                    </div>
                </section>
                <section class="ghost-runner" role="dialog" aria-label="Configurer Ghost">
                    <div class="header">
                        <div>
                            <span class="ghost-kicker">NOUVEL HORAIRE</span>
                            <h2>Ghost</h2>
                        </div>
                        <button type="button" class="close ghost-runner-close" aria-label="Fermer">×</button>
                    </div>
                    <p class="help">Choisissez l’heure et la minute à conserver, puis démarrez Ghost.</p>
                    <div class="ghost-time-grid">
                        <div class="ghost-time-field">
                            <label for="ghost-hour">Heure</label>
                            <select id="ghost-hour" class="ghost-hour">${ghostHourOptions}</select>
                        </div>
                        <span class="ghost-time-separator" aria-hidden="true">:</span>
                        <div class="ghost-time-field">
                            <label for="ghost-minute">Minute</label>
                            <select id="ghost-minute" class="ghost-minute">${ghostMinuteOptions}</select>
                        </div>
                    </div>
                    <div class="ghost-time-preview">Horaire sélectionné : <span class="ghost-time-value">00:00</span></div>
                    <div class="actions">
                        <button type="button" class="save ghost-runner-cancel">Annuler</button>
                        <button type="button" class="start ghost-runner-confirm">Valider et démarrer</button>
                    </div>
                </section>
            </div>
        `;

        const refs = {
            quick1: shadow.querySelector('.quick-1'),
            quick2: shadow.querySelector('.quick-2'),
            quick3: shadow.querySelector('.quick-3'),
            quick4: shadow.querySelector('.quick-4'),
            quick5: shadow.querySelector('.quick-5'),
            quick6: shadow.querySelector('.quick-6'),
            quick7: shadow.querySelector('.quick-7'),
            quick8: shadow.querySelector('.quick-8'),
            quick9: shadow.querySelector('.quick-9'),
            quick10: shadow.querySelector('.quick-10'),
            simpleMenuToggle: shadow.querySelector('.simple-menu-toggle'),
            groupedMenuToggle: shadow.querySelector('.grouped-menu-toggle'),
            simpleMenu: shadow.querySelector('.simple-menu'),
            groupedMenu: shadow.querySelector('.grouped-menu'),
            debugProgress: shadow.querySelector('.debug-progress'),
            debugProgressContent: shadow.querySelector('.debug-progress-content'),
            debugProgressClose: shadow.querySelector('.debug-progress-close'),
            settings1: shadow.querySelector('.settings-1'),
            settings2: shadow.querySelector('.settings-2'),
            settings3: shadow.querySelector('.settings-3'),
            settings4: shadow.querySelector('.settings-4'),
            settings5: shadow.querySelector('.settings-5'),
            settings6: shadow.querySelector('.settings-6'),
            settings7: shadow.querySelector('.settings-7'),
            settings8: shadow.querySelector('.settings-8'),
            settings9: shadow.querySelector('.settings-9'),
            settings10: shadow.querySelector('.settings-10'),
            panel: shadow.querySelector('.panel'),
            panelTitle: shadow.querySelector('.panel-title'),
            help: shadow.querySelector('.help'),
            startUrlGroup: shadow.querySelector('.start-url-group'),
            startUrl: shadow.querySelector('.start-url'),
            smallVehicleGroup: shadow.querySelector('.small-vehicle-group'),
            smallVehicleCount: shadow.querySelector('.small-vehicle-count'),
            linksFieldGroup: shadow.querySelector('.links-field-group'),
            linksLabel: shadow.querySelector('.links-label'),
            namedLinksFieldGroup: shadow.querySelector('.named-links-field-group'),
            namedLinkNames: [...shadow.querySelectorAll('.named-link-name')],
            namedLinkUrls: [...shadow.querySelectorAll('.named-link-url')],
            namedLinksCounter: shadow.querySelector('.named-links-counter'),
            combinedConfig: shadow.querySelector('.combined-config'),
            combinedResources: shadow.querySelector('.combined-resources'),
            combinedExpeditions: shadow.querySelector('.combined-expeditions'),
            close: shadow.querySelector('.close'),
            textarea: shadow.querySelector('textarea'),
            limitLabel: shadow.querySelector('.limit-label'),
            counter: shadow.querySelector('.counter'),
            repeatRow: shadow.querySelector('.repeat-row'),
            repeat: shadow.querySelector('.repeat'),
            error: shadow.querySelector('.error'),
            status: shadow.querySelector('.status'),
            save: shadow.querySelector('.save'),
            start: shadow.querySelector('.start'),
            stop: shadow.querySelector('.stop'),
            constructionRunner: shadow.querySelector('.construction-runner'),
            constructionRunnerClose: shadow.querySelector('.construction-runner-close'),
            constructionRunnerCancel: shadow.querySelector('.construction-runner-cancel'),
            constructionRunnerStart: shadow.querySelector('.construction-runner-start'),
            constructionOrdersList: shadow.querySelector('.construction-orders-list'),
            constructionOrdersCounter: shadow.querySelector('.construction-orders-counter'),
            constructionAddOrder: shadow.querySelector('.construction-add-order'),
            constructionCalculation: shadow.querySelector('.construction-calculation'),
            constructionRunnerError: shadow.querySelector('.construction-runner-error'),
            ghostRunner: shadow.querySelector('.ghost-runner'),
            ghostRunnerClose: shadow.querySelector('.ghost-runner-close'),
            ghostRunnerCancel: shadow.querySelector('.ghost-runner-cancel'),
            ghostRunnerConfirm: shadow.querySelector('.ghost-runner-confirm'),
            ghostHour: shadow.querySelector('.ghost-hour'),
            ghostMinute: shadow.querySelector('.ghost-minute'),
            ghostTimeValue: shadow.querySelector('.ghost-time-value'),
        };

        let editingProfileId = 1;
        let combinedTargetProfiles = [1, 2];
        loadProfileIntoPanel(1);

        refs.settings1.addEventListener('click', () => togglePanel(1));
        refs.settings2.addEventListener('click', () => togglePanel(2));
        refs.settings3.addEventListener('click', () => togglePanel(3));
        refs.settings4.addEventListener('click', () => togglePanel(4));
        refs.settings5.addEventListener('click', () => togglePanel(5));
        refs.settings6.addEventListener('click', () => togglePanel(6));
        refs.settings7.addEventListener('click', () => togglePanel(7));
        refs.settings8.addEventListener('click', () => togglePanel(8));
        refs.settings9.addEventListener('click', () => togglePanel(9));
        refs.settings10.addEventListener('click', () => togglePanel(10));
        refs.combinedResources.addEventListener('click', () => open(combinedTargetProfiles[0]));
        refs.combinedExpeditions.addEventListener('click', () => open(combinedTargetProfiles[1]));
        refs.close.addEventListener('click', () => closePanel());
        refs.textarea.addEventListener('input', () => updateCounter());
        refs.namedLinkNames.forEach((input) => input.addEventListener('input', updateCounter));
        refs.namedLinkUrls.forEach((input) => input.addEventListener('input', updateCounter));
        refs.save.addEventListener('click', () => saveFromPanel(false));
        refs.start.addEventListener('click', () => saveFromPanel(true));
        refs.stop.addEventListener('click', () => {
            void stopAutomation('Arrêt demandé depuis le panneau.');
        });
        refs.quick1.addEventListener('click', () => quickAction(1));
        refs.quick2.addEventListener('click', () => quickAction(2));
        refs.quick3.addEventListener('click', () => quickCombinedAction());
        refs.quick4.addEventListener('click', () => quickAction(4));
        refs.quick5.addEventListener('click', () => quickExpeditionsLifeformAction());
        refs.quick6.addEventListener('click', () => quickAction(6));
        refs.quick7.addEventListener('click', () => quickAction(7));
        refs.quick8.addEventListener('click', quickGhostAction);
        refs.quick9.addEventListener('click', () => quickAction(9));
        refs.quick10.addEventListener('click', () => quickExpeditionV2LifeformAction());
        refs.constructionRunnerClose.addEventListener('click', closeConstructionRunner);
        refs.constructionRunnerCancel.addEventListener('click', closeConstructionRunner);
        refs.constructionRunnerStart.addEventListener('click', launchConstructionFromRunner);
        refs.constructionAddOrder.addEventListener('click', () => {
            const row = addConstructionOrderRow();
            row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        refs.ghostRunnerClose.addEventListener('click', closeGhostRunner);
        refs.ghostRunnerCancel.addEventListener('click', closeGhostRunner);
        refs.ghostRunnerConfirm.addEventListener('click', confirmGhostTime);
        refs.ghostHour.addEventListener('change', updateGhostTimePreview);
        refs.ghostMinute.addEventListener('change', updateGhostTimePreview);
        refs.debugProgressClose.addEventListener('click', () => {
            const run = getRunState();
            if (run.runId) {
                GM_setValue(DEBUG_DISMISSED_RUN_KEY, run.runId);
            }
            refs.debugProgress.style.display = 'none';
        });
        refs.simpleMenuToggle.addEventListener('click', () => toggleDropdown('simple'));
        refs.groupedMenuToggle.addEventListener('click', () => toggleDropdown('grouped'));
        shadow.querySelectorAll('.quick, .settings').forEach((button) => {
            button.addEventListener('click', closeDropdowns);
        });
        document.addEventListener('pointerdown', (event) => {
            if (!host.contains(event.target)) closeDropdowns();
        });

        document.documentElement.appendChild(host);
        uiHost = host;
        updateCounter();

        function quickAction(profileId) {
            const run = getRunState();
            if (run.status === 'running' && run.profileId === profileId && !run.combinedMode) {
                void stopAutomation(`Arrêt de ${getProfileLabel(profileId)} demandé avec le bouton flottant.`);
            } else {
                void startFromStoredConfiguration(profileId);
            }
        }

        function quickCombinedAction() {
            const run = getRunState();
            if (run.status === 'running' && run.combinedKind === 'resources-expeditions') {
                void stopAutomation('Arrêt de Ressources & Expéditions demandé avec le bouton flottant.');
            } else {
                void startCombinedAutomation();
            }
        }

        function quickExpeditionsLifeformAction() {
            const run = getRunState();
            if (run.status === 'running' && run.combinedKind === 'expeditions-lifeform') {
                void stopAutomation('Arrêt d’Expédition & Forme de vie demandé avec le bouton flottant.');
            } else {
                void startExpeditionsLifeformAutomation();
            }
        }

        function quickExpeditionV2LifeformAction() {
            const run = getRunState();
            if (run.status === 'running' && run.combinedKind === 'expedition-v2-lifeform') {
                void stopAutomation('Arrêt d’Expédition V2 & Forme de vie demandé avec le bouton flottant.');
            } else {
                void startExpeditionV2LifeformAutomation();
            }
        }

        function quickGhostAction() {
            const run = getRunState();
            if (run.status === 'running' && run.profileId === 8 && !run.combinedMode) {
                void stopAutomation('Arrêt de Ghost demandé avec le bouton flottant.');
            } else {
                openGhostRunner();
            }
        }

        function toggleDropdown(menuName) {
            const opensSimple = menuName === 'simple' && !refs.simpleMenu.classList.contains('open');
            const opensGrouped = menuName === 'grouped' && !refs.groupedMenu.classList.contains('open');
            closeDropdowns();
            if (opensSimple || opensGrouped) {
                closePanel();
                closeConstructionRunner();
                closeGhostRunner();
            }
            if (opensSimple) {
                refs.simpleMenu.classList.add('open');
                refs.simpleMenuToggle.classList.add('open');
                refs.simpleMenuToggle.setAttribute('aria-expanded', 'true');
            }
            if (opensGrouped) {
                refs.groupedMenu.classList.add('open');
                refs.groupedMenuToggle.classList.add('open');
                refs.groupedMenuToggle.setAttribute('aria-expanded', 'true');
            }
        }

        function closeDropdowns() {
            refs.simpleMenu.classList.remove('open');
            refs.groupedMenu.classList.remove('open');
            refs.simpleMenuToggle.classList.remove('open');
            refs.groupedMenuToggle.classList.remove('open');
            refs.simpleMenuToggle.setAttribute('aria-expanded', 'false');
            refs.groupedMenuToggle.setAttribute('aria-expanded', 'false');
        }

        function togglePanel(profileId) {
            if (refs.panel.classList.contains('open') && editingProfileId === profileId) {
                closePanel();
                return;
            }
            open(profileId);
        }

        function open(profileId = 1) {
            closeConstructionRunner();
            closeGhostRunner();
            loadProfileIntoPanel(profileId);
            refs.panel.classList.add('open');
            refresh();
        }

        function closePanel() {
            refs.panel.classList.remove('open');
        }

        function openGhostRunner() {
            const config = getStoredConfig(8);
            if (config.links.length !== 1) {
                open(8);
                showError('Configurez l’URL unique de Ghost avant de choisir l’heure.');
                return;
            }

            const storedTime = getStoredGhostTime();
            closeDropdowns();
            closePanel();
            closeConstructionRunner();
            refs.ghostHour.value = storedTime.hour;
            refs.ghostMinute.value = storedTime.minute;
            updateGhostTimePreview();
            refs.ghostRunner.classList.add('open');
        }

        function closeGhostRunner() {
            refs.ghostRunner.classList.remove('open');
        }

        function updateGhostTimePreview() {
            refs.ghostTimeValue.textContent = `${refs.ghostHour.value}:${refs.ghostMinute.value}`;
        }

        function confirmGhostTime() {
            const time = `${refs.ghostHour.value}:${refs.ghostMinute.value}`;
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
            GM_setValue(GHOST_TIME_KEY, time);
            closeGhostRunner();
            void startGhostAutomation(time);
        }

        function getStoredGhostTime() {
            const stored = String(GM_getValue(GHOST_TIME_KEY, '00:00'));
            const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(stored);
            return match
                ? { hour: match[1], minute: match[2] }
                : { hour: '00', minute: '00' };
        }

        function openConstructionRunner() {
            const config = getStoredConfig(7);
            if (config.namedLinks.length === 0) {
                open(7);
                showError('Configurez au moins une destination nommée avant de lancer Constructions.');
                return;
            }

            closeDropdowns();
            closePanel();
            closeGhostRunner();
            refs.constructionOrdersList.replaceChildren();
            addConstructionOrderRow();
            showConstructionRunnerError('');
            updateConstructionCalculation();
            refs.constructionRunner.classList.add('open');
        }

        function closeConstructionRunner() {
            refs.constructionRunner.classList.remove('open');
            showConstructionRunnerError('');
        }

        function showConstructionRunnerError(message) {
            refs.constructionRunnerError.textContent = message;
            refs.constructionRunnerError.classList.toggle('visible', Boolean(message));
        }

        function getConstructionOrderRows() {
            return [...refs.constructionOrdersList.querySelectorAll('.construction-order-row')];
        }

        function addConstructionOrderRow(initialValues = {}) {
            const rows = getConstructionOrderRows();
            if (rows.length >= MAX_CONSTRUCTION_ORDERS) return null;

            const row = document.createElement('article');
            row.className = 'construction-order-row';
            row.innerHTML = `
                <div class="construction-order-header">
                    <span class="construction-order-title"></span>
                    <span class="construction-order-summary">Total : 0 · Petites voitures : 0</span>
                    <button type="button" class="construction-order-remove" title="Supprimer cette ligne" aria-label="Supprimer cette ligne">×</button>
                </div>
                <div class="construction-order-grid">
                    <div class="construction-order-field">
                        <label>R1</label>
                        <div class="amount-input-shell">
                            <input class="construction-order-r1" type="text" inputmode="decimal" autocomplete="off" placeholder="3.3">
                            <span>M</span>
                        </div>
                    </div>
                    <div class="construction-order-field">
                        <label>R2</label>
                        <div class="amount-input-shell">
                            <input class="construction-order-r2" type="text" inputmode="decimal" autocomplete="off" placeholder="2.0">
                            <span>M</span>
                        </div>
                    </div>
                    <div class="construction-order-field">
                        <label>R3</label>
                        <div class="amount-input-shell">
                            <input class="construction-order-r3" type="text" inputmode="decimal" autocomplete="off" placeholder="1">
                            <span>M</span>
                        </div>
                    </div>
                    <div class="construction-order-field destination">
                        <label>Destination</label>
                        <select class="construction-order-destination"></select>
                    </div>
                </div>
            `;

            const amountInputs = [
                row.querySelector('.construction-order-r1'),
                row.querySelector('.construction-order-r2'),
                row.querySelector('.construction-order-r3'),
            ];
            const initialAmounts = [initialValues.r1, initialValues.r2, initialValues.r3];
            amountInputs.forEach((input, index) => {
                input.value = String(initialAmounts[index] ?? '0');
                input.addEventListener('input', updateConstructionCalculation);
                input.addEventListener('focus', () => {
                    if (input.value.trim() === '0') {
                        input.value = '';
                        updateConstructionCalculation();
                    }
                });
                input.addEventListener('blur', () => {
                    if (input.value.trim() === '') {
                        input.value = '0';
                        updateConstructionCalculation();
                    }
                });
            });

            const destinationSelect = row.querySelector('.construction-order-destination');
            const config = getStoredConfig(7);
            for (const [index, entry] of config.namedLinks.entries()) {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = entry.name;
                destinationSelect.appendChild(option);
            }
            const initialLinkIndex = Number(initialValues.selectedLinkIndex);
            if (Number.isInteger(initialLinkIndex) && config.namedLinks[initialLinkIndex]) {
                destinationSelect.value = String(initialLinkIndex);
            }
            destinationSelect.addEventListener('change', updateConstructionCalculation);

            row.querySelector('.construction-order-remove').addEventListener('click', () => {
                if (getConstructionOrderRows().length <= 1) return;
                row.remove();
                updateConstructionCalculation();
            });

            refs.constructionOrdersList.appendChild(row);
            updateConstructionCalculation();
            return row;
        }

        function updateConstructionCalculation() {
            const rows = getConstructionOrderRows();
            let cumulativeTotal = 0;
            let cumulativeTransporters = 0;
            let allRowsAreValid = rows.length > 0;

            rows.forEach((row, index) => {
                row.querySelector('.construction-order-title').textContent = `Ligne ${index + 1}`;
                const inputs = [
                    row.querySelector('.construction-order-r1'),
                    row.querySelector('.construction-order-r2'),
                    row.querySelector('.construction-order-r3'),
                ];
                inputs.forEach((input, inputIndex) => {
                    input.setAttribute('aria-label', `R${inputIndex + 1} de la ligne ${index + 1}`);
                });
                row.querySelector('.construction-order-destination')
                    .setAttribute('aria-label', `Destination de la ligne ${index + 1}`);

                const values = inputs.map((input) => parseConstructionMillions(input.value));
                const summary = row.querySelector('.construction-order-summary');
                if (values.some((value) => value === null)) {
                    allRowsAreValid = false;
                    summary.textContent = 'Montant à compléter';
                } else {
                    const total = values.reduce((sum, value) => sum + value, 0);
                    const transporterCount = Math.ceil(total / 9000);
                    if (!Number.isSafeInteger(total)) {
                        allRowsAreValid = false;
                        summary.textContent = 'Total trop élevé';
                    } else {
                        cumulativeTotal += total;
                        cumulativeTransporters += transporterCount;
                        summary.textContent =
                            `Total : ${formatInteger(total)} · Petites voitures : ${formatInteger(transporterCount)}`;
                    }
                }
            });

            const rowCount = rows.length;
            refs.constructionOrdersCounter.textContent = `${rowCount} / ${MAX_CONSTRUCTION_ORDERS}`;
            refs.constructionAddOrder.disabled = rowCount >= MAX_CONSTRUCTION_ORDERS;
            refs.constructionAddOrder.textContent = rowCount >= MAX_CONSTRUCTION_ORDERS
                ? `Maximum de ${MAX_CONSTRUCTION_ORDERS} lignes atteint`
                : '＋ Ajouter une ligne';
            rows.forEach((row) => {
                row.querySelector('.construction-order-remove').disabled = rowCount <= 1;
            });

            refs.constructionCalculation.textContent = allRowsAreValid
                ? `${rowCount} exécution${rowCount > 1 ? 's' : ''} · ` +
                    `Total réel cumulé : ${formatInteger(cumulativeTotal)} · ` +
                    `Petites voitures cumulées : ${formatInteger(cumulativeTransporters)}`
                : 'Corrigez les montants indiqués avant de démarrer.';
        }

        function launchConstructionFromRunner() {
            const config = getStoredConfig(7);
            const rows = getConstructionOrderRows();
            const orders = [];
            for (const [index, row] of rows.entries()) {
                const amounts = [
                    row.querySelector('.construction-order-r1'),
                    row.querySelector('.construction-order-r2'),
                    row.querySelector('.construction-order-r3'),
                ].map((input) => parseConstructionMillions(input.value));
                if (amounts.some((value) => value === null)) {
                    showConstructionRunnerError(
                        `Ligne ${index + 1} : R1, R2 et R3 doivent être des montants positifs ou nuls en millions.`
                    );
                    return;
                }

                const selectedLinkIndex = Number(
                    row.querySelector('.construction-order-destination').value
                );
                if (!Number.isInteger(selectedLinkIndex) || !config.namedLinks[selectedLinkIndex]) {
                    showConstructionRunnerError(`Ligne ${index + 1} : choisissez une destination valide.`);
                    return;
                }
                orders.push({
                    r1: amounts[0],
                    r2: amounts[1],
                    r3: amounts[2],
                    selectedLinkIndex,
                });
            }

            showConstructionRunnerError('');
            closeConstructionRunner();
            void startConstructionAutomation({ orders });
        }

        function loadProfileIntoPanel(profileId) {
            editingProfileId = normalizeEditorProfileId(profileId);

            if ([3, 5, 10].includes(editingProfileId)) {
                const combinedDetails = editingProfileId === 3
                    ? {
                        targets: [1, 2],
                        title: 'Configuration — Ressources & Expéditions',
                        help: 'Le mode combiné exécute Ressources une fois, puis démarre automatiquement Expéditions avec leurs réglages respectifs.',
                        startLabel: 'Lancer Ressources & Expéditions',
                    }
                    : editingProfileId === 5
                      ? {
                          targets: [2, 4],
                          title: 'Configuration — Expédition & Forme de vie',
                          help: 'Le mode combiné exécute Expéditions, puis démarre automatiquement Forme de vie avec leurs réglages respectifs.',
                          startLabel: 'Lancer Expédition & Forme de vie',
                      }
                      : {
                          targets: [9, 4],
                          title: 'Configuration — Expédition V2 & Forme de vie',
                          help: 'Le mode combiné exécute Expédition V2 jusqu’au message d’arrêt, puis démarre automatiquement Forme de vie.',
                          startLabel: 'Lancer Expédition V2 & Forme de vie',
                      };
                combinedTargetProfiles = combinedDetails.targets;
                const firstConfig = getStoredConfig(combinedTargetProfiles[0]);
                const secondConfig = getStoredConfig(combinedTargetProfiles[1]);
                refs.panelTitle.textContent = combinedDetails.title;
                refs.help.textContent = combinedDetails.help;
                refs.startUrlGroup.style.display = 'none';
                refs.smallVehicleGroup.style.display = 'none';
                refs.linksFieldGroup.style.display = 'none';
                refs.namedLinksFieldGroup.style.display = 'none';
                refs.repeatRow.style.display = 'none';
                refs.combinedConfig.style.display = 'grid';
                refs.save.style.display = 'none';
                refs.combinedResources.textContent =
                    `Configurer ${getProfileLabel(combinedTargetProfiles[0])}`;
                refs.combinedExpeditions.textContent =
                    `Configurer ${getProfileLabel(combinedTargetProfiles[1])}`;
                refs.start.textContent = combinedDetails.startLabel;
                refs.status.textContent =
                    `${getProfileLabel(combinedTargetProfiles[0])} : ${firstConfig.links.length} lien(s) · ` +
                    `${getProfileLabel(combinedTargetProfiles[1])} : ${secondConfig.links.length} lien(s).`;
                showError('');
                return;
            }

            const config = getStoredConfig(editingProfileId);
            const links =
                config.links.length > 0
                    ? config.links
                    : editingProfileId === 1
                      ? getLegacyLinks()
                      : [];

            refs.panelTitle.textContent = `Configuration — ${getProfileLabel(editingProfileId)}`;
            refs.help.textContent =
                editingProfileId === 2
                    ? 'Le lien de départ est chargé une fois, puis un lien est choisi aléatoirement et rechargé avant chaque boucle.'
                    : editingProfileId === 4
                      ? 'Jusqu’à 14 URL. Une URL et une direction sont choisies aléatoirement une seule fois au lancement.'
                      : editingProfileId === 6
                        ? 'Une URL unique. Import clique sur le maximum, sur Payer, puis récupère l’objet.'
                      : editingProfileId === 7
                          ? 'Jusqu’à 13 destinations. Chaque URL possède un nom affiché dans la fenêtre de lancement.'
                          : editingProfileId === 8
                            ? 'Une URL unique pour Ghost. Elle reste enregistrée dans le stockage privé de Tampermonkey.'
                          : editingProfileId === 9
                            ? 'Une URL unique. Expédition V2 choisit une direction et 0 à 6 déplacements, sélectionne EXPE, puis lance les expéditions jusqu’au message d’arrêt.'
                    : 'Un lien par ligne. Les adresses sont conservées dans le stockage privé de Tampermonkey, jamais dans le code du script.';
            refs.startUrlGroup.style.display = editingProfileId === 2 ? 'block' : 'none';
            refs.startUrl.value = editingProfileId === 2 ? config.startUrl : '';
            refs.smallVehicleGroup.style.display = editingProfileId === 2 ? 'block' : 'none';
            refs.smallVehicleCount.value =
                editingProfileId === 2 ? String(config.smallVehicleCount) : '6400';
            refs.linksFieldGroup.style.display = editingProfileId === 7 ? 'none' : 'block';
            refs.namedLinksFieldGroup.style.display = editingProfileId === 7 ? 'block' : 'none';
            refs.combinedConfig.style.display = 'none';
            const usesSingleUrl = [6, 8, 9].includes(editingProfileId);
            refs.linksLabel.textContent = usesSingleUrl ? 'URL à ouvrir' : 'Liens à traiter';
            refs.textarea.value = links.join('\n');
            refs.textarea.placeholder = usesSingleUrl ? 'https://…' : 'Lien 1\nLien 2\n…';
            refs.textarea.style.minHeight = usesSingleUrl ? '58px' : '';
            refs.namedLinkNames.forEach((input, index) => {
                input.value = editingProfileId === 7 ? config.namedLinks[index]?.name || '' : '';
            });
            refs.namedLinkUrls.forEach((input, index) => {
                input.value = editingProfileId === 7 ? config.namedLinks[index]?.url || '' : '';
            });
            refs.repeat.checked = config.repeat;
            refs.repeatRow.style.display = editingProfileId === 1 ? 'flex' : 'none';
            refs.save.style.display = '';
            refs.start.textContent = editingProfileId === 8
                ? 'Enregistrer et choisir l’heure'
                : 'Enregistrer et lancer';
            showError('');
            updateCounter();
        }

        function updateCounter() {
            if ([3, 5, 10].includes(editingProfileId)) return;
            if (editingProfileId === 7) {
                const count = refs.namedLinkNames.reduce((total, input, index) => {
                    return total + (input.value.trim() || refs.namedLinkUrls[index].value.trim() ? 1 : 0);
                }, 0);
                refs.namedLinksCounter.textContent = `${count} / 13`;
                refs.namedLinksCounter.style.color = count > 13 ? '#fecaca' : '#94a3b8';
                return;
            }
            const count = refs.textarea.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
            const maximum = getProfileLinkLimit(editingProfileId);
            refs.limitLabel.textContent = `Minimum 1, maximum ${maximum}`;
            refs.counter.textContent = `${count} / ${maximum}`;
            refs.counter.style.color = count > maximum ? '#fecaca' : '#94a3b8';
        }

        function showError(message) {
            refs.error.textContent = message;
            refs.error.classList.toggle('visible', Boolean(message));
        }

        function saveFromPanel(shouldStart) {
            if ([3, 5, 10].includes(editingProfileId)) {
                showError('');
                if (shouldStart) {
                    if (editingProfileId === 3) {
                        void startCombinedAutomation();
                    } else if (editingProfileId === 5) {
                        void startExpeditionsLifeformAutomation();
                    } else {
                        void startExpeditionV2LifeformAutomation();
                    }
                }
                return;
            }

            if (editingProfileId === 7) {
                const parsedNamedLinks = parseNamedLinks(
                    refs.namedLinkNames.map((input, index) => ({
                        name: input.value,
                        url: refs.namedLinkUrls[index].value,
                    }))
                );
                if (parsedNamedLinks.error) {
                    showError(parsedNamedLinks.error);
                    return;
                }

                showError('');
                saveConfig(7, { namedLinks: parsedNamedLinks.namedLinks });
                refs.status.textContent =
                    `Constructions : ${parsedNamedLinks.namedLinks.length} destination(s) enregistrée(s) dans Tampermonkey.`;
                if (shouldStart) openConstructionRunner();
                return;
            }

            const parsed = parseLinks(refs.textarea.value, getProfileLinkLimit(editingProfileId));
            if (parsed.error) {
                showError(parsed.error);
                return;
            }

            const startUrl = editingProfileId === 2 ? validateHttpUrl(refs.startUrl.value) : '';
            if (editingProfileId === 2 && !startUrl) {
                showError('Ajoutez un lien de départ valide commençant par http:// ou https://.');
                refs.startUrl.focus();
                return;
            }

            const smallVehicleCount =
                editingProfileId === 2
                    ? parseSmallVehicleCount(refs.smallVehicleCount.value)
                    : 6400;
            if (editingProfileId === 2 && smallVehicleCount === null) {
                showError('Le nombre de petites voitures doit être un nombre entier positif ou nul.');
                refs.smallVehicleCount.focus();
                return;
            }

            showError('');
            saveConfig(editingProfileId, {
                links: parsed.links,
                repeat: editingProfileId === 1 && refs.repeat.checked,
                startUrl,
                smallVehicleCount,
            });
            refs.status.textContent =
                `${getProfileLabel(editingProfileId)} : ${parsed.links.length} lien(s) enregistré(s) dans Tampermonkey.`;

            if (shouldStart) {
                if (editingProfileId === 4) {
                    void startLifeformAutomation();
                } else if (editingProfileId === 6) {
                    void startImportAutomation();
                } else if (editingProfileId === 8) {
                    openGhostRunner();
                } else if (editingProfileId === 9) {
                    void startExpeditionV2Automation();
                } else {
                    void startAutomation(editingProfileId, parsed.links);
                }
            }
        }

        function refresh() {
            const run = getRunState();
            const isCombinedPanel = [3, 5, 10].includes(editingProfileId);
            const config = isCombinedPanel ? null : getStoredConfig(editingProfileId);
            const resourcesExpeditionsRunning =
                run.status === 'running' && run.combinedKind === 'resources-expeditions';
            const expeditionsLifeformRunning =
                run.status === 'running' && run.combinedKind === 'expeditions-lifeform';
            const expeditionV2LifeformRunning =
                run.status === 'running' && run.combinedKind === 'expedition-v2-lifeform';
            const profile1Running =
                run.status === 'running' && run.profileId === 1 && !run.combinedMode;
            const profile2Running =
                run.status === 'running' && run.profileId === 2 && !run.combinedMode;
            const profile4Running =
                run.status === 'running' && run.profileId === 4 && !run.combinedMode;
            const profile6Running =
                run.status === 'running' && run.profileId === 6 && !run.combinedMode;
            const profile7Running =
                run.status === 'running' && run.profileId === 7 && !run.combinedMode;
            const profile8Running =
                run.status === 'running' && run.profileId === 8 && !run.combinedMode;
            const profile9Running =
                run.status === 'running' && run.profileId === 9 && !run.combinedMode;
            const simpleActionRunning =
                profile1Running || profile2Running || profile4Running || profile6Running ||
                profile7Running || profile8Running || profile9Running;
            const groupedActionRunning =
                resourcesExpeditionsRunning || expeditionsLifeformRunning || expeditionV2LifeformRunning;

            refs.quick1.classList.toggle('running', profile1Running);
            refs.quick2.classList.toggle('running', profile2Running);
            refs.quick3.classList.toggle('running', resourcesExpeditionsRunning);
            refs.quick4.classList.toggle('running', profile4Running);
            refs.quick5.classList.toggle('running', expeditionsLifeformRunning);
            refs.quick6.classList.toggle('running', profile6Running);
            refs.quick7.classList.toggle('running', profile7Running);
            refs.quick8.classList.toggle('running', profile8Running);
            refs.quick9.classList.toggle('running', profile9Running);
            refs.quick10.classList.toggle('running', expeditionV2LifeformRunning);
            refs.simpleMenuToggle.classList.toggle('running', simpleActionRunning);
            refs.groupedMenuToggle.classList.toggle('running', groupedActionRunning);
            refs.quick1.textContent = profile1Running ? '■ Arrêter' : 'Ressources';
            refs.quick2.textContent = profile2Running ? '■ Arrêter' : 'Expéditions';
            refs.quick3.textContent = resourcesExpeditionsRunning ? '■ Arrêter le combiné' : 'Ressources & Expéditions';
            refs.quick4.textContent = profile4Running ? '■ Arrêter' : 'Forme de vie';
            refs.quick5.textContent = expeditionsLifeformRunning
                ? '■ Arrêter le combiné'
                : 'Expédition & Forme de vie';
            refs.quick6.textContent = profile6Running ? '■ Arrêter' : 'Import';
            refs.quick7.textContent = profile7Running ? '■ Arrêter' : 'Constructions';
            refs.quick8.textContent = profile8Running ? '■ Arrêter' : 'Ghost';
            refs.quick9.textContent = profile9Running ? '■ Arrêter' : 'Expédition V2';
            refs.quick10.textContent = expeditionV2LifeformRunning
                ? '■ Arrêter le combiné'
                : 'Expédition V2 & Forme de vie';
            refs.quick1.title = profile1Running ? 'Arrêter Ressources' : 'Lancer Ressources';
            refs.quick2.title = profile2Running ? 'Arrêter Expéditions' : 'Lancer Expéditions';
            refs.quick3.title = resourcesExpeditionsRunning
                ? 'Arrêter Ressources & Expéditions'
                : 'Lancer Ressources puis Expéditions';
            refs.quick4.title = profile4Running ? 'Arrêter Forme de vie' : 'Lancer Forme de vie';
            refs.quick5.title = expeditionsLifeformRunning
                ? 'Arrêter Expédition & Forme de vie'
                : 'Lancer Expédition puis Forme de vie';
            refs.quick6.title = profile6Running ? 'Arrêter Import' : 'Lancer Import';
            refs.quick7.title = profile7Running ? 'Arrêter Constructions' : 'Lancer Constructions';
            refs.quick8.title = profile8Running ? 'Arrêter Ghost' : 'Lancer Ghost';
            refs.quick9.title = profile9Running ? 'Arrêter Expédition V2' : 'Lancer Expédition V2';
            refs.quick10.title = expeditionV2LifeformRunning
                ? 'Arrêter Expédition V2 & Forme de vie'
                : 'Lancer Expédition V2 puis Forme de vie';

            const debugText = formatDebugProgress(run);
            const debugWasDismissed =
                Boolean(run.runId) && GM_getValue(DEBUG_DISMISSED_RUN_KEY, '') === run.runId;
            refs.debugProgressContent.textContent = debugText;
            refs.debugProgress.style.display = debugText && !debugWasDismissed ? 'grid' : 'none';
            refs.debugProgress.classList.toggle('running', run.status === 'running');
            refs.debugProgress.classList.toggle('completed', run.status === 'completed');
            refs.debugProgress.classList.toggle(
                'error',
                run.status === 'error' || run.status === 'needs-actions'
            );

            if (run.message) {
                refs.status.textContent = run.message;
            } else if (isCombinedPanel) {
                const targets = editingProfileId === 3
                    ? [1, 2]
                    : editingProfileId === 5
                      ? [2, 4]
                      : [9, 4];
                const firstConfig = getStoredConfig(targets[0]);
                const secondConfig = getStoredConfig(targets[1]);
                refs.status.textContent =
                    `${getProfileLabel(targets[0])} : ${firstConfig.links.length} lien(s) · ` +
                    `${getProfileLabel(targets[1])} : ${secondConfig.links.length} lien(s).`;
            } else if (config.links.length > 0) {
                refs.status.textContent =
                    `${getProfileLabel(editingProfileId)} : ${config.links.length} lien(s) prêt(s).`;
            } else {
                refs.status.textContent =
                    `${getProfileLabel(editingProfileId)} : configurez les liens.`;
            }
        }

        return {
            open,
            openConstructionRunner,
            openGhostRunner,
            refresh,
            showError,
            showConstructionError: showConstructionRunnerError,
            isMounted: () => host.isConnected && document.documentElement.contains(host),
        };
    }

    async function startFromStoredConfiguration(profileId = 1) {
        const normalizedProfileId = normalizeProfileId(profileId);
        const config = getStoredConfig(normalizedProfileId);
        if (config.links.length === 0) {
            const ui = await ensureUi();
            ui.open(normalizedProfileId);
            ui.showError(
                `Enregistrez au moins un lien pour ${getProfileLabel(normalizedProfileId)} avant de lancer.`
            );
            ui.refresh();
            return;
        }

        if (normalizedProfileId === 2 && !config.startUrl) {
            const ui = await ensureUi();
            ui.open(2);
            ui.showError('Configurez le lien de départ d’Expéditions avant de lancer.');
            ui.refresh();
            return;
        }

        if (normalizedProfileId === 4) {
            await startLifeformAutomation();
            return;
        }
        if (normalizedProfileId === 6) {
            await startImportAutomation();
            return;
        }
        if (normalizedProfileId === 7) {
            const ui = await ensureUi();
            ui.openConstructionRunner();
            return;
        }
        if (normalizedProfileId === 8) {
            const ui = await ensureUi();
            ui.openGhostRunner();
            return;
        }
        if (normalizedProfileId === 9) {
            await startExpeditionV2Automation();
            return;
        }

        await startAutomation(normalizedProfileId, config.links);
    }

    async function startCombinedAutomation() {
        const resourcesConfig = getStoredConfig(1);
        const expeditionsConfig = getStoredConfig(2);
        const errors = [];

        if (resourcesConfig.links.length === 0) {
            errors.push('Ajoutez au moins un lien dans Ressources.');
        }
        if (expeditionsConfig.links.length === 0) {
            errors.push('Ajoutez au moins un lien dans Expéditions.');
        }
        if (!expeditionsConfig.startUrl) {
            errors.push('Ajoutez le lien de départ dans Expéditions.');
        }

        if (errors.length > 0) {
            const ui = await ensureUi();
            ui.open(3);
            ui.showError(errors.join(' '));
            ui.refresh();
            return;
        }

        await startAutomation(1, resourcesConfig.links, {
            combinedMode: true,
            combinedKind: 'resources-expeditions',
            nextProfileId: 2,
        });
    }

    async function startExpeditionsLifeformAutomation() {
        const expeditionsConfig = getStoredConfig(2);
        const lifeformConfig = getStoredConfig(4);
        const errors = [];

        if (expeditionsConfig.links.length === 0) {
            errors.push('Ajoutez au moins un lien dans Expéditions.');
        }
        if (!expeditionsConfig.startUrl) {
            errors.push('Ajoutez le lien de départ dans Expéditions.');
        }
        if (lifeformConfig.links.length === 0) {
            errors.push('Ajoutez au moins une URL dans Forme de vie.');
        }

        if (errors.length > 0) {
            const ui = await ensureUi();
            ui.open(5);
            ui.showError(errors.join(' '));
            ui.refresh();
            return;
        }

        await startAutomation(2, expeditionsConfig.links, {
            combinedMode: true,
            combinedKind: 'expeditions-lifeform',
            nextProfileId: 4,
        });
    }

    async function startExpeditionV2LifeformAutomation() {
        const expeditionV2Config = getStoredConfig(9);
        const lifeformConfig = getStoredConfig(4);
        const errors = [];

        if (expeditionV2Config.links.length !== 1) {
            errors.push('Ajoutez l’URL unique dans Expédition V2.');
        }
        if (lifeformConfig.links.length === 0) {
            errors.push('Ajoutez au moins une URL dans Forme de vie.');
        }

        if (errors.length > 0) {
            const ui = await ensureUi();
            ui.open(10);
            ui.showError(errors.join(' '));
            ui.refresh();
            return;
        }

        await startExpeditionV2Automation({
            combinedMode: true,
            combinedKind: 'expedition-v2-lifeform',
            nextProfileId: 4,
        });
    }

    async function startAutomation(profileId, links, options = {}) {
        const normalizedProfileId = normalizeProfileId(profileId);
        const config = getStoredConfig(normalizedProfileId);
        const initialLinkIndex =
            normalizedProfileId === 2 ? getSecureRandomIndex(links.length) : 0;
        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: normalizedProfileId,
            status: 'running',
            combinedMode: Boolean(options.combinedMode),
            combinedKind: typeof options.combinedKind === 'string' ? options.combinedKind : '',
            nextProfileId:
                Number(options.nextProfileId) === 2 || Number(options.nextProfileId) === 4
                    ? Number(options.nextProfileId)
                    : null,
            phase: normalizedProfileId === 2 ? 'open-start-page' : 'open-link',
            currentLinkIndex: initialLinkIndex,
            nextStepIndex: 0,
            cycleNumber: 1,
            targetExecutions: null,
            skippedCount: 0,
            startedAt: now,
            updatedAt: now,
            message:
                normalizedProfileId === 2
                    ? 'Expéditions — ouverture du lien de départ…'
                    : `Ressources — ouverture du lien 1 sur ${links.length}…`,
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        navigateToUrl(
            normalizedProfileId === 2 ? config.startUrl : links[initialLinkIndex],
            true
        );
    }

    async function startLifeformAutomation(options = {}) {
        const config = getStoredConfig(4);
        if (config.links.length === 0) {
            const ui = await ensureUi();
            ui.open(4);
            ui.showError('Ajoutez au moins une URL dans Forme de vie avant de lancer.');
            ui.refresh();
            return;
        }

        const currentLinkIndex = getSecureRandomIndex(config.links.length);
        const directionKeys = Object.keys(LIFEFORM_DIRECTIONS);
        const lifeformDirection = directionKeys[getSecureRandomIndex(directionKeys.length)];
        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: 4,
            status: 'running',
            combinedMode: Boolean(options.combinedMode),
            combinedKind: typeof options.combinedKind === 'string' ? options.combinedKind : '',
            nextProfileId: null,
            phase: 'lifeform-open-link',
            currentLinkIndex,
            lifeformDirection,
            lifeformLoopNumber: 1,
            lifeformPendingDelayMs: 0,
            lifeformPendingDelayLabel: '',
            startedAt: now,
            updatedAt: now,
            message:
                `Forme de vie — ouverture de l’URL ${currentLinkIndex + 1}/${config.links.length} ` +
                `et direction ${lifeformDirection === 'next' ? 'suivante' : 'précédente'} conservée…`,
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        navigateToUrl(config.links[currentLinkIndex], true);
    }

    async function resumeLifeformAutomation(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run || run.profileId !== 4) return;

            const config = getStoredConfig(4);
            const selectedUrl = config.links[run.currentLinkIndex];
            if (!selectedUrl) {
                throw new Error('L’URL Forme de vie choisie n’existe plus dans la configuration.');
            }
            if (!LIFEFORM_DIRECTIONS[run.lifeformDirection]) {
                throw new Error('La direction Forme de vie enregistrée est invalide.');
            }

            if (run.phase === 'lifeform-open-link') {
                if (!isConfiguredPage(selectedUrl, window.location.href)) {
                    navigateToUrl(selectedUrl, false);
                    return;
                }

                const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                if (renderResult.timedOut) {
                    throw new Error('L’URL Forme de vie ne s’est pas chargée à temps.');
                }
                if (!getActiveRun(runId)) return;

                updateRun(runId, {
                    phase: 'lifeform-discover',
                    lifeformPendingDelayMs: getRandomDelayMs(
                        LIFEFORM_DELAY_MIN_MS,
                        LIFEFORM_DELAY_MAX_MS
                    ),
                    lifeformPendingDelayLabel: 'le chargement de l’URL',
                    message: 'Forme de vie — URL chargée, préparation de la découverte…',
                });
            } else {
                const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                if (renderResult.timedOut) {
                    throw new Error('La page Forme de vie ne s’est pas stabilisée à temps.');
                }
            }

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;

                if (Number(run.lifeformPendingDelayMs) > 0) {
                    const canContinue = await consumeLifeformDelay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.phase === 'lifeform-discover') {
                    updateRun(runId, {
                        message:
                            `Forme de vie — boucle ${run.lifeformLoopNumber} — ` +
                            'action 2/4 : cliquer sur Découverte…',
                    });
                    refreshUi();
                    const discoverButton = await waitForElement(LIFEFORM_DISCOVER_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'lifeform-direction',
                        lifeformPendingDelayMs: getRandomDelayMs(
                            LIFEFORM_DELAY_MIN_MS,
                            LIFEFORM_DELAY_MAX_MS
                        ),
                        lifeformPendingDelayLabel: 'l’action Découverte',
                    });
                    discoverButton.click();
                    continue;
                }

                if (run.phase === 'lifeform-direction') {
                    const directionSelector = LIFEFORM_DIRECTIONS[run.lifeformDirection];
                    const directionLabel = run.lifeformDirection === 'next' ? 'suivante' : 'précédente';
                    updateRun(runId, {
                        message:
                            `Forme de vie — boucle ${run.lifeformLoopNumber} — ` +
                            `action 3/4 : direction ${directionLabel} conservée…`,
                    });
                    refreshUi();
                    const directionButton = await waitForElement(directionSelector, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'lifeform-read-slots',
                        lifeformPendingDelayMs: getRandomDelayMs(
                            LIFEFORM_DELAY_MIN_MS,
                            LIFEFORM_DELAY_MAX_MS
                        ),
                        lifeformPendingDelayLabel: `le clic direction ${directionLabel}`,
                    });
                    directionButton.click();
                    await delay(0);
                    if (!getActiveRun(runId)) return;
                    continue;
                }

                if (run.phase === 'lifeform-read-slots') {
                    updateRun(runId, {
                        message:
                            `Forme de vie — boucle ${run.lifeformLoopNumber} — ` +
                            'action 4/4 : lecture des slots…',
                    });
                    refreshUi();
                    const slots = await readLifeformSlots(ELEMENT_TIMEOUT_MS);
                    if (!getActiveRun(runId)) return;

                    if (slots.used === slots.maximum) {
                        const completedRun = getActiveRun(runId);
                        if (!completedRun) return;
                        GM_setValue(RUN_KEY, {
                            ...completedRun,
                            status: 'completed',
                            updatedAt: Date.now(),
                            message:
                                `Forme de vie terminée après ${completedRun.lifeformLoopNumber} boucle(s) : ` +
                                `${slots.used}/${slots.maximum} slots utilisés.`,
                        });
                        await clearThisTabRunId(runId);
                        refreshUi();
                        return;
                    }

                    updateRun(runId, {
                        phase: 'lifeform-discover',
                        lifeformLoopNumber: run.lifeformLoopNumber + 1,
                        lifeformPendingDelayMs: getRandomDelayMs(
                            LIFEFORM_DELAY_MIN_MS,
                            LIFEFORM_DELAY_MAX_MS
                        ),
                        lifeformPendingDelayLabel: 'la lecture des slots',
                        message:
                            `Forme de vie — slots ${slots.used}/${slots.maximum}, ` +
                            `démarrage de la boucle ${run.lifeformLoopNumber + 1}…`,
                    });
                    refreshUi();
                    continue;
                }

                throw new Error(`Phase Forme de vie inconnue : ${run.phase}`);
            }
        } catch (error) {
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function consumeLifeformDelay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;

        const delayMs = Math.max(0, Math.floor(Number(run.lifeformPendingDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.lifeformPendingDelayLabel || 'l’action précédente';
        updateRun(runId, {
            message:
                `Forme de vie — boucle ${run.lifeformLoopNumber} — attente aléatoire ` +
                `${(delayMs / 1000).toFixed(2)} s après ${label}…`,
        });
        refreshUi();
        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            lifeformPendingDelayMs: 0,
            lifeformPendingDelayLabel: '',
        });
        refreshUi();
        return true;
    }

    async function startImportAutomation() {
        const config = getStoredConfig(6);
        if (config.links.length !== 1) {
            const ui = await ensureUi();
            ui.open(6);
            ui.showError('Configurez l’URL unique d’Import avant de lancer.');
            ui.refresh();
            return;
        }

        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: 6,
            status: 'running',
            combinedMode: false,
            combinedKind: '',
            nextProfileId: null,
            phase: 'import-open-link',
            currentLinkIndex: 0,
            importPendingDelayMs: 0,
            importPendingDelayLabel: '',
            startedAt: now,
            updatedAt: now,
            message: 'Import — action 1/4 : ouverture de l’URL configurée…',
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        navigateToUrl(config.links[0], true);
    }

    async function resumeImportAutomation(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run || run.profileId !== 6) return;

            const config = getStoredConfig(6);
            const importUrl = config.links[0];
            if (!importUrl) {
                throw new Error('L’URL Import n’est plus configurée.');
            }

            if (run.phase === 'import-open-link') {
                if (!isConfiguredPage(importUrl, window.location.href)) {
                    navigateToUrl(importUrl, false);
                    return;
                }

                const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                if (renderResult.timedOut) {
                    throw new Error('La page Import ne s’est pas chargée à temps.');
                }
                if (!getActiveRun(runId)) return;

                updateRun(runId, {
                    phase: 'import-max',
                    importPendingDelayMs: getRandomDelayMs(
                        IMPORT_DELAY_MIN_MS,
                        IMPORT_DELAY_MAX_MS
                    ),
                    importPendingDelayLabel: 'le chargement de l’URL',
                    message: 'Import — URL chargée, préparation du montant maximum…',
                });
            } else {
                const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                if (renderResult.timedOut) {
                    throw new Error('La page Import ne s’est pas stabilisée à temps.');
                }
            }

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;

                if (Number(run.importPendingDelayMs) > 0) {
                    const canContinue = await consumeImportDelay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.phase === 'import-max') {
                    updateRun(runId, {
                        message: 'Import — action 2/4 : sélectionner le maximum disponible…',
                    });
                    refreshUi();
                    const maxButton = await waitForElement(IMPORT_MAX_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'import-pay',
                        importPendingDelayMs: getRandomDelayMs(
                            IMPORT_DELAY_MIN_MS,
                            IMPORT_DELAY_MAX_MS
                        ),
                        importPendingDelayLabel: 'le clic sur maximum',
                    });
                    maxButton.click();
                    continue;
                }

                if (run.phase === 'import-pay') {
                    updateRun(runId, {
                        message: 'Import — action 3/4 : cliquer sur Payer…',
                    });
                    refreshUi();
                    const payButton = await waitForElement(IMPORT_PAY_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'import-take',
                        importPendingDelayMs: getRandomDelayMs(
                            IMPORT_DELAY_MIN_MS,
                            IMPORT_DELAY_MAX_MS
                        ),
                        importPendingDelayLabel: 'le clic sur Payer',
                    });
                    payButton.click();
                    continue;
                }

                if (run.phase === 'import-take') {
                    updateRun(runId, {
                        message: 'Import — action 4/4 : prendre l’objet…',
                    });
                    refreshUi();
                    const takeButton = await waitForElement(IMPORT_TAKE_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    const activeRun = getActiveRun(runId);
                    if (!activeRun) return;

                    GM_setValue(RUN_KEY, {
                        ...activeRun,
                        status: 'completed',
                        phase: 'import-completed',
                        updatedAt: Date.now(),
                        message:
                            'Import terminé : maximum sélectionné, paiement déclenché et objet récupéré.',
                    });
                    void clearThisTabRunId(runId);
                    refreshUi();
                    takeButton.click();
                    return;
                }

                throw new Error(`Phase Import inconnue : ${run.phase}`);
            }
        } catch (error) {
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function consumeImportDelay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;

        const delayMs = Math.max(0, Math.floor(Number(run.importPendingDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.importPendingDelayLabel || 'l’action précédente';
        updateRun(runId, {
            message:
                `Import — attente aléatoire ${(delayMs / 1000).toFixed(2)} s après ${label}…`,
        });
        refreshUi();
        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            importPendingDelayMs: 0,
            importPendingDelayLabel: '',
        });
        refreshUi();
        return true;
    }

    async function startGhostAutomation(selectedTime = '') {
        const config = getStoredConfig(8);
        if (config.links.length !== 1) {
            const ui = await ensureUi();
            ui.open(8);
            ui.showError('Configurez l’URL unique de Ghost avant de lancer.');
            ui.refresh();
            return;
        }

        const storedTime = getStoredGhostTimeValue();
        const ghostTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(selectedTime)
            ? selectedTime
            : storedTime;
        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: 8,
            status: 'running',
            combinedMode: false,
            combinedKind: '',
            nextProfileId: null,
            phase: 'ghost-open-link',
            currentLinkIndex: 0,
            ghostTime,
            ghostPendingDelayMs: 0,
            ghostPendingDelayLabel: '',
            startedAt: now,
            updatedAt: now,
            message: `Ghost — action 1/2 : ouverture de l’URL configurée (heure ${ghostTime})…`,
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        navigateToUrl(config.links[0], true);
    }

    async function resumeGhostAutomation(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run || run.profileId !== 8) return;

            const config = getStoredConfig(8);
            const ghostUrl = config.links[0];
            if (!ghostUrl) {
                throw new Error('L’URL Ghost n’est plus configurée.');
            }

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;

                if (Number(run.ghostPendingDelayMs) > 0) {
                    const canContinue = await consumeGhostDelay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.phase === 'ghost-open-link') {
                    if (!isConfiguredPage(ghostUrl, window.location.href)) {
                        navigateToUrl(ghostUrl, false);
                        return;
                    }

                    const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                    if (renderResult.timedOut) {
                        throw new Error('La page Ghost ne s’est pas chargée à temps.');
                    }
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'ghost-send-all',
                        ghostPendingDelayMs: getRandomDelayMs(
                            GHOST_DELAY_MIN_MS,
                            GHOST_DELAY_MAX_MS
                        ),
                        ghostPendingDelayLabel: 'le chargement de l’URL',
                        message: 'Ghost — action 1/2 terminée : page chargée.',
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'ghost-send-all') {
                    updateRun(runId, {
                        message: 'Ghost — action 2/2 : sélectionner tous les vaisseaux…',
                    });
                    refreshUi();
                    const sendAllButton = await waitForElement(GHOST_SEND_ALL_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'ghost-after-send-all',
                        ghostPendingDelayMs: getRandomDelayMs(
                            GHOST_DELAY_MIN_MS,
                            GHOST_DELAY_MAX_MS
                        ),
                        ghostPendingDelayLabel: 'la sélection de tous les vaisseaux',
                        message: 'Ghost — action 2/2 effectuée : tous les vaisseaux ont été sélectionnés.',
                    });
                    refreshUi();
                    sendAllButton.click();
                    continue;
                }

                if (run.phase === 'ghost-after-send-all') {
                    const activeRun = getActiveRun(runId);
                    if (!activeRun) return;
                    GM_setValue(RUN_KEY, {
                        ...activeRun,
                        status: 'completed',
                        phase: 'ghost-completed',
                        updatedAt: Date.now(),
                        message:
                            `Ghost terminé à ce stade : URL chargée et tous les vaisseaux ` +
                            `sélectionnés. Heure conservée : ${activeRun.ghostTime}.`,
                    });
                    await clearThisTabRunId(runId);
                    refreshUi();
                    return;
                }

                throw new Error(`Phase Ghost inconnue : ${run.phase}`);
            }
        } catch (error) {
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function consumeGhostDelay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;
        const delayMs = Math.max(0, Math.floor(Number(run.ghostPendingDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.ghostPendingDelayLabel || 'l’action précédente';
        updateRun(runId, {
            message: `Ghost — attente aléatoire ${(delayMs / 1000).toFixed(2)} s après ${label}…`,
        });
        refreshUi();
        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            ghostPendingDelayMs: 0,
            ghostPendingDelayLabel: '',
        });
        refreshUi();
        return true;
    }

    function getStoredGhostTimeValue() {
        const stored = String(GM_getValue(GHOST_TIME_KEY, '00:00'));
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(stored) ? stored : '00:00';
    }

    async function startExpeditionV2Automation(options = {}) {
        const config = getStoredConfig(9);
        if (config.links.length !== 1) {
            const ui = await ensureUi();
            ui.open(9);
            ui.showError('Configurez l’URL unique d’Expédition V2 avant de lancer.');
            ui.refresh();
            return;
        }

        const directionKeys = Object.keys(LIFEFORM_DIRECTIONS);
        const direction = directionKeys[getSecureRandomIndex(directionKeys.length)];
        const directionTarget = getSecureRandomIndex(7);
        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: 9,
            status: 'running',
            combinedMode: Boolean(options.combinedMode),
            combinedKind: typeof options.combinedKind === 'string' ? options.combinedKind : '',
            nextProfileId: Number(options.nextProfileId) === 4 ? 4 : null,
            phase: 'expedition-v2-open-link',
            currentLinkIndex: 0,
            expeditionV2Direction: direction,
            expeditionV2DirectionTarget: directionTarget,
            expeditionV2DirectionClicks: 0,
            expeditionV2LaunchCount: 0,
            expeditionV2PendingDelayMs: 0,
            expeditionV2PendingDelayLabel: '',
            startedAt: now,
            updatedAt: now,
            message:
                `Expédition V2 — ouverture de l’URL. Direction ` +
                `${direction === 'next' ? 'suivante' : 'précédente'}, ${directionTarget} clic(s) prévu(s).`,
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        navigateToUrl(config.links[0], true);
    }

    async function resumeExpeditionV2Automation(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run || run.profileId !== 9) return;

            const config = getStoredConfig(9);
            const configuredUrl = config.links[0];
            if (!configuredUrl) {
                throw new Error('L’URL d’Expédition V2 est absente ou invalide.');
            }

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;

                if (Number(run.expeditionV2PendingDelayMs) > 0) {
                    const canContinue = await consumeExpeditionV2Delay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.phase === 'expedition-v2-open-link') {
                    if (!isConfiguredPage(configuredUrl, window.location.href)) {
                        navigateToUrl(configuredUrl, false);
                        return;
                    }

                    const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                    if (renderResult.timedOut) {
                        throw new Error('La page Expédition V2 ne s’est pas chargée à temps.');
                    }
                    if (!getActiveRun(runId)) return;

                    const directionTarget = Math.max(
                        0,
                        Math.min(6, Math.floor(Number(run.expeditionV2DirectionTarget) || 0))
                    );
                    updateRun(runId, {
                        phase: directionTarget === 0
                            ? 'expedition-v2-open-template'
                            : 'expedition-v2-direction',
                        expeditionV2PendingDelayMs: getRandomDelayMs(
                            EXPEDITION_V2_DELAY_MIN_MS,
                            EXPEDITION_V2_DELAY_MAX_MS
                        ),
                        expeditionV2PendingDelayLabel: 'le chargement de l’URL',
                        message:
                            `Expédition V2 — étape 1/4 terminée. ` +
                            `${directionTarget} déplacement(s) ` +
                            `${run.expeditionV2Direction === 'next' ? 'suivant(s)' : 'précédent(s)'} prévu(s).`,
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'expedition-v2-direction') {
                    const direction = run.expeditionV2Direction === 'next' ? 'next' : 'prev';
                    const directionTarget = Math.max(
                        0,
                        Math.min(6, Math.floor(Number(run.expeditionV2DirectionTarget) || 0))
                    );
                    const completedClicks = Math.max(
                        0,
                        Math.floor(Number(run.expeditionV2DirectionClicks) || 0)
                    );
                    if (completedClicks >= directionTarget) {
                        updateRun(runId, {
                            phase: 'expedition-v2-open-template',
                            message: 'Expédition V2 — étape 2/4 terminée, préparation du modèle de flotte…',
                        });
                        refreshUi();
                        continue;
                    }

                    updateRun(runId, {
                        message:
                            `Expédition V2 — étape 2/4 : déplacement ` +
                            `${completedClicks + 1}/${directionTarget} vers la ` +
                            `${direction === 'next' ? 'galaxie suivante' : 'galaxie précédente'}…`,
                    });
                    refreshUi();
                    const directionButton = await waitForElement(LIFEFORM_DIRECTIONS[direction], {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    const nextClickCount = completedClicks + 1;
                    updateRun(runId, {
                        phase: nextClickCount >= directionTarget
                            ? 'expedition-v2-open-template'
                            : 'expedition-v2-direction',
                        expeditionV2DirectionClicks: nextClickCount,
                        expeditionV2PendingDelayMs: getRandomDelayMs(
                            EXPEDITION_V2_DELAY_MIN_MS,
                            EXPEDITION_V2_DELAY_MAX_MS
                        ),
                        expeditionV2PendingDelayLabel:
                            `le déplacement ${nextClickCount}/${directionTarget}`,
                        message:
                            `Expédition V2 — déplacement ${nextClickCount}/${directionTarget} effectué ` +
                            `vers la ${direction === 'next' ? 'galaxie suivante' : 'galaxie précédente'}.`,
                    });
                    refreshUi();
                    directionButton.click();
                    continue;
                }

                if (run.phase === 'expedition-v2-open-template') {
                    updateRun(runId, {
                        message: 'Expédition V2 — étape 3/4 : ouvrir le sélecteur de modèle de flotte…',
                    });
                    refreshUi();
                    const templateButton = await waitForElement(
                        EXPEDITION_V2_TEMPLATE_SELECTOR,
                        {
                            timeoutMs: ELEMENT_TIMEOUT_MS,
                            clickable: true,
                        }
                    );
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'expedition-v2-select-expe',
                        expeditionV2PendingDelayMs: getRandomDelayMs(
                            EXPEDITION_V2_DELAY_MIN_MS,
                            EXPEDITION_V2_DELAY_MAX_MS
                        ),
                        expeditionV2PendingDelayLabel: 'l’ouverture du sélecteur de modèle',
                        message: 'Expédition V2 — étape 3/4 : sélecteur de modèle ouvert.',
                    });
                    refreshUi();
                    templateButton.click();
                    continue;
                }

                if (run.phase === 'expedition-v2-select-expe') {
                    updateRun(runId, {
                        message: 'Expédition V2 — étape 3/4 : sélectionner le modèle EXPE…',
                    });
                    refreshUi();
                    const expeButton = await waitForElement(EXPEDITION_V2_EXPE_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'expedition-v2-expeditions',
                        expeditionV2PendingDelayMs: getRandomDelayMs(
                            EXPEDITION_V2_DELAY_MIN_MS,
                            EXPEDITION_V2_DELAY_MAX_MS
                        ),
                        expeditionV2PendingDelayLabel: 'la sélection de EXPE',
                        message: 'Expédition V2 — étape 3/4 terminée : EXPE sélectionné.',
                    });
                    refreshUi();
                    expeButton.click();
                    continue;
                }

                if (run.phase === 'expedition-v2-expeditions') {
                    if (hasExpeditionV2StopText()) {
                        await completeExpeditionV2(runId);
                        return;
                    }

                    const launchCount = Math.max(
                        0,
                        Math.floor(Number(run.expeditionV2LaunchCount) || 0)
                    );
                    if (launchCount >= EXPEDITION_V2_MAX_LAUNCHES) {
                        throw new Error(
                            `Le texte « Trop d’expéditions simultanées » n’est pas apparu après ` +
                            `${EXPEDITION_V2_MAX_LAUNCHES} tentatives.`
                        );
                    }

                    updateRun(runId, {
                        message:
                            `Expédition V2 — étape 4/4 : lancement de l’expédition ` +
                            `${launchCount + 1}…`,
                    });
                    refreshUi();
                    const expeditionButton = await waitForElement(EXPEDITION_V2_BUTTON_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    const nextLaunchCount = launchCount + 1;
                    updateRun(runId, {
                        expeditionV2LaunchCount: nextLaunchCount,
                        expeditionV2PendingDelayMs: getRandomDelayMs(
                            EXPEDITION_V2_DELAY_MIN_MS,
                            EXPEDITION_V2_DELAY_MAX_MS
                        ),
                        expeditionV2PendingDelayLabel:
                            `le lancement de l’expédition ${nextLaunchCount}`,
                        message:
                            `Expédition V2 — ${nextLaunchCount} expédition(s) lancée(s), ` +
                            'recherche du message d’arrêt…',
                    });
                    refreshUi();
                    expeditionButton.click();
                    continue;
                }

                throw new Error(`Phase Expédition V2 inconnue : ${run.phase}`);
            }
        } catch (error) {
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function consumeExpeditionV2Delay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;
        const delayMs = Math.max(0, Math.floor(Number(run.expeditionV2PendingDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.expeditionV2PendingDelayLabel || 'l’action précédente';
        updateRun(runId, {
            message:
                `Expédition V2 — attente aléatoire ${(delayMs / 1000).toFixed(2)} s après ${label}…`,
        });
        refreshUi();
        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            expeditionV2PendingDelayMs: 0,
            expeditionV2PendingDelayLabel: '',
        });
        refreshUi();
        return true;
    }

    function hasExpeditionV2StopText() {
        const pageText = String(document.body?.textContent || document.documentElement?.textContent || '')
            .normalize('NFC')
            .replace(/[’']/g, '`')
            .replace(/\s+/g, ' ')
            .toLocaleLowerCase('fr-FR');
        return pageText.includes(EXPEDITION_V2_STOP_TEXT);
    }

    async function completeExpeditionV2(runId) {
        const run = getActiveRun(runId);
        if (!run) return;

        if (
            run.combinedKind === 'expedition-v2-lifeform' &&
            run.nextProfileId === 4
        ) {
            await startLifeformAutomation({
                combinedMode: true,
                combinedKind: 'expedition-v2-lifeform',
            });
            return;
        }

        GM_setValue(RUN_KEY, {
            ...run,
            status: 'completed',
            phase: 'expedition-v2-completed',
            updatedAt: Date.now(),
            message:
                `Expédition V2 terminée après ${Math.max(0, Number(run.expeditionV2LaunchCount) || 0)} ` +
                'lancement(s) : le message d’arrêt a été détecté.',
        });
        await clearThisTabRunId(runId);
        refreshUi();
    }

    async function startConstructionAutomation(parameters) {
        const config = getStoredConfig(7);
        const sourceOrders = Array.isArray(parameters?.orders)
            ? parameters.orders
            : [{
                r1: parameters?.r1,
                r2: parameters?.r2,
                r3: parameters?.r3,
                selectedLinkIndex: parameters?.selectedLinkIndex,
            }];
        const orders = [];

        if (sourceOrders.length === 0 || sourceOrders.length > MAX_CONSTRUCTION_ORDERS) {
            const ui = await ensureUi();
            ui.openConstructionRunner();
            ui.showConstructionError(
                `Constructions accepte entre 1 et ${MAX_CONSTRUCTION_ORDERS} lignes.`
            );
            ui.refresh();
            return;
        }

        for (const [index, sourceOrder] of sourceOrders.entries()) {
            const selectedLinkIndex = Number(sourceOrder?.selectedLinkIndex);
            const selectedLink = config.namedLinks[selectedLinkIndex];
            const amounts = [sourceOrder?.r1, sourceOrder?.r2, sourceOrder?.r3]
                .map((value) => parseConstructionAmount(value));
            const total = amounts.some((value) => value === null)
                ? null
                : amounts.reduce((sum, value) => sum + value, 0);
            if (!selectedLink || total === null || !Number.isSafeInteger(total)) {
                const ui = await ensureUi();
                ui.openConstructionRunner();
                ui.showConstructionError(
                    `La ligne ${index + 1} contient une destination ou des montants invalides.`
                );
                ui.refresh();
                return;
            }
            orders.push({
                selectedLinkIndex,
                r1: amounts[0],
                r2: amounts[1],
                r3: amounts[2],
                total,
                transporterCount: Math.ceil(total / 9000),
            });
        }

        const firstOrder = orders[0];
        const firstLink = config.namedLinks[firstOrder.selectedLinkIndex];
        const now = Date.now();
        const runId = createRunId();
        const run = {
            runId,
            profileId: 7,
            status: 'running',
            combinedMode: false,
            combinedKind: '',
            nextProfileId: null,
            phase: 'construction-before-open-link',
            constructionOrders: orders,
            constructionOrderIndex: 0,
            currentLinkIndex: firstOrder.selectedLinkIndex,
            constructionR1: firstOrder.r1,
            constructionR2: firstOrder.r2,
            constructionR3: firstOrder.r3,
            constructionTotal: firstOrder.total,
            constructionTransporterCount: firstOrder.transporterCount,
            constructionPendingDelayMs: getRandomDelayMs(
                CONSTRUCTION_DELAY_MIN_MS,
                CONSTRUCTION_DELAY_MAX_MS
            ),
            constructionPendingDelayLabel: 'la validation des montants et de la destination',
            startedAt: now,
            updatedAt: now,
            message:
                `Constructions — ligne 1/${orders.length}, actions 1 et 2/6 validées : ${firstLink.name}, ` +
                `${formatInteger(firstOrder.total)} ressources, ` +
                `${formatInteger(firstOrder.transporterCount)} petites voitures…`,
        };

        GM_setValue(RUN_KEY, run);
        await setThisTabRunId(runId);
        refreshUi();
        await resumeConstructionAutomation(runId);
    }

    async function resumeConstructionAutomation(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run || run.profileId !== 7) return;

            const config = getStoredConfig(7);

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;
                const orders = getConstructionRunOrders(run);
                const orderIndex = getConstructionRunOrderIndex(run, orders);
                const currentOrder = orders[orderIndex];
                const selectedLink = config.namedLinks[currentOrder?.selectedLinkIndex];
                if (!currentOrder || !selectedLink) {
                    throw new Error('La destination Constructions de la ligne en cours n’existe plus.');
                }

                if (Number(run.constructionPendingDelayMs) > 0) {
                    const canContinue = await consumeConstructionDelay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.phase === 'construction-before-open-link') {
                    updateRun(runId, {
                        phase: 'construction-open-link',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            `action 3/6 : ouverture de ${selectedLink.name}…`,
                    });
                    refreshUi();
                    navigateToUrl(selectedLink.url, true);
                    return;
                }

                if (run.phase === 'construction-open-link') {
                    if (!isConfiguredPage(selectedLink.url, window.location.href)) {
                        navigateToUrl(selectedLink.url, false);
                        return;
                    }

                    const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                    if (renderResult.timedOut) {
                        throw new Error('La page Constructions ne s’est pas chargée à temps.');
                    }
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'construction-fill-transporters',
                        constructionPendingDelayMs: getRandomDelayMs(
                            CONSTRUCTION_DELAY_MIN_MS,
                            CONSTRUCTION_DELAY_MAX_MS
                        ),
                        constructionPendingDelayLabel: 'le chargement de la destination',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            `action 3/6 terminée : ${selectedLink.name} est chargée.`,
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'construction-fill-transporters') {
                    updateRun(runId, {
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, action 4/6 : saisir ` +
                            `${formatInteger(currentOrder.transporterCount)} petites voitures…`,
                    });
                    refreshUi();
                    const input = await waitForElement(CONSTRUCTION_TRANSPORTER_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: false,
                    });
                    if (!getActiveRun(runId)) return;

                    setFormControlValue(input, String(currentOrder.transporterCount));
                    updateRun(runId, {
                        phase: 'construction-continue',
                        constructionPendingDelayMs: getRandomDelayMs(
                            500,
                            1500
                        ),
                        constructionPendingDelayLabel: 'la saisie du nombre de petites voitures',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, action 4/6 : ` +
                            `${formatInteger(currentOrder.transporterCount)} petites voitures saisies, ` +
                            'préparation du clic sur Continuer…',
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'construction-continue') {
                    updateRun(runId, {
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'action 4/6 : cliquer sur Continuer…',
                    });
                    refreshUi();
                    const continueButton = await waitForElement(CONSTRUCTION_CONTINUE_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    if (!getActiveRun(runId)) return;

                    const pageExitPromise = waitForPageExit(3000);
                    updateRun(runId, {
                        phase: 'construction-wait-resources-page',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'action 4/6 terminée : attente de la page des ressources…',
                    });
                    refreshUi();
                    continueButton.click();
                    const pageExited = await pageExitPromise;
                    if (pageExited) return;
                    continue;
                }

                if (
                    run.phase === 'construction-wait-resources-page' ||
                    run.phase === 'construction-wait-send-page'
                ) {
                    const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
                    if (renderResult.timedOut) {
                        throw new Error('La page des ressources Constructions ne s’est pas chargée à temps.');
                    }
                    if (!getActiveRun(runId)) return;

                    updateRun(runId, {
                        phase: 'construction-fill-resources',
                        constructionPendingDelayMs: getRandomDelayMs(
                            CONSTRUCTION_DELAY_MIN_MS,
                            CONSTRUCTION_DELAY_MAX_MS
                        ),
                        constructionPendingDelayLabel: 'le chargement de la page des ressources',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'page des ressources chargée, préparation de l’action 5/6…',
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'construction-fill-resources') {
                    const resourceEntries = [
                        ['R1', CONSTRUCTION_RESOURCE_SELECTORS.r1, currentOrder.r1],
                        ['R2', CONSTRUCTION_RESOURCE_SELECTORS.r2, currentOrder.r2],
                        ['R3', CONSTRUCTION_RESOURCE_SELECTORS.r3, currentOrder.r3],
                    ];
                    if (resourceEntries.some(([, selector]) => !selector)) {
                        await pauseConstructionForMissingActions(
                            runId,
                            'Constructions prête jusqu’à l’action 4/6. Les sélecteurs X, Y et Z de l’action 5 restent à ajouter.'
                        );
                        return;
                    }

                    updateRun(runId, {
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'action 5/6 : saisir R1, R2 et R3…',
                    });
                    refreshUi();
                    for (const [, selector, value] of resourceEntries) {
                        const resourceInput = await waitForElement(selector, {
                            timeoutMs: ELEMENT_TIMEOUT_MS,
                            clickable: false,
                        });
                        if (!getActiveRun(runId)) return;
                        setFormControlValue(resourceInput, String(value));
                    }

                    updateRun(runId, {
                        phase: 'construction-send',
                        constructionPendingDelayMs: getRandomDelayMs(
                            CONSTRUCTION_DELAY_MIN_MS,
                            CONSTRUCTION_DELAY_MAX_MS
                        ),
                        constructionPendingDelayLabel: 'la saisie de R1, R2 et R3',
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'action 5/6 terminée : R1, R2 et R3 saisis.',
                    });
                    refreshUi();
                    continue;
                }

                if (run.phase === 'construction-send') {
                    if (!CONSTRUCTION_SEND_SELECTOR) {
                        await pauseConstructionForMissingActions(
                            runId,
                            'Constructions prête jusqu’à l’action 5/6. Le sélecteur du bouton Envoyer reste à ajouter.'
                        );
                        return;
                    }

                    updateRun(runId, {
                        message:
                            `Constructions — ligne ${orderIndex + 1}/${orders.length}, ` +
                            'action 6/6 : cliquer sur Envoyer…',
                    });
                    refreshUi();
                    const sendButton = await waitForElement(CONSTRUCTION_SEND_SELECTOR, {
                        timeoutMs: ELEMENT_TIMEOUT_MS,
                        clickable: true,
                    });
                    const activeRun = getActiveRun(runId);
                    if (!activeRun) return;

                    const nextOrderIndex = orderIndex + 1;
                    if (nextOrderIndex < orders.length) {
                        const nextOrder = orders[nextOrderIndex];
                        const nextLink = config.namedLinks[nextOrder.selectedLinkIndex];
                        if (!nextLink) {
                            throw new Error(
                                `La destination Constructions de la ligne ${nextOrderIndex + 1} n’existe plus.`
                            );
                        }

                        const pageExitPromise = waitForPageExit(3000);
                        GM_setValue(RUN_KEY, {
                            ...activeRun,
                            phase: 'construction-before-open-link',
                            constructionOrderIndex: nextOrderIndex,
                            currentLinkIndex: nextOrder.selectedLinkIndex,
                            constructionR1: nextOrder.r1,
                            constructionR2: nextOrder.r2,
                            constructionR3: nextOrder.r3,
                            constructionTotal: nextOrder.total,
                            constructionTransporterCount: nextOrder.transporterCount,
                            constructionPendingDelayMs: getRandomDelayMs(
                                CONSTRUCTION_DELAY_MIN_MS,
                                CONSTRUCTION_DELAY_MAX_MS
                            ),
                            constructionPendingDelayLabel:
                                `l’envoi de la ligne ${orderIndex + 1}/${orders.length}`,
                            updatedAt: Date.now(),
                            message:
                                `Constructions — ligne ${orderIndex + 1}/${orders.length} terminée. ` +
                                `La ligne ${nextOrderIndex + 1}/${orders.length} reprendra à l’action 3 ` +
                                `sur ${nextLink.name}.`,
                        });
                        refreshUi();
                        sendButton.click();
                        const pageExited = await pageExitPromise;
                        if (pageExited) return;
                        continue;
                    }

                    GM_setValue(RUN_KEY, {
                        ...activeRun,
                        status: 'completed',
                        phase: 'construction-completed',
                        updatedAt: Date.now(),
                        message:
                            `Constructions terminée : ${orders.length} ligne` +
                            `${orders.length > 1 ? 's' : ''} exécutée${orders.length > 1 ? 's' : ''}.`,
                    });
                    void clearThisTabRunId(runId);
                    refreshUi();
                    sendButton.click();
                    return;
                }

                throw new Error(`Phase Constructions inconnue : ${run.phase}`);
            }
        } catch (error) {
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function pauseConstructionForMissingActions(runId, message) {
        const run = getActiveRun(runId);
        if (!run) return;
        GM_setValue(RUN_KEY, {
            ...run,
            status: 'needs-actions',
            updatedAt: Date.now(),
            message,
        });
        await clearThisTabRunId(runId);
        refreshUi();
    }

    async function consumeConstructionDelay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;

        const delayMs = Math.max(0, Math.floor(Number(run.constructionPendingDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.constructionPendingDelayLabel || 'l’action précédente';
        updateRun(runId, {
            message:
                `Constructions — attente aléatoire ${(delayMs / 1000).toFixed(2)} s après ${label}…`,
        });
        refreshUi();
        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            constructionPendingDelayMs: 0,
            constructionPendingDelayLabel: '',
        });
        refreshUi();
        return true;
    }

    async function resumeAutomationForThisTab() {
        const run = getRunState();
        if (run.status !== 'running' || !run.runId) {
            return;
        }

        const tabRunId = await getThisTabRunId();
        if (tabRunId !== run.runId) {
            return;
        }

        const config = getStoredConfig(run.profileId);
        if (config.links.length === 0 || run.currentLinkIndex >= config.links.length) {
            await failRun(run.runId, 'Configuration de liens absente ou incohérente.');
            return;
        }
        if (run.profileId === 4) {
            await resumeLifeformAutomation(run.runId);
            return;
        }
        if (run.profileId === 6) {
            await resumeImportAutomation(run.runId);
            return;
        }
        if (run.profileId === 7) {
            await resumeConstructionAutomation(run.runId);
            return;
        }
        if (run.profileId === 8) {
            await resumeGhostAutomation(run.runId);
            return;
        }
        if (run.profileId === 9) {
            await resumeExpeditionV2Automation(run.runId);
            return;
        }
        if (run.profileId === 2 && !config.startUrl) {
            await failRun(run.runId, 'Lien de départ de la série 2 absent ou invalide.');
            return;
        }

        const currentUrl = config.links[run.currentLinkIndex];

        if (run.profileId === 2 && run.phase === 'open-start-page') {
            if (!isConfiguredPage(config.startUrl, window.location.href)) {
                navigateToUrl(config.startUrl, false);
                return;
            }

            const startPageResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);
            if (startPageResult.timedOut) {
                await failRun(run.runId, 'Le lien de départ ne s’est pas chargé à temps.');
                return;
            }
            if (!getActiveRun(run.runId)) return;

            let slots;
            try {
                slots = await readExpeditionSlots(ELEMENT_TIMEOUT_MS);
            } catch (error) {
                await failRun(
                    run.runId,
                    error instanceof Error ? error.message : String(error),
                    error
                );
                return;
            }
            if (!getActiveRun(run.runId)) return;

            if (slots.remaining === 0) {
                if (
                    run.combinedKind === 'expeditions-lifeform' &&
                    run.nextProfileId === 4
                ) {
                    await startLifeformAutomation({
                        combinedMode: true,
                        combinedKind: 'expeditions-lifeform',
                    });
                    return;
                }

                GM_setValue(RUN_KEY, {
                    ...getRunState(),
                    status: 'completed',
                    targetExecutions: 0,
                    updatedAt: Date.now(),
                    message:
                        `Série 2 terminée sans action : ${slots.used}/${slots.maximum} ` +
                        'expéditions sont déjà utilisées.',
                });
                await clearThisTabRunId(run.runId);
                refreshUi();
                return;
            }

            updateRun(run.runId, {
                phase: 'open-link',
                targetExecutions: slots.remaining,
                message:
                    `Série 2 — créneaux ${slots.used}/${slots.maximum}, ` +
                    `${slots.remaining} exécution(s) prévue(s) — ` +
                    `ouverture du lien ${run.currentLinkIndex + 1}/${config.links.length} choisi aléatoirement…`,
            });
            refreshUi();
            navigateToUrl(currentUrl, false);
            return;
        }

        if (run.phase === 'open-link') {
            if (!isConfiguredPage(currentUrl, window.location.href)) {
                navigateToUrl(currentUrl, false);
                return;
            }

            const postLoadDelayMs = getRandomDelayMs(
                POST_ACTION_DELAY_MIN_MS,
                POST_ACTION_DELAY_MAX_MS
            );
            updateRun(run.runId, {
                phase: 'run-steps',
                nextStepIndex: 0,
                pendingPostActionDelayMs: postLoadDelayMs,
                pendingPostActionLabel: 'chargement de l’URL',
                message:
                    run.profileId === 2
                        ? `Série 2 — boucle ${run.cycleNumber}/${getExecutionTarget(run)} : URL chargée.`
                        : `Série 1 — boucle ${run.currentLinkIndex + 1}/${config.links.length} : URL chargée.`,
            });
        }

        await processCurrentLink(run.runId);
    }

    async function processCurrentLink(runId) {
        try {
            let run = getActiveRun(runId);
            if (!run) return;
            const config = getStoredConfig(run.profileId);
            const actionSteps = getActionSteps(run.profileId);

            refreshUi();
            const renderResult = await waitUntilPageUsable(PAGE_TIMEOUT_MS);

            run = getActiveRun(runId);
            if (!run) return;

            if (renderResult.timedOut) {
                throw new Error('La page ne s’est pas stabilisée dans le délai prévu.');
            }

            if (actionSteps.length === 0) {
                GM_setValue(RUN_KEY, {
                    ...run,
                    status: 'needs-actions',
                    updatedAt: Date.now(),
                    message:
                        `Série ${run.profileId} — lien ${run.currentLinkIndex + 1}/${config.links.length} chargé. ` +
                        'Les actions de cette série doivent maintenant être renseignées.',
                });
                await clearThisTabRunId(runId);
                refreshUi();
                return;
            }

            while (true) {
                run = getActiveRun(runId);
                if (!run) return;

                if (Number(run.pendingPostActionDelayMs) > 0) {
                    const canContinue = await consumePostActionDelay(runId);
                    if (!canContinue) return;
                    continue;
                }

                if (run.nextStepIndex >= actionSteps.length) {
                    await finishCurrentLink(runId);
                    return;
                }

                const stepIndex = run.nextStepIndex;
                const step = actionSteps[stepIndex];
                const progressLabel =
                    run.profileId === 2
                        ? `Série 2 — exécution ${run.cycleNumber}/${getExecutionTarget(run)}`
                        : `Série 1 — lien ${run.currentLinkIndex + 1}/${config.links.length}`;
                updateRun(runId, {
                    message:
                        `${progressLabel} — ` +
                        `action ${stepIndex + 1}/${actionSteps.length}` +
                        `${step.name ? ` : ${step.name}` : ''}…`,
                });
                refreshUi();

                const pageWillResume = await executeStep(runId, stepIndex, step);
                if (pageWillResume) {
                    return;
                }
            }
        } catch (error) {
            if (error instanceof ElementNotFoundError) {
                console.warn(`[Projet secret] ${error.message} Passage au lien suivant.`);
                await finishCurrentLink(runId, {
                    skipped: true,
                    reason: error.message,
                });
                return;
            }
            await failRun(runId, error instanceof Error ? error.message : String(error), error);
        }
    }

    async function executeStep(runId, stepIndex, step) {
        if (!step || typeof step.type !== 'string') {
            throw new Error(`Action ${stepIndex + 1} invalide.`);
        }

        if (step.type === 'waitPage') {
            const result = await waitUntilPageUsable(step.timeoutMs || PAGE_TIMEOUT_MS);
            if (result.timedOut) {
                throw new Error(`Délai dépassé pendant l’action ${stepIndex + 1}.`);
            }
            advanceStep(runId, stepIndex);
            return false;
        }

        if (step.type === 'waitFor') {
            await waitForElement(step.selector, {
                timeoutMs: step.elementTimeoutMs || ELEMENT_TIMEOUT_MS,
                clickable: false,
            });
            advanceStep(runId, stepIndex);
            return false;
        }

        if (step.type === 'setValue') {
            const element = await waitForElement(step.selector, {
                timeoutMs: step.elementTimeoutMs || ELEMENT_TIMEOUT_MS,
                clickable: false,
            });
            const activeRun = getActiveRun(runId);
            if (!activeRun) return true;

            const configuredValue = step.configValue
                ? getStoredConfig(activeRun.profileId)[step.configValue]
                : undefined;
            const value = String(configuredValue ?? step.value ?? step.defaultValue ?? '');
            setFormControlValue(element, value);
            console.info(
                `[Projet secret] Valeur ${value} saisie pour l’action ${stepIndex + 1} : ${step.name || step.selector}`,
                element
            );
            advanceStep(runId, stepIndex);
            return false;
        }

        if (step.type === 'delay') {
            await delay(scaleActionDelayMs(step.ms));
            advanceStep(runId, stepIndex);
            return false;
        }

        if (step.type === 'pause') {
            const run = getActiveRun(runId);
            if (!run) return true;

            GM_setValue(RUN_KEY, {
                ...run,
                status: 'needs-actions',
                updatedAt: Date.now(),
                message: step.message || `Pause après l’action ${stepIndex}.`,
            });
            await clearThisTabRunId(runId);
            refreshUi();
            return true;
        }

        if (step.type === 'click') {
            let element = await waitForElement(step.selector, {
                timeoutMs: step.elementTimeoutMs || ELEMENT_TIMEOUT_MS,
                clickable: true,
            });

            if (!getActiveRun(runId)) {
                return true;
            }

            if (step.randomDelayBefore) {
                const randomDelayMs = getRandomDelayMs(
                    step.randomDelayBefore.minMs,
                    step.randomDelayBefore.maxMs
                );
                const run = getActiveRun(runId);
                if (!run) return true;

                updateRun(runId, {
                    message:
                        (run.profileId === 2
                            ? `Série 2 — exécution ${run.cycleNumber}/${getExecutionTarget(run)} — `
                            : `Série 1 — lien ${run.currentLinkIndex + 1}/${getStoredConfig(1).links.length} — `) +
                        `attente aléatoire ${(randomDelayMs / 1000).toFixed(2)} s avant ${step.name || 'le clic'}…`,
                });
                refreshUi();
                console.info(
                    `[Projet secret] Attente aléatoire avant l’action ${stepIndex + 1} : ${randomDelayMs} ms`
                );
                await delay(randomDelayMs);

                if (!getActiveRun(runId)) {
                    return true;
                }
            }

            element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
            await delay(scaleActionDelayMs(50));

            // Enregistrer l'action suivante avant le clic permet de reprendre
            // correctement après une navigation ou un rechargement de page.
            advanceStep(runId, stepIndex);
            const waitsForPage = step.waitAfter === 'page';
            const pageExitPromise = waitsForPage ? waitForPageExit(3000) : null;
            const clickCount = Math.max(1, Math.floor(Number(step.clickCount) || 1));
            const clickIntervalMs = scaleActionDelayMs(step.clickIntervalMs);

            for (let clickNumber = 1; clickNumber <= clickCount; clickNumber += 1) {
                if (!getActiveRun(runId)) {
                    return true;
                }

                if (clickNumber > 1) {
                    if (waitsForPage) {
                        const intervalResult = await Promise.race([
                            pageExitPromise.then((didExit) => (didExit ? 'page-exited' : 'no-exit')),
                            delay(clickIntervalMs).then(() => 'interval-finished'),
                        ]);
                        if (intervalResult === 'page-exited') {
                            console.info(
                                '[Projet secret] La page a été quittée avant le second clic ; le premier clic a été pris en compte.'
                            );
                            return true;
                        }
                    } else {
                        await delay(clickIntervalMs);
                    }

                    if (!element.isConnected) {
                        try {
                            element = await waitForElement(step.selector, {
                                timeoutMs: 1000,
                                clickable: true,
                            });
                        } catch (error) {
                            if (error instanceof ElementNotFoundError) {
                                console.info(
                                    '[Projet secret] Le bouton a disparu après le premier clic ; le second clic de sécurité est ignoré.'
                                );
                                break;
                            }
                            throw error;
                        }
                    }
                }

                console.info(
                    `[Projet secret] Clic ${clickNumber}/${clickCount} de l’action ${stepIndex + 1} : ` +
                        `${step.name || step.selector}`,
                    element
                );
                element.click();
            }

            if (waitsForPage) {
                const pageExited = await pageExitPromise;
                if (pageExited) {
                    return true;
                }

                // Couvre aussi les applications monopages sans événement pagehide.
                const result = await waitUntilPageUsable(step.timeoutMs || PAGE_TIMEOUT_MS);
                if (result.timedOut) {
                    throw new Error(`La page attendue après l’action ${stepIndex + 1} ne s’est pas stabilisée.`);
                }
            }

            return false;
        }

        throw new Error(`Type d’action inconnu : ${step.type}`);
    }

    async function consumePostActionDelay(runId) {
        const run = getActiveRun(runId);
        if (!run) return false;

        const delayMs = Math.max(0, Math.floor(Number(run.pendingPostActionDelayMs) || 0));
        if (delayMs === 0) return true;

        const label = run.pendingPostActionLabel || 'l’action précédente';
        const progressLabel =
            run.profileId === 2
                ? `Série 2 — boucle ${run.cycleNumber}/${getExecutionTarget(run)}`
                : `Série 1 — boucle ${run.currentLinkIndex + 1}/${getStoredConfig(1).links.length}`;
        updateRun(runId, {
            message:
                `${progressLabel} — pause aléatoire de ${(delayMs / 1000).toFixed(2)} s ` +
                `après ${label}…`,
        });
        refreshUi();
        console.info(`[Projet secret] Pause après ${label} : ${delayMs} ms`);

        await delay(delayMs);
        if (!getActiveRun(runId)) return false;

        updateRun(runId, {
            pendingPostActionDelayMs: 0,
            pendingPostActionLabel: '',
        });
        refreshUi();
        return true;
    }

    async function finishCurrentLink(runId, outcome = {}) {
        const run = getActiveRun(runId);
        if (!run) return;

        const config = getStoredConfig(run.profileId);
        const nextIndex = run.currentLinkIndex + 1;
        const skippedCount = Number(run.skippedCount || 0) + (outcome.skipped ? 1 : 0);
        const outcomePrefix = outcome.skipped
            ? `Série ${run.profileId} — ` +
              `${run.profileId === 2 ? `exécution ${run.cycleNumber}` : `lien ${run.currentLinkIndex + 1}`} ignoré(e) : ` +
              `${outcome.reason || 'élément introuvable'}. `
            : '';

        if (run.profileId === 2) {
            const executionTarget = getExecutionTarget(run);
            const nextExecution = run.cycleNumber + 1;

            if (nextExecution <= executionTarget) {
                updateRun(runId, {
                    phase: 'open-link',
                    nextStepIndex: 0,
                    cycleNumber: nextExecution,
                    skippedCount,
                    pendingPostActionDelayMs: 0,
                    pendingPostActionLabel: '',
                    message:
                        `${outcomePrefix}Série 2 — boucle ${nextExecution}/${executionTarget} : ` +
                        'rechargement du lien choisi avant l’action 1…',
                });
                refreshUi();
                navigateToUrl(config.links[run.currentLinkIndex], true);
                return;
            }

            if (
                run.combinedKind === 'expeditions-lifeform' &&
                run.nextProfileId === 4
            ) {
                await startLifeformAutomation({
                    combinedMode: true,
                    combinedKind: 'expeditions-lifeform',
                });
                return;
            }

            GM_setValue(RUN_KEY, {
                ...run,
                status: 'completed',
                skippedCount,
                updatedAt: Date.now(),
                message:
                    `Série 2 terminée : ${executionTarget} exécution(s) sur le lien choisi, ` +
                    `${skippedCount} ignorée(s).`,
            });
            await clearThisTabRunId(runId);
            refreshUi();
            return;
        }

        if (nextIndex < config.links.length) {
            updateRun(runId, {
                phase: 'open-link',
                currentLinkIndex: nextIndex,
                nextStepIndex: 0,
                skippedCount,
                message:
                    `${outcomePrefix}Série ${run.profileId} — ` +
                    `ouverture du lien ${nextIndex + 1} sur ${config.links.length}…`,
            });
            refreshUi();
            navigateToUrl(config.links[nextIndex], false);
            return;
        }

        if (run.profileId === 1 && run.combinedMode && run.nextProfileId === 2) {
            const expeditionsConfig = getStoredConfig(2);
            if (expeditionsConfig.links.length === 0 || !expeditionsConfig.startUrl) {
                await failRun(
                    runId,
                    'La configuration Expéditions est devenue incomplète avant son démarrage.'
                );
                return;
            }

            await startAutomation(2, expeditionsConfig.links, {
                combinedMode: true,
                combinedKind: 'resources-expeditions',
                nextProfileId: null,
            });
            return;
        }

        if (config.repeat && !run.combinedMode) {
            updateRun(runId, {
                phase: 'open-link',
                currentLinkIndex: 0,
                nextStepIndex: 0,
                cycleNumber: run.cycleNumber + 1,
                skippedCount,
                message:
                    `${outcomePrefix}Série ${run.profileId} — nouveau cycle ${run.cycleNumber + 1} — ` +
                    'ouverture du premier lien…',
            });
            refreshUi();
            navigateToUrl(config.links[0], false);
            return;
        }

        GM_setValue(RUN_KEY, {
            ...run,
            status: 'completed',
            skippedCount,
            updatedAt: Date.now(),
            message:
                `Série ${run.profileId} terminée : ${config.links.length} lien(s) parcouru(s), ` +
                `${skippedCount} ignoré(s).`,
        });
        await clearThisTabRunId(runId);
        refreshUi();
    }

    function advanceStep(runId, completedStepIndex) {
        const run = getActiveRun(runId);
        if (!run || run.nextStepIndex !== completedStepIndex) {
            return false;
        }

        const actionCount = getActionSteps(run.profileId).length;
        updateRun(runId, {
            nextStepIndex: completedStepIndex + 1,
            pendingPostActionDelayMs: getRandomDelayMs(
                POST_ACTION_DELAY_MIN_MS,
                POST_ACTION_DELAY_MAX_MS
            ),
            pendingPostActionLabel: `l’action ${completedStepIndex + 1}/${actionCount}`,
        });
        return true;
    }

    async function stopAutomation(message) {
        const run = getRunState();
        if (run.runId) {
            GM_setValue(RUN_KEY, {
                ...run,
                status: 'stopped',
                updatedAt: Date.now(),
                message,
            });
            await clearThisTabRunId(run.runId);
        }
        refreshUi();
    }

    async function failRun(runId, message, error) {
        const run = getRunState();
        if (run.runId !== runId) return;

        GM_setValue(RUN_KEY, {
            ...run,
            status: 'error',
            updatedAt: Date.now(),
            message: `Erreur : ${message}`,
        });
        await clearThisTabRunId(runId);
        refreshUi();
        console.error('[Projet secret]', error || message);
    }

    function normalizeProfileId(profileId) {
        const value = Number(profileId);
        if (value === 4 || value === 6 || value === 7 || value === 8 || value === 9) return value;
        return value === 2 ? 2 : 1;
    }

    function normalizeEditorProfileId(profileId) {
        const value = Number(profileId);
        if (value === 3 || value === 5 || value === 10) return value;
        return normalizeProfileId(value);
    }

    function getProfileLabel(profileId) {
        const normalizedProfileId = normalizeProfileId(profileId);
        if (normalizedProfileId === 4) return 'Forme de vie';
        if (normalizedProfileId === 6) return 'Import';
        if (normalizedProfileId === 7) return 'Constructions';
        if (normalizedProfileId === 8) return 'Ghost';
        if (normalizedProfileId === 9) return 'Expédition V2';
        return normalizedProfileId === 2 ? 'Expéditions' : 'Ressources';
    }

    function getExecutionTarget(run) {
        const value = Math.floor(Number(run?.targetExecutions));
        return Number.isFinite(value) && value > 0 ? value : 8;
    }

    function getActionSteps(profileId) {
        const normalizedProfileId = normalizeProfileId(profileId);
        if (
            normalizedProfileId === 4 ||
            normalizedProfileId === 6 ||
            normalizedProfileId === 7 ||
            normalizedProfileId === 8 ||
            normalizedProfileId === 9
        ) return [];
        return normalizedProfileId === 2 ? ACTION_STEPS_2 : ACTION_STEPS_1;
    }

    function formatDebugProgress(run) {
        if (!run || !run.status || run.status === 'idle') return '';

        const profileId = normalizeProfileId(run.profileId);
        if (profileId === 4) {
            return formatLifeformDebugProgress(run);
        }
        if (profileId === 6) {
            return formatImportDebugProgress(run);
        }
        if (profileId === 7) {
            return formatConstructionDebugProgress(run);
        }
        if (profileId === 8) {
            return formatGhostDebugProgress(run);
        }
        if (profileId === 9) {
            return formatExpeditionV2DebugProgress(run);
        }
        const config = getStoredConfig(profileId);
        const actionSteps = getActionSteps(profileId);
        const loopLabel =
            profileId === 2
                ? `${Math.max(1, Number(run.cycleNumber) || 1)}/${getExecutionTarget(run)}`
                : `${Math.max(1, Number(run.currentLinkIndex) + 1 || 1)}/${Math.max(1, config.links.length)}`;

        let actionLabel;
        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (run.phase === 'open-start-page') {
            actionLabel = 'Préparation — chargement de l’URL de départ';
        } else if (run.phase === 'open-link') {
            actionLabel = 'Chargement du lien choisi';
        } else if (Number(run.pendingPostActionDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.pendingPostActionLabel || 'l’action précédente'} — ` +
                `${(Number(run.pendingPostActionDelayMs) / 1000).toFixed(2)} s`;
        } else if (Number(run.nextStepIndex) < actionSteps.length) {
            const stepIndex = Math.max(0, Number(run.nextStepIndex) || 0);
            const step = actionSteps[stepIndex];
            actionLabel =
                `Action ${stepIndex + 1}/${actionSteps.length}` +
                `${step?.name ? ` — ${step.name}` : ''}`;
        } else {
            actionLabel = `Fin des ${actionSteps.length} actions`;
        }

        const message = typeof run.message === 'string' ? run.message : '';
        const combinedLabel =
            run.combinedKind === 'expeditions-lifeform'
                ? 'Expédition & Forme de vie'
                : 'Ressources & Expéditions';
        const runLabel = run.combinedMode
            ? `${combinedLabel} — étape ${getProfileLabel(profileId)}`
            : getProfileLabel(profileId);
        return (
            `${runLabel} — Boucle ${loopLabel}\n${actionLabel}` +
            (message ? `\n${message}` : '')
        );
    }

    function formatLifeformDebugProgress(run) {
        const loopNumber = Math.max(1, Math.floor(Number(run.lifeformLoopNumber) || 1));
        const directionLabel = run.lifeformDirection === 'next' ? 'suivante' : 'précédente';
        let actionLabel;

        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (Number(run.lifeformPendingDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.lifeformPendingDelayLabel || 'l’action précédente'} — ` +
                `${(Number(run.lifeformPendingDelayMs) / 1000).toFixed(2)} s`;
        } else {
            const labels = {
                'lifeform-open-link': 'Action 1/4 — charger l’URL choisie',
                'lifeform-discover': 'Action 2/4 — cliquer sur Découverte',
                'lifeform-direction': `Action 3/4 — direction ${directionLabel}`,
                'lifeform-read-slots': 'Action 4/4 — lire les slots',
            };
            actionLabel = labels[run.phase] || `Phase inconnue : ${run.phase}`;
        }

        const runLabel = run.combinedKind === 'expeditions-lifeform'
            ? 'Expédition & Forme de vie — étape Forme de vie'
            : run.combinedKind === 'expedition-v2-lifeform'
              ? 'Expédition V2 & Forme de vie — étape Forme de vie'
              : 'Forme de vie';
        const message = typeof run.message === 'string' ? run.message : '';
        return (
            `${runLabel} — Boucle ${loopNumber} — direction ${directionLabel}\n${actionLabel}` +
            (message ? `\n${message}` : '')
        );
    }

    function formatExpeditionV2DebugProgress(run) {
        const direction = run.expeditionV2Direction === 'next' ? 'suivante' : 'précédente';
        const directionTarget = Math.max(
            0,
            Math.min(6, Math.floor(Number(run.expeditionV2DirectionTarget) || 0))
        );
        const directionClicks = Math.max(
            0,
            Math.floor(Number(run.expeditionV2DirectionClicks) || 0)
        );
        const launchCount = Math.max(0, Math.floor(Number(run.expeditionV2LaunchCount) || 0));
        let actionLabel;

        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (Number(run.expeditionV2PendingDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.expeditionV2PendingDelayLabel || 'l’action précédente'} — ` +
                `${(Number(run.expeditionV2PendingDelayMs) / 1000).toFixed(2)} s`;
        } else {
            const labels = {
                'expedition-v2-open-link': 'Étape 1/4 — charger l’URL',
                'expedition-v2-direction':
                    `Étape 2/4 — direction ${direction}, ${directionClicks}/${directionTarget} clic(s)`,
                'expedition-v2-open-template': 'Étape 3/4 — ouvrir le sélecteur de modèle',
                'expedition-v2-select-expe': 'Étape 3/4 — sélectionner le modèle EXPE',
                'expedition-v2-expeditions':
                    `Étape 4/4 — ${launchCount} lancement(s), attente du message d’arrêt`,
                'expedition-v2-completed': 'Expédition V2 terminée',
            };
            actionLabel = labels[run.phase] || `Phase inconnue : ${run.phase}`;
        }

        const runLabel = run.combinedKind === 'expedition-v2-lifeform'
            ? 'Expédition V2 & Forme de vie — étape Expédition V2'
            : 'Expédition V2';
        const message = typeof run.message === 'string' ? run.message : '';
        return (
            `${runLabel}\nDirection ${direction} · Déplacements ${directionClicks}/${directionTarget} · ` +
            `Expéditions ${launchCount}\n${actionLabel}` +
            (message ? `\n${message}` : '')
        );
    }

    function formatImportDebugProgress(run) {
        let actionLabel;
        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (Number(run.importPendingDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.importPendingDelayLabel || 'l’action précédente'} — ` +
                `${(Number(run.importPendingDelayMs) / 1000).toFixed(2)} s`;
        } else {
            const labels = {
                'import-open-link': 'Action 1/4 — charger l’URL',
                'import-max': 'Action 2/4 — sélectionner le maximum',
                'import-pay': 'Action 3/4 — cliquer sur Payer',
                'import-take': 'Action 4/4 — prendre l’objet',
                'import-completed': 'Import terminé',
            };
            actionLabel = labels[run.phase] || `Phase inconnue : ${run.phase}`;
        }

        const message = typeof run.message === 'string' ? run.message : '';
        return `Import\n${actionLabel}` + (message ? `\n${message}` : '');
    }

    function formatGhostDebugProgress(run) {
        let actionLabel;
        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (Number(run.ghostPendingDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.ghostPendingDelayLabel || 'l’action précédente'} — ` +
                `${(Number(run.ghostPendingDelayMs) / 1000).toFixed(2)} s`;
        } else {
            const labels = {
                'ghost-open-link': 'Action 1/2 — charger l’URL',
                'ghost-send-all': 'Action 2/2 — sélectionner tous les vaisseaux',
                'ghost-after-send-all': 'Finalisation de la sélection',
                'ghost-completed': 'Ghost terminé',
            };
            actionLabel = labels[run.phase] || `Phase inconnue : ${run.phase}`;
        }

        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(run.ghostTime || ''))
            ? run.ghostTime
            : '00:00';
        const message = typeof run.message === 'string' ? run.message : '';
        return `Ghost — heure ${time}\n${actionLabel}` + (message ? `\n${message}` : '');
    }

    function formatConstructionDebugProgress(run) {
        const config = getStoredConfig(7);
        const orders = getConstructionRunOrders(run);
        const orderIndex = getConstructionRunOrderIndex(run, orders);
        const currentOrder = orders[orderIndex];
        const destination = config.namedLinks[currentOrder?.selectedLinkIndex]?.name || 'destination inconnue';
        let actionLabel;

        if (run.status !== 'running') {
            actionLabel = `État : ${run.status}`;
        } else if (Number(run.constructionPendingDelayMs) > 0) {
            actionLabel =
                `Pause après ${run.constructionPendingDelayLabel || 'l’action précédente'} — ` +
                `${(Number(run.constructionPendingDelayMs) / 1000).toFixed(2)} s`;
        } else {
            const labels = {
                'construction-before-open-link': orderIndex === 0
                    ? 'Actions 1–2/6 — paramètres et destination validés'
                    : 'Boucle suivante — reprise à l’action 3/6',
                'construction-open-link': `Action 3/6 — charger ${destination}`,
                'construction-fill-transporters': 'Action 4/6 — saisir les petites voitures',
                'construction-continue': 'Action 4/6 — cliquer sur Continuer',
                'construction-wait-resources-page': 'Action 4/6 — charger la page des ressources',
                'construction-wait-send-page': 'Action 4/6 — charger la page des ressources',
                'construction-fill-resources': 'Action 5/6 — saisir R1, R2 et R3',
                'construction-send': 'Action 6/6 — cliquer sur Envoyer',
                'construction-completed': 'Constructions terminée',
            };
            actionLabel = labels[run.phase] || `Phase inconnue : ${run.phase}`;
        }

        const message = typeof run.message === 'string' ? run.message : '';
        return (
            `Constructions — Boucle ${orderIndex + 1}/${orders.length} — ${destination}\n${actionLabel}\n` +
            `R1 ${formatMillions(currentOrder?.r1)} M · ` +
            `R2 ${formatMillions(currentOrder?.r2)} M · ` +
            `R3 ${formatMillions(currentOrder?.r3)} M` +
            (message ? `\n${message}` : '')
        );
    }

    function getProfileLinkLimit(profileId) {
        return MAX_LINKS_BY_PROFILE[normalizeProfileId(profileId)];
    }

    function getStoredConfig(profileId = 1) {
        const normalizedProfileId = normalizeProfileId(profileId);
        const stored = GM_getValue(CONFIG_KEYS[normalizedProfileId], null);
        if (!stored || typeof stored !== 'object') {
            return { links: [], namedLinks: [], repeat: false, startUrl: '', smallVehicleCount: 6400 };
        }

        const maximum = getProfileLinkLimit(normalizedProfileId);
        const namedLinks = normalizedProfileId === 7
            ? normalizeStoredNamedLinks(stored.namedLinks)
            : [];
        const links = normalizedProfileId === 7
            ? namedLinks.map((entry) => entry.url)
            : Array.isArray(stored.links)
            ? stored.links.filter((value) => typeof value === 'string').slice(0, maximum)
            : [];
        const startUrl = normalizedProfileId === 2 ? validateHttpUrl(stored.startUrl) || '' : '';
        const parsedSmallVehicleCount = parseSmallVehicleCount(stored.smallVehicleCount);
        const smallVehicleCount =
            normalizedProfileId === 2 && parsedSmallVehicleCount !== null
                ? parsedSmallVehicleCount
                : 6400;
        return { links, namedLinks, repeat: Boolean(stored.repeat), startUrl, smallVehicleCount };
    }

    function saveConfig(profileId, config) {
        const normalizedProfileId = normalizeProfileId(profileId);
        if (normalizedProfileId === 7) {
            const namedLinks = normalizeStoredNamedLinks(config.namedLinks);
            GM_setValue(CONFIG_KEYS[normalizedProfileId], {
                namedLinks,
                links: namedLinks.map((entry) => entry.url),
                repeat: false,
                startUrl: '',
                smallVehicleCount: 6400,
            });
            return;
        }

        GM_setValue(CONFIG_KEYS[normalizedProfileId], {
            links: config.links.slice(0, getProfileLinkLimit(normalizedProfileId)),
            repeat: Boolean(config.repeat),
            startUrl:
                normalizedProfileId === 2 ? validateHttpUrl(config.startUrl) || '' : '',
            smallVehicleCount:
                normalizedProfileId === 2
                    ? parseSmallVehicleCount(config.smallVehicleCount) ?? 6400
                    : 6400,
        });

        if (normalizedProfileId === 1) {
            // Nettoyage des clés employées par les anciennes versions du script.
            GM_deleteValue('secretStartUrl');
            GM_deleteValue('secretRessUrl');
            GM_deleteValue('secretTargetUrl');
        }
    }

    function getLegacyLinks() {
        const possibleValues = [
            GM_getValue('secretStartUrl', ''),
            GM_getValue('secretRessUrl', ''),
            GM_getValue('secretTargetUrl', ''),
        ];

        const firstValid = possibleValues.find((value) => validateHttpUrl(value));
        return firstValid ? [validateHttpUrl(firstValid)] : [];
    }

    function parseLinks(text, maximumLinks) {
        const maximum = Math.max(1, Number(maximumLinks) || getProfileLinkLimit(1));
        const rawLinks = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

        if (rawLinks.length < 1) {
            return { links: [], error: 'Ajoutez au moins un lien.' };
        }
        if (rawLinks.length > maximum) {
            return { links: [], error: `Vous pouvez enregistrer au maximum ${maximum} liens.` };
        }

        const links = [];
        for (let index = 0; index < rawLinks.length; index += 1) {
            const normalized = validateHttpUrl(rawLinks[index]);
            if (!normalized) {
                return {
                    links: [],
                    error: `Le lien de la ligne ${index + 1} doit commencer par http:// ou https://.`,
                };
            }
            links.push(normalized);
        }

        return { links, error: '' };
    }

    function parseNamedLinks(rows) {
        const namedLinks = [];
        const usedNames = new Set();
        const sourceRows = Array.isArray(rows) ? rows.slice(0, getProfileLinkLimit(7)) : [];

        for (let index = 0; index < sourceRows.length; index += 1) {
            const name = typeof sourceRows[index]?.name === 'string'
                ? sourceRows[index].name.trim()
                : '';
            const rawUrl = typeof sourceRows[index]?.url === 'string'
                ? sourceRows[index].url.trim()
                : '';
            if (!name && !rawUrl) continue;
            if (!name) {
                return { namedLinks: [], error: `Ajoutez un nom à la destination de la ligne ${index + 1}.` };
            }
            if (!rawUrl) {
                return { namedLinks: [], error: `Ajoutez une URL à la destination « ${name} ».` };
            }

            const url = validateHttpUrl(rawUrl);
            if (!url) {
                return {
                    namedLinks: [],
                    error: `L’URL de « ${name} » doit commencer par http:// ou https://.`,
                };
            }

            const normalizedName = name.toLocaleLowerCase('fr-FR');
            if (usedNames.has(normalizedName)) {
                return { namedLinks: [], error: `Le nom « ${name} » est utilisé plusieurs fois.` };
            }
            usedNames.add(normalizedName);
            namedLinks.push({ name, url });
        }

        if (namedLinks.length === 0) {
            return { namedLinks: [], error: 'Ajoutez au moins une destination avec son nom et son URL.' };
        }
        return { namedLinks, error: '' };
    }

    function normalizeStoredNamedLinks(rows) {
        if (!Array.isArray(rows)) return [];
        const normalized = [];
        const usedNames = new Set();
        for (const row of rows.slice(0, getProfileLinkLimit(7))) {
            const name = typeof row?.name === 'string' ? row.name.trim() : '';
            const url = validateHttpUrl(row?.url);
            const normalizedName = name.toLocaleLowerCase('fr-FR');
            if (!name || !url || usedNames.has(normalizedName)) continue;
            usedNames.add(normalizedName);
            normalized.push({ name, url });
        }
        return normalized;
    }

    function parseConstructionMillions(value) {
        if (value === '' || value === null || value === undefined) return null;
        const normalized = String(value).trim().replace(',', '.');
        if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

        const millions = Number(normalized);
        const baseAmount = Math.round(millions * 1000000);
        if (!Number.isFinite(millions) || millions < 0 || !Number.isSafeInteger(baseAmount)) {
            return null;
        }
        return baseAmount;
    }

    function parseConstructionAmount(value) {
        if (value === '' || value === null || value === undefined) return null;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
        return parsed;
    }

    function getConstructionRunOrders(run) {
        if (Array.isArray(run?.constructionOrders) && run.constructionOrders.length > 0) {
            return run.constructionOrders.slice(0, MAX_CONSTRUCTION_ORDERS);
        }
        return [{
            selectedLinkIndex: Number(run?.currentLinkIndex),
            r1: Number(run?.constructionR1) || 0,
            r2: Number(run?.constructionR2) || 0,
            r3: Number(run?.constructionR3) || 0,
            total: Number(run?.constructionTotal) || 0,
            transporterCount: Number(run?.constructionTransporterCount) || 0,
        }];
    }

    function getConstructionRunOrderIndex(run, orders = getConstructionRunOrders(run)) {
        const index = Math.max(0, Math.floor(Number(run?.constructionOrderIndex) || 0));
        return Math.min(index, Math.max(0, orders.length - 1));
    }

    function formatMillions(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return '0';
        return (parsed / 1000000).toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
        });
    }

    function formatInteger(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed).toLocaleString('fr-FR') : '0';
    }

    function parseSmallVehicleCount(value) {
        if (value === '' || value === null || value === undefined) return null;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
        return parsed;
    }

    function getRunState() {
        const stored = GM_getValue(RUN_KEY, null);
        if (!stored || typeof stored !== 'object') {
            return { profileId: 1, status: 'idle', message: '' };
        }
        return {
            ...stored,
            profileId: normalizeProfileId(stored.profileId),
        };
    }

    function getActiveRun(runId) {
        const run = getRunState();
        return run.runId === runId && run.status === 'running' ? run : null;
    }

    function updateRun(runId, patch) {
        const run = getActiveRun(runId);
        if (!run) return false;

        GM_setValue(RUN_KEY, {
            ...run,
            ...patch,
            updatedAt: Date.now(),
        });
        return true;
    }

    function refreshUi() {
        if (uiPromise) {
            void uiPromise.then((ui) => ui.refresh());
        }
    }

    function navigateToUrl(url, forceReloadWhenCurrent) {
        if (isConfiguredPage(url, window.location.href) && forceReloadWhenCurrent) {
            window.location.reload();
        } else if (!isConfiguredPage(url, window.location.href)) {
            window.location.assign(url);
        } else {
            void resumeAutomationForThisTab();
        }
    }

    function isConfiguredPage(configuredUrl, currentUrl) {
        try {
            const target = new URL(configuredUrl);
            const current = new URL(currentUrl);
            const sameBase =
                target.protocol === current.protocol &&
                target.host === current.host &&
                normalizePath(target.pathname) === normalizePath(current.pathname);
            const compatibleSearch = !target.search || target.search === current.search;
            const compatibleHash = !target.hash || target.hash === current.hash;
            return sameBase && compatibleSearch && compatibleHash;
        } catch {
            return false;
        }
    }

    function validateHttpUrl(value) {
        if (typeof value !== 'string') return null;
        try {
            const url = new URL(value.trim());
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return null;
            }
            return url.href;
        } catch {
            return null;
        }
    }

    function normalizePath(pathname) {
        return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    }

    async function waitForElement(selector, options) {
        if (typeof selector !== 'string' || !selector.trim()) {
            throw new Error('Sélecteur CSS manquant dans une action.');
        }

        const deadline = Date.now() + options.timeoutMs;
        while (Date.now() < deadline) {
            let element;
            try {
                element = document.querySelector(selector);
            } catch {
                throw new Error(`Sélecteur CSS invalide : ${selector}`);
            }

            if (element && isElementVisible(element) && (!options.clickable || isElementClickable(element))) {
                return element;
            }
            await delay(75);
        }

        throw new ElementNotFoundError(selector, options.timeoutMs);
    }

    async function readExpeditionSlots(timeoutMs) {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const element = document.querySelector(EXPEDITION_SLOTS_SELECTOR);
            const text = element ? String(element.innerText || element.textContent || '') : '';
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);

            if (match) {
                const used = Number(match[1]);
                const maximum = Number(match[2]);
                if (
                    Number.isInteger(used) &&
                    Number.isInteger(maximum) &&
                    maximum > 0 &&
                    used >= 0 &&
                    used <= maximum
                ) {
                    return {
                        used,
                        maximum,
                        remaining: maximum - used,
                    };
                }
            }

            await delay(75);
        }

        throw new Error(
            `Impossible de lire les créneaux d’expédition dans ${EXPEDITION_SLOTS_SELECTOR} après ${timeoutMs} ms.`
        );
    }

    async function readLifeformSlots(timeoutMs) {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() < deadline) {
            const usedElement = document.querySelector(LIFEFORM_SLOT_USED_SELECTOR);
            const valueElement = document.querySelector(LIFEFORM_SLOT_VALUE_SELECTOR);
            const usedText = usedElement
                ? String(usedElement.innerText || usedElement.textContent || '').trim()
                : '';
            const valueText = valueElement
                ? String(valueElement.innerText || valueElement.textContent || '').trim()
                : '';
            const used = Number(usedText.replace(/[^\d]/g, ''));
            const maximum = Number(valueText.replace(/[^\d]/g, ''));

            if (
                usedText &&
                valueText &&
                Number.isSafeInteger(used) &&
                Number.isSafeInteger(maximum) &&
                maximum >= 0 &&
                used >= 0 &&
                used <= maximum
            ) {
                return { used, maximum };
            }

            await delay(75);
        }

        throw new Error(
            `Impossible de lire ${LIFEFORM_SLOT_USED_SELECTOR} et ` +
            `${LIFEFORM_SLOT_VALUE_SELECTOR} après ${timeoutMs} ms.`
        );
    }

    function setFormControlValue(element, value) {
        const prototype = Object.getPrototypeOf(element);
        const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'value');

        element.focus();
        if (descriptor?.set) {
            descriptor.set.call(element, value);
        } else {
            element.value = value;
        }

        try {
            element.dispatchEvent(
                new InputEvent('input', {
                    bubbles: true,
                    inputType: 'insertText',
                    data: value,
                })
            );
        } catch {
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        element.dispatchEvent(
            new KeyboardEvent('keyup', {
                bubbles: true,
                key: value.slice(-1) || '0',
            })
        );
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
    }

    function isElementVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity) !== 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function isElementClickable(element) {
        return (
            !element.disabled &&
            element.getAttribute('aria-disabled') !== 'true' &&
            window.getComputedStyle(element).pointerEvents !== 'none'
        );
    }

    async function waitUntilPageUsable(timeoutMs) {
        const startedAt = Date.now();
        const deadline = startedAt + timeoutMs;

        await waitForDocumentReady();

        // Les polices ne doivent pas bloquer l'automatisation sur les pages qui
        // chargent ou modifient continuellement des ressources en arrière-plan.
        if (document.fonts?.ready) {
            await Promise.race([
                Promise.resolve(document.fonts.ready).catch(() => undefined),
                delay(Math.min(750, Math.max(0, deadline - Date.now()))),
            ]);
        }

        await nextAnimationFrame();
        await nextAnimationFrame();

        return {
            timedOut: Date.now() >= deadline,
            elapsedMs: Date.now() - startedAt,
        };
    }

    async function waitUntilRendered({ quietMs, timeoutMs }) {
        const startedAt = Date.now();
        const deadline = startedAt + timeoutMs;

        await waitForWindowLoad(deadline);
        await waitForFonts(deadline);

        let lastActivityAt = Date.now();
        const noteActivity = () => {
            lastActivityAt = Date.now();
        };

        const observer = new MutationObserver(noteActivity);
        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
        });
        window.addEventListener('load', noteActivity, true);
        window.addEventListener('error', noteActivity, true);

        let timedOut = false;
        try {
            while (true) {
                const now = Date.now();
                const imagesReady = getVisibleImages().every((image) => image.complete);
                if (imagesReady && now - lastActivityAt >= quietMs) break;
                if (now >= deadline) {
                    timedOut = true;
                    break;
                }
                await delay(Math.min(100, deadline - now));
            }

            await nextAnimationFrame();
            await nextAnimationFrame();
        } finally {
            observer.disconnect();
            window.removeEventListener('load', noteActivity, true);
            window.removeEventListener('error', noteActivity, true);
        }

        return { timedOut, elapsedMs: Date.now() - startedAt };
    }

    function getVisibleImages() {
        return Array.from(document.images).filter((image) => {
            if (!image.currentSrc && !image.src) return false;
            const rect = image.getBoundingClientRect();
            return (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom >= 0 &&
                rect.right >= 0 &&
                rect.top <= window.innerHeight &&
                rect.left <= window.innerWidth
            );
        });
    }

    function waitForWindowLoad(deadline) {
        if (document.readyState === 'complete') return Promise.resolve();
        return waitForEventOrDeadline(window, 'load', deadline);
    }

    async function waitForFonts(deadline) {
        if (!document.fonts?.ready) return;
        await raceWithDeadline(document.fonts.ready, deadline);
    }

    function waitForEventOrDeadline(target, eventName, deadline) {
        return new Promise((resolve) => {
            const remainingMs = Math.max(0, deadline - Date.now());
            let timerId;
            const finish = () => {
                target.removeEventListener(eventName, finish);
                window.clearTimeout(timerId);
                resolve();
            };
            target.addEventListener(eventName, finish, { once: true });
            timerId = window.setTimeout(finish, remainingMs);
        });
    }

    function raceWithDeadline(promise, deadline) {
        return Promise.race([
            Promise.resolve(promise).catch(() => undefined),
            delay(Math.max(0, deadline - Date.now())),
        ]);
    }

    function waitForPageExit(timeoutMs) {
        return new Promise((resolve) => {
            let timerId;
            const finish = (didExit) => {
                window.removeEventListener('pagehide', onExit);
                window.removeEventListener('beforeunload', onExit);
                window.clearTimeout(timerId);
                resolve(didExit);
            };
            const onExit = () => finish(true);
            window.addEventListener('pagehide', onExit, { once: true });
            window.addEventListener('beforeunload', onExit, { once: true });
            timerId = window.setTimeout(() => finish(false), timeoutMs);
        });
    }

    function waitForDocumentReady() {
        if (document.readyState !== 'loading') return Promise.resolve();
        return new Promise((resolve) => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    function delay(milliseconds) {
        return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    }

    function getSecureRandomIndex(itemCount) {
        const count = Math.floor(Number(itemCount));
        if (!Number.isFinite(count) || count < 1) {
            throw new Error('Impossible de choisir un lien dans une liste vide.');
        }

        if (globalThis.crypto?.getRandomValues) {
            const range = 0x100000000;
            const unbiasedLimit = range - (range % count);
            const values = new Uint32Array(1);
            let value;
            do {
                globalThis.crypto.getRandomValues(values);
                value = values[0];
            } while (value >= unbiasedLimit);
            return value % count;
        }

        return Math.floor(Math.random() * count);
    }

    function getSecureRandomFraction() {
        if (globalThis.crypto?.getRandomValues) {
            const values = new Uint32Array(1);
            globalThis.crypto.getRandomValues(values);
            return values[0] / 0x100000000;
        }
        return Math.random();
    }

    function getRandomDelayMs(minimumMs, maximumMs) {
        const minimum = scaleActionDelayMs(minimumMs);
        const maximum = Math.max(minimum, scaleActionDelayMs(maximumMs));
        return Math.round(minimum + getSecureRandomFraction() * (maximum - minimum));
    }

    function scaleActionDelayMs(delayMs) {
        return Math.max(0, Math.round((Number(delayMs) || 0) * ACTION_DELAY_FACTOR));
    }

    function nextAnimationFrame() {
        return new Promise((resolve) => window.requestAnimationFrame(resolve));
    }

    function createRunId() {
        if (typeof globalThis.crypto?.randomUUID === 'function') {
            return globalThis.crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function getTabData() {
        return new Promise((resolve) => {
            GM_getTab((tab) => resolve(tab && typeof tab === 'object' ? tab : {}));
        });
    }

    async function getThisTabRunId() {
        const tab = await getTabData();
        return tab[TAB_RUN_ID_KEY] || '';
    }

    async function setThisTabRunId(runId) {
        const tab = await getTabData();
        tab[TAB_RUN_ID_KEY] = runId;
        await saveTabData(tab);
    }

    async function clearThisTabRunId(runId) {
        const tab = await getTabData();
        if (!runId || tab[TAB_RUN_ID_KEY] === runId) {
            delete tab[TAB_RUN_ID_KEY];
            await saveTabData(tab);
        }
    }

    function saveTabData(tab) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            try {
                GM_saveTab(tab, finish);
                // Compatibilité avec les versions où le callback optionnel
                // n'est pas invoqué bien que l'enregistrement soit effectué.
                window.setTimeout(finish, 50);
            } catch (error) {
                reject(error);
            }
        });
    }
})();
