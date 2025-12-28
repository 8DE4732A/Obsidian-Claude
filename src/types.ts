/**
 * Represents a single chat message
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolResults?: ToolResult[];
}

/**
 * Result from a tool execution
 */
export interface ToolResult {
    tool: string;
    input: Record<string, unknown>;
    output: string;
    isError: boolean;
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
}

/**
 * Response from sending a message to the agent
 */
export interface AgentResponse {
    content: string;
    sessionId: string;
    toolResults?: ToolResult[];
}

/**
 * Callback for streaming message updates
 */
export type StreamUpdateCallback = (content: string) => void;
