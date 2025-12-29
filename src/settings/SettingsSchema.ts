/**
 * Environment variable entry
 */
export interface EnvVariable {
    key: string;
    value: string;
}

/**
 * Environment variable template
 */
export interface EnvTemplate {
    id: string;
    name: string;
    envVariables: EnvVariable[];
}

/**
 * Plugin settings interface
 */
export interface ClaudeAgentSettings {
    // Environment Variable Templates
    envTemplates: EnvTemplate[];
    activeTemplateId: string | null;

    // Legacy: Environment Variables (for migration)
    envVariables: EnvVariable[];

    // System Prompt
    systemPrompt: string;

    // UI Settings
    showToolResults: boolean;
    autoScrollMessages: boolean;
    chatFontSize: number;  // Font size in pixels (12-20)

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
    envTemplates: [],
    activeTemplateId: null,
    envVariables: [],

    systemPrompt: '',

    showToolResults: true,
    autoScrollMessages: true,
    chatFontSize: 14,

    maxSessionHistory: 50,

    enableFileRead: true,
    enableFileEdit: true,
    enableFileCreate: true,
    enableSearch: true
};
