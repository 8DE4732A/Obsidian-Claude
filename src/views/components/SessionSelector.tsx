import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, UsageStats } from '../../types';

interface SessionSelectorProps {
    sessions: ChatSession[];
    currentSession: ChatSession | null;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
    onDeleteSession: (id: string) => void;
}

// Format usage stats for display
const formatUsage = (usage: UsageStats | undefined): string => {
    if (!usage || usage.totalTokens === 0) return '';
    const tokens = usage.totalTokens >= 1000
        ? `${(usage.totalTokens / 1000).toFixed(1)}k`
        : `${usage.totalTokens}`;
    const cost = usage.estimatedCost >= 0.01
        ? `$${usage.estimatedCost.toFixed(2)}`
        : `$${usage.estimatedCost.toFixed(4)}`;
    return `${tokens} tokens · ${cost}`;
};

export const SessionSelector: React.FC<SessionSelectorProps> = ({
    sessions,
    currentSession,
    onSelectSession,
    onNewSession,
    onDeleteSession
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowDeleteConfirm(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const handleSelectSession = (id: string) => {
        onSelectSession(id);
        setIsOpen(false);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setShowDeleteConfirm(id);
    };

    const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        onDeleteSession(id);
        setShowDeleteConfirm(null);
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteConfirm(null);
    };

    return (
        <div className="session-selector" ref={dropdownRef}>
            <div className="session-selector-header">
                <button
                    className="session-selector-button"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className="session-title">
                        {currentSession?.title || 'Select Session'}
                    </span>
                    <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
                </button>

                <button
                    className="new-session-button"
                    onClick={onNewSession}
                    title="New Session"
                >
                    +
                </button>
            </div>

            {currentSession?.usage && currentSession.usage.totalTokens > 0 && (
                <div className="session-usage-stats">
                    {formatUsage(currentSession.usage)}
                </div>
            )}

            {isOpen && (
                <div className="session-dropdown">
                    {sessions.length === 0 ? (
                        <div className="session-dropdown-empty">No sessions</div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                className={`session-dropdown-item ${session.id === currentSession?.id ? 'active' : ''}`}
                                onClick={() => handleSelectSession(session.id)}
                            >
                                <div className="session-item-content">
                                    <div className="session-item-title">{session.title}</div>
                                    <div className="session-item-date">
                                        {formatDate(session.updatedAt)}
                                    </div>
                                </div>
                                {showDeleteConfirm === session.id ? (
                                    <div className="delete-confirm">
                                        <button
                                            className="confirm-delete-btn"
                                            onClick={(e) => handleConfirmDelete(e, session.id)}
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="cancel-delete-btn"
                                            onClick={handleCancelDelete}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="delete-session-btn"
                                        onClick={(e) => handleDeleteClick(e, session.id)}
                                        title="Delete session"
                                    >
                                        🗑
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
