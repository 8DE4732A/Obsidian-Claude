// Polyfill for Node.js/Electron compatibility with AbortSignal
// The Claude Agent SDK uses events.setMaxListeners with AbortSignal,
// which isn't fully supported in Electron's Node.js environment
(function patchEventsModule() {
    try {
        const events = require('events');
        const originalSetMaxListeners = events.setMaxListeners;
        if (originalSetMaxListeners) {
            events.setMaxListeners = function(n: number, ...eventTargets: any[]) {
                // Filter out AbortSignal instances that aren't proper EventEmitters
                const validTargets = eventTargets.filter((target: any) => {
                    if (!target) return false;
                    // Check if it's a proper EventEmitter
                    if (target instanceof events.EventEmitter) return true;
                    // Check if it has EventEmitter methods (duck typing)
                    if (typeof target.on === 'function' &&
                        typeof target.removeListener === 'function') return true;
                    // Skip AbortSignal and other non-EventEmitter objects
                    return false;
                });

                if (validTargets.length > 0) {
                    return originalSetMaxListeners.call(events, n, ...validTargets);
                }
                // If no valid targets, just return without error
                return undefined;
            };
        }
    } catch (e) {
        console.warn('Failed to patch events module:', e);
    }
})();

import { Plugin, WorkspaceLeaf } from 'obsidian';
import { ChatView, VIEW_TYPE_CHAT } from './views/ChatView';
import { ClaudeAgentSettingsTab } from './settings/SettingsTab';
import { AgentService } from './services/AgentService';
import { SessionManager } from './services/SessionManager';
import { DEFAULT_SETTINGS, ClaudeAgentSettings } from './settings/SettingsSchema';

export default class ClaudeAgentPlugin extends Plugin {
    settings!: ClaudeAgentSettings;
    agentService!: AgentService;
    sessionManager!: SessionManager;

    async onload() {
        console.log('Loading Claude Code plugin');

        // Load settings
        await this.loadSettings();

        // Initialize services
        this.sessionManager = new SessionManager(this);
        this.agentService = new AgentService(this);

        // Register the chat view
        this.registerView(
            VIEW_TYPE_CHAT,
            (leaf) => new ChatView(leaf, this)
        );

        // Add ribbon icon to open chat
        this.addRibbonIcon('message-circle', 'Open Claude Chat', () => {
            this.activateChatView();
        });

        // Add command to open chat
        this.addCommand({
            id: 'open-claude-chat',
            name: 'Open Claude Code Chat',
            callback: () => this.activateChatView()
        });

        // Add command to create new session
        this.addCommand({
            id: 'new-claude-session',
            name: 'New Claude Chat Session',
            callback: async () => {
                await this.sessionManager.createNewSession();
                await this.activateChatView();
            }
        });

        // Register settings tab
        this.addSettingTab(new ClaudeAgentSettingsTab(this.app, this));
    }

    async onunload() {
        console.log('Unloading Claude Code plugin');

        // Cleanup agent service
        await this.agentService?.cleanup();

        // Detach all chat views
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
    }

    /**
     * Activate or create the chat view in the right sidebar
     */
    async activateChatView(): Promise<void> {
        const { workspace } = this.app;

        // Check if view already exists
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];

        if (!leaf) {
            // Create new leaf in right sidebar
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VIEW_TYPE_CHAT,
                    active: true
                });
                leaf = rightLeaf;
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    /**
     * Load plugin settings
     */
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    /**
     * Save plugin settings
     */
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // Reset client when settings change (in case API key changed)
        this.agentService?.resetClient();
    }
}
