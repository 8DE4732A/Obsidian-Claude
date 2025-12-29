import React, { useRef, useEffect } from 'react';
import { SlashCommand } from '../../types';

interface SlashCommandMenuProps {
    commands: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand) => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
    commands,
    selectedIndex,
    onSelect
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLDivElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current && menuRef.current) {
            const menu = menuRef.current;
            const selected = selectedRef.current;
            const menuRect = menu.getBoundingClientRect();
            const selectedRect = selected.getBoundingClientRect();

            if (selectedRect.bottom > menuRect.bottom) {
                selected.scrollIntoView({ block: 'end' });
            } else if (selectedRect.top < menuRect.top) {
                selected.scrollIntoView({ block: 'start' });
            }
        }
    }, [selectedIndex]);

    if (commands.length === 0) {
        return null;
    }

    return (
        <div className="slash-command-menu" ref={menuRef}>
            <div className="slash-command-header">
                <span className="slash-command-title">Commands</span>
                <span className="slash-command-hint">↑↓ to navigate, Tab to select</span>
            </div>
            <div className="slash-command-list">
                {commands.map((command, index) => (
                    <div
                        key={command.name}
                        ref={index === selectedIndex ? selectedRef : null}
                        className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
                        onClick={() => onSelect(command)}
                        onMouseEnter={(e) => e.currentTarget.classList.add('hover')}
                        onMouseLeave={(e) => e.currentTarget.classList.remove('hover')}
                    >
                        <span className="slash-command-name">{command.name}</span>
                        {command.description && (
                            <span className="slash-command-description">
                                {command.description}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
