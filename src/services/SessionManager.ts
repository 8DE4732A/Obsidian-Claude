import { v4 as uuidv4 } from 'uuid';
import type ClaudeAgentPlugin from '../main';
import { ChatSession, ChatMessage, UsageStats } from '../types';

const SESSIONS_KEY = 'claude-agent-sessions';

// Default empty usage stats
const DEFAULT_USAGE: UsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0
};

export class SessionManager {
    private plugin: ClaudeAgentPlugin;
    private sessions: Map<string, ChatSession> = new Map();
    private loaded = false;

    constructor(plugin: ClaudeAgentPlugin) {
        this.plugin = plugin;
    }

    /**
     * Ensure sessions are loaded from storage
     */
    private async ensureLoaded(): Promise<void> {
        if (this.loaded) return;
        await this.loadAllSessions();
        this.loaded = true;
    }

    /**
     * Load all sessions from plugin data
     */
    private async loadAllSessions(): Promise<void> {
        const data = await this.plugin.loadData();
        const sessionsData: ChatSession[] = data?.[SESSIONS_KEY] || [];

        this.sessions.clear();
        sessionsData.forEach((session: ChatSession) => {
            // Ensure usage field exists for legacy sessions
            if (!session.usage) {
                session.usage = { ...DEFAULT_USAGE };
            }
            this.sessions.set(session.id, session);
        });
    }

    /**
     * Persist sessions to plugin data
     */
    private async persistSessions(): Promise<void> {
        const maxSessions = this.plugin.settings.maxSessionHistory;
        const data = (await this.plugin.loadData()) || {};

        // Sort by updated time and limit to max
        const sessionsArray = Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, maxSessions);

        data[SESSIONS_KEY] = sessionsArray;
        await this.plugin.saveData(data);
    }

    /**
     * Create a new chat session
     */
    async createNewSession(): Promise<ChatSession> {
        await this.ensureLoaded();

        const session: ChatSession = {
            id: uuidv4(),
            sessionId: null,
            title: 'New Conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            usage: { ...DEFAULT_USAGE }
        };

        this.sessions.set(session.id, session);
        await this.persistSessions();

        return session;
    }

    /**
     * Load a specific session by ID
     */
    async loadSession(id: string): Promise<ChatSession | null> {
        await this.ensureLoaded();
        return this.sessions.get(id) || null;
    }

    /**
     * Save/update a session
     */
    async saveSession(session: ChatSession): Promise<void> {
        await this.ensureLoaded();

        // Auto-generate title from first user message if still default
        if (session.title === 'New Conversation' && session.messages.length > 0) {
            const firstUserMsg = session.messages.find(m => m.role === 'user');
            if (firstUserMsg) {
                const title = firstUserMsg.content.slice(0, 50);
                session.title = title + (firstUserMsg.content.length > 50 ? '...' : '');
            }
        }

        session.updatedAt = Date.now();
        this.sessions.set(session.id, session);
        await this.persistSessions();
    }

    /**
     * Delete a session
     */
    async deleteSession(id: string): Promise<void> {
        await this.ensureLoaded();
        this.sessions.delete(id);
        await this.persistSessions();
    }

    /**
     * Get all sessions sorted by update time
     */
    async getAllSessions(): Promise<ChatSession[]> {
        await this.ensureLoaded();
        return Array.from(this.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Rename a session
     */
    async renameSession(id: string, newTitle: string): Promise<void> {
        await this.ensureLoaded();
        const session = this.sessions.get(id);
        if (session) {
            session.title = newTitle;
            session.updatedAt = Date.now();
            await this.persistSessions();
        }
    }

    /**
     * Add a message to a session
     */
    async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
        await this.ensureLoaded();
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages.push(message);
            session.updatedAt = Date.now();
            await this.persistSessions();
        }
    }

    /**
     * Update SDK session ID for a local session
     */
    async updateSdkSessionId(localId: string, sdkSessionId: string): Promise<void> {
        await this.ensureLoaded();
        const session = this.sessions.get(localId);
        if (session) {
            session.sessionId = sdkSessionId;
            await this.persistSessions();
        }
    }

    /**
     * Update usage statistics for a session
     */
    async updateUsage(sessionId: string, usage: UsageStats): Promise<void> {
        await this.ensureLoaded();
        const session = this.sessions.get(sessionId);
        if (session) {
            // Accumulate usage
            session.usage.inputTokens += usage.inputTokens;
            session.usage.outputTokens += usage.outputTokens;
            session.usage.totalTokens += usage.totalTokens;
            session.usage.estimatedCost += usage.estimatedCost;
            await this.persistSessions();
        }
    }
}
