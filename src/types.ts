/**
 * Represents a single chat message
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolResults?: ToolResult[];
    context?: ContextItem[];       // Attached context for this message
    editorContext?: EditorContext; // Editor context when message was sent
}

/**
 * Result from a tool execution
 */
export interface ToolResult {
    tool: string;
    input: Record<string, unknown>;
    output: string;
    isError: boolean;
    id?: string;  // tool_use id for matching with tool_result
}

/**
 * Usage statistics for API calls
 */
export interface UsageStats {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;  // USD
}

/**
 * Slash command definition
 */
export interface SlashCommand {
    name: string;           // e.g., "/compact"
    description?: string;   // Optional description
}

/**
 * Type of context item
 */
export type ContextItemType = 'file' | 'directory' | 'selection' | 'activeFile';

/**
 * Represents a context item attached to a message
 */
export interface ContextItem {
    id: string;
    type: ContextItemType;
    path: string;
    displayName: string;
    content?: string;              // For selection text or file content
    isAutoIncluded?: boolean;      // True for active file/selection
}

/**
 * File/folder item for the picker menu
 */
export interface VaultItem {
    path: string;
    name: string;
    isFolder: boolean;
    extension?: string;
}

/**
 * Context state for the chat input
 */
export interface ContextState {
    items: ContextItem[];
    activeFilePath: string | null;
    selectedText: string | null;
}

/**
 * Editor context showing current file and selection
 */
export interface EditorContext {
    activeFile: string | null;       // Current file path
    selectionStart: number | null;   // Starting line number (1-based)
    selectionEnd: number | null;     // Ending line number (1-based)
    selectedText: string | null;     // The actual selected text
}

/**
 * Represents a chat session with history
 */
export interface ChatSession {
    id: string;                    // Local session ID (UUID)
    sessionId: string | null;      // Claude SDK session ID (for resumption)
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    usage: UsageStats;             // Cumulative usage for this session
}

/**
 * Response from sending a message to the agent
 */
export interface AgentResponse {
    content: string;
    sessionId: string;
    toolResults?: ToolResult[];
    usage?: UsageStats;            // Usage for this specific response
}

/**
 * Callback for streaming message updates
 */
export type StreamUpdateCallback = (content: string) => void;
