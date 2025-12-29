import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { App, TFile, TFolder } from 'obsidian';
import { SlashCommand, VaultItem } from '../../types';
import { EnvTemplate } from '../../settings/SettingsSchema';
import { SlashCommandMenu } from './SlashCommandMenu';
import { FilePicker } from './FilePicker';
import { TemplateSelector } from './TemplateSelector';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled: boolean;
    placeholder: string;
    slashCommands?: SlashCommand[];
    app: App;
    templates: EnvTemplate[];
    activeTemplateId: string | null;
    onTemplateChange: (templateId: string) => void;
}

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 400;
const DEFAULT_HEIGHT = 400;

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled,
    placeholder,
    slashCommands = [],
    app,
    templates,
    activeTemplateId,
    onTemplateChange
}) => {
    const [input, setInput] = useState('');
    const [textareaHeight, setTextareaHeight] = useState(DEFAULT_HEIGHT);
    const [isResizing, setIsResizing] = useState(false);
    const [showCommands, setShowCommands] = useState(false);
    const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

    // File picker state
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [filePickerFilter, setFilePickerFilter] = useState('');
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);

    // Detect if input starts with a valid slash command
    const activeCommand = useMemo(() => {
        if (!input.startsWith('/')) return null;

        // Find matching command
        for (const cmd of slashCommands) {
            // Check if input starts with the command followed by space or end of input
            if (input === cmd.name || input.startsWith(cmd.name + ' ')) {
                return cmd;
            }
        }
        return null;
    }, [input, slashCommands]);

    // Filter commands based on input (for autocomplete menu)
    const filteredCommands = useMemo(() => {
        if (!input.startsWith('/')) return [];
        if (activeCommand) return []; // Don't show menu if command is already complete

        const query = input.slice(1).toLowerCase();
        return slashCommands.filter(cmd =>
            cmd.name.toLowerCase().includes(query)
        );
    }, [input, slashCommands, activeCommand]);

    // Filter vault files for file picker
    const filteredFiles = useMemo((): VaultItem[] => {
        if (!showFilePicker) return [];

        const allFiles = app.vault.getAllLoadedFiles();
        const items: VaultItem[] = allFiles
            .map(f => ({
                path: f.path,
                name: f.name,
                isFolder: f instanceof TFolder,
                extension: f instanceof TFile ? f.extension : undefined
            }))
            .filter(item => {
                if (!filePickerFilter) return true;
                return item.path.toLowerCase().includes(filePickerFilter.toLowerCase());
            })
            .sort((a, b) => {
                // Folders first, then alphabetically
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.path.localeCompare(b.path);
            })
            .slice(0, 50); // Limit for performance

        return items;
    }, [showFilePicker, filePickerFilter, app.vault]);

    // Show command menu when typing / and not yet selected a command
    useEffect(() => {
        if (input.startsWith('/') && !activeCommand && filteredCommands.length > 0) {
            setShowCommands(true);
            setSelectedCommandIndex(0);
        } else {
            setShowCommands(false);
        }
    }, [input, filteredCommands.length, activeCommand]);

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        startYRef.current = e.clientY;
        startHeightRef.current = textareaHeight;
    }, [textareaHeight]);

    // Handle resize move
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = startYRef.current - e.clientY;
            const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY));
            setTextareaHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Handle input change with @ detection
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursor = e.target.selectionStart || 0;
        setInput(value);

        // Check for @ trigger
        const charBefore = cursor > 0 ? value[cursor - 1] : '';
        const charBeforeThat = cursor > 1 ? value[cursor - 2] : ' ';

        // @ trigger: either at start of input, or after a space/newline
        if (charBefore === '@' && (charBeforeThat === ' ' || charBeforeThat === '\n' || cursor === 1)) {
            setShowFilePicker(true);
            setMentionStartIndex(cursor - 1);
            setFilePickerFilter('');
            setSelectedFileIndex(0);
        } else if (showFilePicker && mentionStartIndex !== null) {
            // Update filter with text after @
            const filterText = value.slice(mentionStartIndex + 1, cursor);
            // Close picker if user types space or newline (end of mention)
            if (filterText.includes(' ') || filterText.includes('\n')) {
                setShowFilePicker(false);
                setMentionStartIndex(null);
            } else {
                setFilePickerFilter(filterText);
            }
        }
    }, [showFilePicker, mentionStartIndex]);

    const handleSend = useCallback(() => {
        if (!input.trim() || disabled) return;
        onSend(input.trim());
        setInput('');
        setShowCommands(false);
        setShowFilePicker(false);
    }, [input, disabled, onSend]);

    const handleCommandSelect = useCallback((command: SlashCommand) => {
        setInput(command.name + ' ');
        setShowCommands(false);
        textareaRef.current?.focus();
    }, []);

    const handleFileSelect = useCallback((item: VaultItem) => {
        // Replace @filter with @path in input
        if (mentionStartIndex !== null) {
            const cursor = textareaRef.current?.selectionStart || input.length;
            const before = input.slice(0, mentionStartIndex);
            const after = input.slice(cursor);
            // Insert @path (keep the @ symbol)
            const newInput = before + '@' + item.path + ' ' + after;
            setInput(newInput);

            // Set cursor position after the inserted path
            setTimeout(() => {
                const newPosition = mentionStartIndex + 1 + item.path.length + 1;
                textareaRef.current?.setSelectionRange(newPosition, newPosition);
                textareaRef.current?.focus();
            }, 0);
        }

        setShowFilePicker(false);
        setMentionStartIndex(null);
    }, [input, mentionStartIndex]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Handle file picker navigation (higher priority)
        if (showFilePicker && filteredFiles.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedFileIndex(prev =>
                    prev < filteredFiles.length - 1 ? prev + 1 : 0
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedFileIndex(prev =>
                    prev > 0 ? prev - 1 : filteredFiles.length - 1
                );
                return;
            }
            if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault();
                handleFileSelect(filteredFiles[selectedFileIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowFilePicker(false);
                setMentionStartIndex(null);
                return;
            }
        }

        // Handle command menu navigation
        if (showCommands && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedCommandIndex(prev =>
                    prev < filteredCommands.length - 1 ? prev + 1 : 0
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedCommandIndex(prev =>
                    prev > 0 ? prev - 1 : filteredCommands.length - 1
                );
                return;
            }
            if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
                e.preventDefault();
                handleCommandSelect(filteredCommands[selectedCommandIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommands(false);
                return;
            }
        }

        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [showFilePicker, filteredFiles, selectedFileIndex, handleFileSelect,
        showCommands, filteredCommands, selectedCommandIndex, handleCommandSelect, handleSend]);

    return (
        <div className="chat-input-wrapper" ref={containerRef}>
            {/* Resize handle */}
            <div
                className={`chat-input-resize-handle ${isResizing ? 'resizing' : ''}`}
                onMouseDown={handleResizeStart}
            />

            {/* File picker popup */}
            {showFilePicker && (
                <FilePicker
                    items={filteredFiles}
                    selectedIndex={selectedFileIndex}
                    filterText={filePickerFilter}
                    onSelect={handleFileSelect}
                    onClose={() => {
                        setShowFilePicker(false);
                        setMentionStartIndex(null);
                    }}
                />
            )}

            {/* Slash command menu */}
            {showCommands && (
                <SlashCommandMenu
                    commands={filteredCommands}
                    selectedIndex={selectedCommandIndex}
                    onSelect={handleCommandSelect}
                />
            )}

            {/* Active command indicator */}
            {activeCommand && (
                <div className="active-command-indicator">
                    <span className="active-command-badge">{activeCommand.name}</span>
                    {activeCommand.description && (
                        <span className="active-command-desc">{activeCommand.description}</span>
                    )}
                </div>
            )}

            <div className="chat-input-container">
                <textarea
                    ref={textareaRef}
                    className={`chat-input ${activeCommand ? 'has-command' : ''}`}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    style={{ height: textareaHeight }}
                />
                {/* Template selector at bottom left inside input */}
                <div className="template-selector-wrapper">
                    <TemplateSelector
                        templates={templates}
                        activeTemplateId={activeTemplateId}
                        onSelectTemplate={onTemplateChange}
                    />
                </div>
                <button
                    className="send-button"
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                    title="Send message (Enter)"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M22 2L11 13"></path>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};
