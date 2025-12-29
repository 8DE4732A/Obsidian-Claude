import React, { useState } from 'react';
import { ChatMessage, EditorContext } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
    message: ChatMessage;
    showToolResults: boolean;
}

// Context indicator component for displaying editor context
const MessageContextIndicator: React.FC<{ context: EditorContext }> = ({ context }) => {
    if (!context.activeFile) return null;

    const fileName = context.activeFile.split('/').pop() || context.activeFile;
    const hasSelection = context.selectionStart !== null && context.selectionEnd !== null;
    const selectionText = hasSelection
        ? context.selectionStart === context.selectionEnd
            ? `Line ${context.selectionStart}`
            : `Lines ${context.selectionStart}-${context.selectionEnd}`
        : null;

    return (
        <div className="message-context-indicator">
            <span className="message-context-file" title={context.activeFile}>
                <span className="message-context-icon">📄</span>
                {fileName}
            </span>
            {selectionText && (
                <span className="message-context-selection" title={context.selectedText || ''}>
                    <span className="message-context-icon">📝</span>
                    {selectionText}
                </span>
            )}
        </div>
    );
};

export const MessageItem: React.FC<MessageItemProps> = ({ message, showToolResults }) => {
    const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

    const toggleTool = (index: number) => {
        setExpandedTools(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const roleLabel = message.role === 'user' ? 'You' : 'Claude';

    return (
        <div className={`message-item ${message.role}`}>
            <div className="message-header">
                <span className="message-role">{roleLabel}</span>
                <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
            </div>
            <div className="message-content">
                <MarkdownRenderer content={message.content} />
            </div>
            {/* Show editor context for user messages */}
            {message.role === 'user' && message.editorContext && (
                <MessageContextIndicator context={message.editorContext} />
            )}
            {showToolResults && message.toolResults && message.toolResults.length > 0 && (
                <div className="tool-results">
                    {message.toolResults.map((result, index) => (
                        <div key={index} className={`tool-result ${result.isError ? 'error' : ''}`}>
                            <div
                                className="tool-result-header"
                                onClick={() => toggleTool(index)}
                            >
                                <span className="tool-name">
                                    {expandedTools.has(index) ? '▼' : '▶'} {result.tool}
                                </span>
                                {result.isError && <span className="tool-error-badge">Error</span>}
                            </div>
                            {expandedTools.has(index) && (
                                <div className="tool-result-content">
                                    <div className="tool-input">
                                        <strong>Input:</strong>
                                        <pre>{JSON.stringify(result.input, null, 2)}</pre>
                                    </div>
                                    <div className="tool-output">
                                        <strong>Output:</strong>
                                        <pre>{result.output}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
