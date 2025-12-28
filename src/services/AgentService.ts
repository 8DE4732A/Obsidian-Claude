import {
    query,
    type SDKMessage,
    type SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk';
import type ClaudeAgentPlugin from '../main';
import type { AgentResponse, StreamUpdateCallback, ToolResult } from '../types';

// Helper to extract text from assistant messages
function getAssistantText(msg: SDKMessage): string | null {
    if (msg.type !== 'assistant') return null;
    return msg.message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
}

export class AgentService {
    private plugin: ClaudeAgentPlugin;

    constructor(plugin: ClaudeAgentPlugin) {
        this.plugin = plugin;
    }

    /**
     * Get the vault path as working directory
     */
    private getVaultPath(): string {
        // Get the vault's base path from FileSystemAdapter
        const adapter = this.plugin.app.vault.adapter as any;

        // Try different ways to get the base path
        if (adapter.basePath && typeof adapter.basePath === 'string') {
            console.log('Using adapter.basePath:', adapter.basePath);
            return adapter.basePath;
        }

        // Try getBasePath method if available
        if (typeof adapter.getBasePath === 'function') {
            const path = adapter.getBasePath();
            if (path && typeof path === 'string') {
                console.log('Using adapter.getBasePath():', path);
                return path;
            }
        }

        // Try to get from vault name and standard Obsidian paths
        const vaultName = this.plugin.app.vault.getName();
        if (vaultName) {
            // Common Obsidian vault locations
            const possiblePaths = [
                `${process.env.HOME}/Documents/${vaultName}`,
                `${process.env.HOME}/${vaultName}`,
                `${process.env.USERPROFILE}/Documents/${vaultName}`,
                `${process.env.USERPROFILE}/${vaultName}`
            ];

            for (const p of possiblePaths) {
                if (p && !p.includes('undefined')) {
                    console.log('Trying vault path:', p);
                    return p;
                }
            }
        }

        // Last resort: use current working directory or home
        const fallback = process.cwd?.() || process.env.HOME || process.env.USERPROFILE || '/';
        console.warn('Could not determine vault path, using fallback:', fallback);
        return fallback;
    }

    /**
     * Get system prompt
     */
    private getSystemPrompt(): string {
        if (this.plugin.settings.systemPrompt) {
            return this.plugin.settings.systemPrompt;
        }

        return `You are Claude, an AI assistant integrated into Obsidian - a powerful knowledge management and note-taking application.

You have access to tools that allow you to read, edit, create, and search files in the user's Obsidian vault.

When helping users with their notes:
1. Be helpful and concise
2. When editing files, always show what changes you're making
3. Respect the user's existing note structure and formatting
4. Use Obsidian-compatible markdown syntax (including [[wiki links]], #tags, etc.)
5. Ask for clarification if the user's request is ambiguous

You are working in the user's Obsidian vault directory. All file paths are relative to the vault root.`;
    }

    /**
     * Get allowed tools based on settings
     */
    private getAllowedTools(): string[] {
        const tools: string[] = [];
        const settings = this.plugin.settings;

        // Always allow read-only tools if file read is enabled
        if (settings.enableFileRead) {
            tools.push('Read', 'Glob', 'Grep');
        }

        // Edit tool
        if (settings.enableFileEdit) {
            tools.push('Edit');
        }

        // Write/Create tool
        if (settings.enableFileCreate) {
            tools.push('Write');
        }

        // Search tools (already included with Read via Glob/Grep)
        if (settings.enableSearch && !tools.includes('Grep')) {
            tools.push('Grep');
        }

        return tools;
    }

    /**
     * Build environment variables object from settings
     */
    private getEnvVariables(): Record<string, string | undefined> {
        const env: Record<string, string | undefined> = { ...process.env };

        // Add custom environment variables from settings
        for (const envVar of this.plugin.settings.envVariables) {
            if (envVar.key && envVar.value) {
                env[envVar.key] = envVar.value;
            }
        }

        return env;
    }

    /**
     * Get model from environment variables
     */
    private getModel(): string | undefined {
        // Check settings env vars first
        const modelEnv = this.plugin.settings.envVariables.find(
            env => env.key === 'CLAUDE_MODEL'
        );
        if (modelEnv?.value) {
            return modelEnv.value;
        }

        // Fall back to process.env
        return process.env.CLAUDE_MODEL;
    }

    /**
     * Get Claude Code executable path
     */
    private getClaudeCodePath(): string | undefined {
        // Check settings env vars first
        const pathEnv = this.plugin.settings.envVariables.find(
            env => env.key === 'CLAUDE_CODE_PATH'
        );
        if (pathEnv?.value) {
            return pathEnv.value;
        }

        // Check process.env
        if (process.env.CLAUDE_CODE_PATH) {
            return process.env.CLAUDE_CODE_PATH;
        }

        // Try common installation paths
        const fs = require('fs');
        const path = require('path');
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        const possiblePaths = [
            // User local bin (common for pip/pipx installs)
            path.join(homeDir, '.local/bin/claude'),
            // npm global install locations
            '/usr/local/bin/claude',
            '/usr/bin/claude',
            path.join(homeDir, '.npm-global/bin/claude'),
            path.join(homeDir, 'node_modules/.bin/claude'),
            // macOS Homebrew
            '/opt/homebrew/bin/claude',
            // Windows
            path.join(homeDir, 'AppData/Roaming/npm/claude.cmd'),
            path.join(homeDir, 'AppData/Roaming/npm/claude'),
            // nvm installations
            path.join(homeDir, '.nvm/versions/node', process.version || '', 'bin/claude'),
        ];

        for (const p of possiblePaths) {
            try {
                if (fs.existsSync(p)) {
                    console.log('Found Claude Code at:', p);
                    return p;
                }
            } catch (e) {
                // Ignore errors
            }
        }

        return undefined;
    }

    /**
     * Reset client (no-op for this implementation)
     */
    resetClient(): void {
        // No persistent client to reset
    }

    /**
     * Send a message and get a response
     */
    async sendMessage(
        content: string,
        sessionId: string,
        onStreamUpdate?: StreamUpdateCallback
    ): Promise<AgentResponse> {
        const allowedTools = this.getAllowedTools();
        const envVariables = this.getEnvVariables();
        const model = this.getModel();
        const claudeCodePath = this.getClaudeCodePath();
        const toolResults: ToolResult[] = [];
        let responseContent = '';
        let sdkSessionId = '';

        try {
            const vaultPath = this.getVaultPath();
            console.log('Vault path for query:', vaultPath);
            console.log('Claude Code path:', claudeCodePath);

            // Build query options
            const queryOptions: any = {
                systemPrompt: this.getSystemPrompt(),
                cwd: vaultPath,
                allowedTools: allowedTools,
                permissionMode: 'acceptEdits',
                persistSession: false,
                env: envVariables
            };

            // Add Claude Code executable path if found
            if (claudeCodePath) {
                queryOptions.pathToClaudeCodeExecutable = claudeCodePath;
            }

            // Only add model if specified
            if (model) {
                queryOptions.model = model;
            }

            // Use query API with vault as working directory
            const q = query({
                prompt: content,
                options: queryOptions
            });

            // Iterate through the async generator
            for await (const msg of q) {
                sdkSessionId = msg.session_id;

                // Handle streaming text updates
                if (msg.type === 'stream_event') {
                    const event = msg.event;
                    if (event.type === 'content_block_delta' &&
                        'delta' in event &&
                        event.delta.type === 'text_delta') {
                        const textDelta = (event.delta as any).text;
                        if (textDelta && onStreamUpdate) {
                            responseContent += textDelta;
                            onStreamUpdate(responseContent);
                        }
                    }
                }

                // Extract full text from assistant messages
                const text = getAssistantText(msg);
                if (text) {
                    responseContent = text;
                    if (onStreamUpdate) {
                        onStreamUpdate(text);
                    }
                }

                // Check for tool use in assistant messages
                if (msg.type === 'assistant') {
                    const toolUseBlocks = msg.message.content.filter(
                        (block: any) => block.type === 'tool_use'
                    );

                    for (const toolUse of toolUseBlocks) {
                        toolResults.push({
                            tool: (toolUse as any).name,
                            input: (toolUse as any).input,
                            output: 'Executed',
                            isError: false
                        });
                    }
                }

                // Check for result message
                if (msg.type === 'result') {
                    const resultMsg = msg as SDKResultMessage;
                    if (resultMsg.subtype === 'success' && resultMsg.result) {
                        responseContent = resultMsg.result;
                    }
                }
            }

            return {
                content: responseContent,
                sessionId: sdkSessionId || sessionId,
                toolResults: toolResults.length > 0 ? toolResults : undefined
            };

        } catch (error) {
            console.error('Agent service error:', error);
            throw error;
        }
    }

    /**
     * Clear conversation history for a session
     */
    clearHistory(sessionId: string): void {
        // SDK manages history internally
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        // No persistent resources to clean up
    }
}
