import React, { useState, useEffect, useCallback, useRef } from 'react';
import { App } from 'obsidian';
import type ClaudeAgentPlugin from '../../main';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { SessionSelector } from './SessionSelector';
import { ChatMessage, ChatSession } from '../../types';
import { v4 as uuidv4 } from 'uuid';

interface ChatContainerProps {
    plugin: ClaudeAgentPlugin;
    app: App;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ plugin }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [streamingContent, setStreamingContent] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load sessions on mount
    useEffect(() => {
        loadSessions();
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

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading || !currentSession) return;

        setError(null);
        setIsLoading(true);
        setStreamingContent('');

        // Add user message to UI
        const userMessage: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);

        try {
            // Send to agent and receive response with streaming
            const response = await plugin.agentService.sendMessage(
                content,
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

            // Save session
            await plugin.sessionManager.saveSession({
                ...currentSession,
                messages: finalMessages
            });

            // Refresh sessions list to update titles
            await loadSessions();

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            setStreamingContent('');
        } finally {
            setIsLoading(false);
        }
    }, [currentSession, isLoading, messages, plugin]);

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

            <div className="chat-messages">
                <MessageList
                    messages={messages}
                    showToolResults={plugin.settings.showToolResults}
                />
                {streamingContent && (
                    <div className="message-item assistant streaming">
                        <div className="message-role">Claude</div>
                        <div className="message-content">{streamingContent}</div>
                    </div>
                )}
                {isLoading && !streamingContent && (
                    <div className="loading-indicator">Claude is thinking...</div>
                )}
                {error && <div className="error-message">{error}</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <ChatInput
                    onSend={sendMessage}
                    disabled={isLoading}
                    placeholder="Ask Claude anything..."
                />
            </div>
        </div>
    );
};
