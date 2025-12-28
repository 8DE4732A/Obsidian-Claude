/**
 * Environment variable entry
 */
export interface EnvVariable {
    key: string;
    value: string;
}

/**
 * Plugin settings interface
 */
export interface ClaudeAgentSettings {
    // Environment Variables (for API key, model, and third-party providers)
    envVariables: EnvVariable[];

    // System Prompt
    systemPrompt: string;

    // UI Settings
    showToolResults: boolean;
    autoScrollMessages: boolean;

    // Session Settings
    maxSessionHistory: number;

    // Tool Permissions (maps to Claude Code built-in tools)
    enableFileRead: boolean;    // Read, Glob, Grep
    enableFileEdit: boolean;    // Edit
    enableFileCreate: boolean;  // Write
    enableSearch: boolean;      // Grep (already included with Read)
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: ClaudeAgentSettings = {
    envVariables: [],

    systemPrompt: '',

    showToolResults: true,
    autoScrollMessages: true,

    maxSessionHistory: 50,

    enableFileRead: true,
    enableFileEdit: true,
    enableFileCreate: true,
    enableSearch: true
};
