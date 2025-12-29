import {
    query,
    type SDKMessage,
    type SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk';
import type ClaudeAgentPlugin from '../main';
import type { AgentResponse, StreamUpdateCallback, ToolResult, SlashCommand, UsageStats } from '../types';

// Pricing per 1M tokens (USD) - Claude 3.5 Sonnet as default
const DEFAULT_INPUT_PRICE = 3.00;   // $3 per 1M input tokens
const DEFAULT_OUTPUT_PRICE = 15.00; // $15 per 1M output tokens

// Helper to extract text from assistant messages
function getAssistantText(msg: SDKMessage): string | null {
    if (msg.type !== 'assistant') return null;
    return msg.message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
}

// Calculate estimated cost based on token usage
function calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * DEFAULT_INPUT_PRICE;
    const outputCost = (outputTokens / 1_000_000) * DEFAULT_OUTPUT_PRICE;
    return inputCost + outputCost;
}

// Default slash commands available in Claude Code
const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
    { name: '/compact', description: 'Compact conversation history to save tokens' },
    { name: '/clear', description: 'Clear conversation and start fresh' },
    { name: '/help', description: 'Show available commands and help' },
    { name: '/init', description: 'Initialize with CLAUDE.md instructions' },
    { name: '/terminal-setup', description: 'Set up terminal integration' },
    { name: '/mcp', description: 'Manage MCP servers' },
    { name: '/permissions', description: 'Manage tool permissions' },
    { name: '/review', description: 'Review recent changes' },
    { name: '/pr-comments', description: 'View PR comments' },
    { name: '/memory', description: 'Manage project memory' },
    { name: '/config', description: 'Show configuration' },
    { name: '/cost', description: 'Show session cost and usage' },
    { name: '/doctor', description: 'Run diagnostic checks' },
    { name: '/logout', description: 'Log out of current account' },
];

export class AgentService {
    private plugin: ClaudeAgentPlugin;
    private availableCommands: SlashCommand[] = [...DEFAULT_SLASH_COMMANDS];

    constructor(plugin: ClaudeAgentPlugin) {
        this.plugin = plugin;
    }

    /**
     * Get available slash commands
     */
    getSlashCommands(): SlashCommand[] {
        return this.availableCommands;
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

        // Get active template's environment variables
        const activeTemplateId = this.plugin.settings.activeTemplateId;
        if (activeTemplateId) {
            const activeTemplate = this.plugin.settings.envTemplates.find(
                t => t.id === activeTemplateId
            );
            if (activeTemplate) {
                for (const envVar of activeTemplate.envVariables) {
                    if (envVar.key && envVar.value) {
                        env[envVar.key] = envVar.value;
                    }
                }
            }
        }

        // Fallback: also check legacy envVariables for backward compatibility
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
        // Check active template env vars first
        const activeTemplateId = this.plugin.settings.activeTemplateId;
        if (activeTemplateId) {
            const activeTemplate = this.plugin.settings.envTemplates.find(
                t => t.id === activeTemplateId
            );
            if (activeTemplate) {
                const modelEnv = activeTemplate.envVariables.find(
                    env => env.key === 'CLAUDE_MODEL'
                );
                if (modelEnv?.value) {
                    return modelEnv.value;
                }
            }
        }

        // Check legacy settings env vars
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
        // Check active template env vars first
        const activeTemplateId = this.plugin.settings.activeTemplateId;
        if (activeTemplateId) {
            const activeTemplate = this.plugin.settings.envTemplates.find(
                t => t.id === activeTemplateId
            );
            if (activeTemplate) {
                const pathEnv = activeTemplate.envVariables.find(
                    env => env.key === 'CLAUDE_CODE_PATH'
                );
                if (pathEnv?.value) {
                    return pathEnv.value;
                }
            }
        }

        // Check legacy settings env vars
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
        let usage: UsageStats | undefined;

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

                // Debug: log all message types
                console.log('SDK message:', msg.type, (msg as any).subtype || '', msg);

                // Handle system init message - extract slash commands
                if (msg.type === 'system' && (msg as any).subtype === 'init') {
                    const initMsg = msg as any;
                    if (initMsg.slash_commands && Array.isArray(initMsg.slash_commands)) {
                        this.availableCommands = initMsg.slash_commands.map((cmd: string) => {
                            // Ensure command has leading slash
                            const name = cmd.startsWith('/') ? cmd : `/${cmd}`;
                            return {
                                name,
                                description: this.getCommandDescription(name)
                            };
                        });
                        console.log('Available slash commands:', this.availableCommands);
                    }
                    // /clear command returns init message
                    if (!responseContent) {
                        responseContent = 'Conversation cleared. Starting fresh session.';
                    }
                }

                // Handle system messages for slash command results
                if (msg.type === 'system') {
                    const sysMsg = msg as any;

                    // /compact command
                    if (sysMsg.subtype === 'compact_boundary') {
                        const metadata = sysMsg.compact_metadata || {};
                        responseContent = `Conversation compacted.\n` +
                            `Pre-compaction tokens: ${metadata.pre_tokens || 'N/A'}\n` +
                            `Trigger: ${metadata.trigger || 'manual'}`;
                    }

                    // Handle other system messages that might contain text
                    if (sysMsg.message && typeof sysMsg.message === 'string') {
                        responseContent = sysMsg.message;
                    }

                    // Handle system messages with content array
                    if (sysMsg.content && Array.isArray(sysMsg.content)) {
                        const textContent = sysMsg.content
                            .filter((block: any) => block.type === 'text')
                            .map((block: any) => block.text)
                            .join('');
                        if (textContent) {
                            responseContent = textContent;
                        }
                    }
                }

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
                            output: '', // Will be filled by tool_result message
                            isError: false,
                            id: (toolUse as any).id // Track tool_use id
                        });
                    }

                    // Extract usage from assistant message if available
                    if ((msg.message as any).usage) {
                        const msgUsage = (msg.message as any).usage;
                        const inputTokens = msgUsage.input_tokens || 0;
                        const outputTokens = msgUsage.output_tokens || 0;
                        usage = {
                            inputTokens,
                            outputTokens,
                            totalTokens: inputTokens + outputTokens,
                            estimatedCost: calculateCost(inputTokens, outputTokens)
                        };
                    }
                }

                // Handle tool result/progress messages - capture actual tool output
                const msgType = (msg as any).type;
                if (msgType === 'tool_result' || msgType === 'tool_progress') {
                    const toolResultMsg = msg as any;
                    const toolUseId = toolResultMsg.tool_use_id;

                    // Find the matching tool_use and update its output
                    const matchingTool = toolResults.find((t: any) => t.id === toolUseId);
                    if (matchingTool) {
                        // Extract output content
                        if (toolResultMsg.content) {
                            if (typeof toolResultMsg.content === 'string') {
                                matchingTool.output = toolResultMsg.content;
                            } else if (Array.isArray(toolResultMsg.content)) {
                                matchingTool.output = toolResultMsg.content
                                    .filter((block: any) => block.type === 'text')
                                    .map((block: any) => block.text)
                                    .join('');
                            }
                        }
                        // Also check for output field
                        if (toolResultMsg.output) {
                            matchingTool.output = typeof toolResultMsg.output === 'string'
                                ? toolResultMsg.output
                                : JSON.stringify(toolResultMsg.output, null, 2);
                        }
                        matchingTool.isError = toolResultMsg.is_error || false;
                    }
                }

                // Handle user messages with local command output or tool results
                if (msg.type === 'user') {
                    const userMsg = msg as any;
                    if (userMsg.message?.content) {
                        const content = userMsg.message.content;

                        // Handle string content with local-command-stdout tags
                        if (typeof content === 'string') {
                            const stdoutMatch = content.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/);
                            if (stdoutMatch) {
                                responseContent = stdoutMatch[1].trim();
                            }
                        }

                        // Handle array content (tool_result blocks)
                        if (Array.isArray(content)) {
                            for (const block of content) {
                                if (block.type === 'tool_result') {
                                    const toolUseId = block.tool_use_id;
                                    const matchingTool = toolResults.find((t: any) => t.id === toolUseId);
                                    if (matchingTool) {
                                        if (typeof block.content === 'string') {
                                            matchingTool.output = block.content;
                                        } else if (Array.isArray(block.content)) {
                                            matchingTool.output = block.content
                                                .filter((b: any) => b.type === 'text')
                                                .map((b: any) => b.text)
                                                .join('');
                                        }
                                        matchingTool.isError = block.is_error || false;
                                    }
                                }
                            }
                        }
                    }
                }

                // Check for result message
                if (msg.type === 'result') {
                    const resultMsg = msg as any;

                    // Try to extract content from various fields
                    if (resultMsg.result && resultMsg.result !== '') {
                        responseContent = typeof resultMsg.result === 'string'
                            ? resultMsg.result
                            : JSON.stringify(resultMsg.result, null, 2);
                    }

                    // Extract usage from result message if available
                    if (resultMsg.usage) {
                        const resultUsage = resultMsg.usage;
                        const inputTokens = resultUsage.input_tokens || 0;
                        const outputTokens = resultUsage.output_tokens || 0;
                        usage = {
                            inputTokens,
                            outputTokens,
                            totalTokens: inputTokens + outputTokens,
                            estimatedCost: calculateCost(inputTokens, outputTokens)
                        };
                    }
                }
            }

            return {
                content: responseContent,
                sessionId: sdkSessionId || sessionId,
                toolResults: toolResults.length > 0 ? toolResults : undefined,
                usage
            };

        } catch (error) {
            console.error('Agent service error:', error);
            throw error;
        }
    }

    /**
     * Get description for built-in slash commands
     */
    private getCommandDescription(command: string): string {
        const descriptions: Record<string, string> = {
            '/compact': 'Compact conversation history to save tokens',
            '/clear': 'Clear conversation and start fresh',
            '/help': 'Show available commands and help'
        };
        return descriptions[command] || '';
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
