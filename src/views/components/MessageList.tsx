import React from 'react';
import { ChatMessage } from '../../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
    messages: ChatMessage[];
    showToolResults: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, showToolResults }) => {
    if (messages.length === 0) {
        return (
            <div className="empty-chat">
                <div className="empty-chat-icon">💬</div>
                <div className="empty-chat-text">
                    Start a conversation with Claude
                </div>
                <div className="empty-chat-hint">
                    Claude can read, edit, and search files in your vault
                </div>
            </div>
        );
    }

    return (
        <>
            {messages.map((message) => (
                <MessageItem
                    key={message.id}
                    message={message}
                    showToolResults={showToolResults}
                />
            ))}
        </>
    );
};
