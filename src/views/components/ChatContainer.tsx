import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App, MarkdownView } from 'obsidian';
import type ClaudeAgentPlugin from '../../main';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SessionSelector } from './SessionSelector';
import { EditorContextIndicator } from './EditorContextIndicator';
import { ChatMessage, ChatSession, SlashCommand, EditorContext } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { v4 as uuidv4 } from 'uuid';

interface ChatContainerProps {
    plugin: ClaudeAgentPlugin;
    app: App;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ plugin, app }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState<string>('');
    const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
    const [editorContext, setEditorContext] = useState<EditorContext>({
        activeFile: null,
        selectionStart: null,
        selectionEnd: null,
        selectedText: null
    });
    const lastEditorContextRef = useRef<EditorContext | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Get current editor context
    const updateEditorContext = useCallback(() => {
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);

        // If no markdown view is active, keep the last known context
        // This happens when user clicks on chat input
        if (!activeView || !activeView.file) {
            // Don't clear - keep the last context
            return;
        }

        const editor = activeView.editor;
        const selection = editor.getSelection();

        let newContext: EditorContext;
        if (selection) {
            const from = editor.getCursor('from');
            const to = editor.getCursor('to');
            newContext = {
                activeFile: activeView.file.path,
                selectionStart: from.line + 1, // Convert to 1-based
                selectionEnd: to.line + 1,
                selectedText: selection
            };
        } else {
            newContext = {
                activeFile: activeView.file.path,
                selectionStart: null,
                selectionEnd: null,
                selectedText: null
            };
        }

        // Store and update
        lastEditorContextRef.current = newContext;
        setEditorContext(newContext);
    }, [app]);

    // Track editor context changes
    useEffect(() => {
        // Initial update
        updateEditorContext();

        // Listen for active leaf changes
        const leafChangeRef = app.workspace.on('active-leaf-change', () => {
            updateEditorContext();
        });

        // Listen for editor content changes
        const editorChangeRef = app.workspace.on('editor-change', () => {
            updateEditorContext();
        });

        // Also listen for file open
        const fileOpenRef = app.workspace.on('file-open', () => {
            updateEditorContext();
        });

        // Poll for selection changes (Obsidian doesn't have a selection-change event)
        const selectionPollInterval = setInterval(() => {
            const activeView = app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.file) {
                const editor = activeView.editor;
                const selection = editor.getSelection();
                const currentSelection = selection || null;
                const currentFile = activeView.file.path;

                // Check if selection changed
                const lastContext = lastEditorContextRef.current;
                if (lastContext?.activeFile === currentFile) {
                    const hasSelectionChanged = currentSelection !== lastContext.selectedText;
                    if (hasSelectionChanged) {
                        updateEditorContext();
                    }
                }
            }
        }, 200); // Check every 200ms

        return () => {
            app.workspace.offref(leafChangeRef);
            app.workspace.offref(editorChangeRef);
            app.workspace.offref(fileOpenRef);
            clearInterval(selectionPollInterval);
        };
    }, [app, updateEditorContext]);

    // Load sessions and slash commands on mount
    useEffect(() => {
        loadSessions();
        // Load default slash commands immediately
        setSlashCommands(plugin.agentService.getSlashCommands());
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (plugin.settings.autoScrollMessages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingContent]);

    const loadSessions = async () => {
        const loadedSessions = await plugin.sessionManager.getAllSessions();
        setSessions(loadedSessions);

        // Load most recent session or create new one
        if (loadedSessions.length > 0) {
            const mostRecent = loadedSessions[0];
            await selectSession(mostRecent.id);
        } else {
            await createNewSession();
        }
    };

    const selectSession = async (sessionId: string) => {
        const session = await plugin.sessionManager.loadSession(sessionId);
        if (session) {
            setCurrentSession(session);
            setMessages(session.messages);
            setError(null);
            setStreamingContent('');
        }
    };

    const createNewSession = async () => {
        const session = await plugin.sessionManager.createNewSession();
        setCurrentSession(session);
        setMessages([]);
        setError(null);
        setStreamingContent('');
        await loadSessions();
    };

    const deleteSession = async (sessionId: string) => {
        await plugin.sessionManager.deleteSession(sessionId);
        plugin.agentService.clearHistory(sessionId);

        const remainingSessions = await plugin.sessionManager.getAllSessions();
        setSessions(remainingSessions);

        // If we deleted the current session, switch to another or create new
        if (currentSession?.id === sessionId) {
            if (remainingSessions.length > 0) {
                await selectSession(remainingSessions[0].id);
            } else {
                await createNewSession();
            }
        }
    };

    // Format editor context for Claude
    const formatContextForClaude = useCallback((ctx: EditorContext): string => {
        if (!ctx.activeFile) return '';

        let contextStr = `\n\n<editor-context>\n<current-file>${ctx.activeFile}</current-file>`;

        if (ctx.selectedText && ctx.selectionStart !== null && ctx.selectionEnd !== null) {
            const lineInfo = ctx.selectionStart === ctx.selectionEnd
                ? `line="${ctx.selectionStart}"`
                : `lines="${ctx.selectionStart}-${ctx.selectionEnd}"`;
            contextStr += `\n<selected-text ${lineInfo}>\n${ctx.selectedText}\n</selected-text>`;
        }

        contextStr += '\n</editor-context>';
        return contextStr;
    }, []);

    // Capture current context at send time
    const captureCurrentContext = useCallback((): EditorContext => {
        const activeView = app.workspace.getActiveViewOfType(MarkdownView);

        // If no markdown view active, use the last known context
        if (!activeView || !activeView.file) {
            return lastEditorContextRef.current || {
                activeFile: null,
                selectionStart: null,
                selectionEnd: null,
                selectedText: null
            };
        }

        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (selection) {
            const from = editor.getCursor('from');
            const to = editor.getCursor('to');
            return {
                activeFile: activeView.file.path,
                selectionStart: from.line + 1,
                selectionEnd: to.line + 1,
                selectedText: selection
            };
        }

        return {
            activeFile: activeView.file.path,
            selectionStart: null,
            selectionEnd: null,
            selectedText: null
        };
    }, [app]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading || !currentSession) return;

        // Capture context at send time
        const currentContext = captureCurrentContext();

        setError(null);
        setIsLoading(true);
        setStreamingContent('');

        // Add user message to UI with editor context
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: Date.now(),
            editorContext: currentContext.activeFile ? currentContext : undefined
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        try {
            // Format message with context for Claude
            const contextStr = formatContextForClaude(currentContext);
            const messageWithContext = content + contextStr;

            // Send to agent and receive response with streaming
            const response = await plugin.agentService.sendMessage(
                messageWithContext,
                currentSession.id,
                (partialContent) => {
                    setStreamingContent(partialContent);
                }
            );

            // Create assistant message
            const assistantMessage: ChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                toolResults: response.toolResults
            };

            const finalMessages = [...newMessages, assistantMessage];
            setMessages(finalMessages);
            setStreamingContent('');

            // Update usage stats if available
            if (response.usage) {
                await plugin.sessionManager.updateUsage(currentSession.id, response.usage);
            }

            // Update slash commands if they've been fetched
            const commands = plugin.agentService.getSlashCommands();
            if (commands.length > 0) {
                setSlashCommands(commands);
            }

            // Save session
            await plugin.sessionManager.saveSession({
                ...currentSession,
                messages: finalMessages
            });

            // Refresh sessions list to update titles and usage
            await loadSessions();

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            setStreamingContent('');
        } finally {
            setIsLoading(false);
        }
    }, [currentSession, isLoading, messages, plugin, captureCurrentContext, formatContextForClaude]);

    return (
        <div className="claude-agent-chat">
            <div className="chat-header">
                <SessionSelector
                    sessions={sessions}
                    currentSession={currentSession}
                    onSelectSession={selectSession}
                    onNewSession={createNewSession}
                    onDeleteSession={deleteSession}
                />
            </div>

            <div
                className="chat-messages"
                style={{ fontSize: `${plugin.settings.chatFontSize}px` }}
            >
                <MessageList
                    messages={messages}
                    showToolResults={plugin.settings.showToolResults}
                />
                {streamingContent && (
                    <div className="message-item assistant streaming">
                        <div className="message-header">
                            <span className="message-role">Claude</span>
                        </div>
                        <div className="message-content">
                            <MarkdownRenderer content={streamingContent} />
                        </div>
                    </div>
                )}
                {isLoading && !streamingContent && (
                    <div className="loading-indicator">Claude is thinking...</div>
                )}
                {error && <div className="error-message">{error}</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <EditorContextIndicator context={editorContext} />
                <ChatInput
                    onSend={sendMessage}
                    disabled={isLoading}
                    placeholder="Ask Claude anything... (@ to mention files)"
                    slashCommands={slashCommands}
                    app={app}
                    templates={plugin.settings.envTemplates}
                    activeTemplateId={plugin.settings.activeTemplateId}
                    onTemplateChange={async (templateId) => {
                        plugin.settings.activeTemplateId = templateId;
                        await plugin.saveSettings();
                    }}
                />
            </div>
        </div>
    );
};
