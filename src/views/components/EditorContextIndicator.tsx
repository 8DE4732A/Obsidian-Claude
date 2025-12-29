import React from 'react';
import { EditorContext } from '../../types';

interface EditorContextIndicatorProps {
    context: EditorContext;
}

export const EditorContextIndicator: React.FC<EditorContextIndicatorProps> = ({ context }) => {
    // Don't show if no active file
    if (!context.activeFile) return null;

    // Get just the filename from the path
    const fileName = context.activeFile.split('/').pop() || context.activeFile;

    // Format selection info
    const hasSelection = context.selectionStart !== null && context.selectionEnd !== null;
    const selectionText = hasSelection
        ? context.selectionStart === context.selectionEnd
            ? `Line ${context.selectionStart}`
            : `Lines ${context.selectionStart}-${context.selectionEnd}`
        : null;

    return (
        <div className="editor-context-indicator">
            <span className="editor-context-file" title={context.activeFile}>
                <span className="editor-context-icon">📄</span>
                {fileName}
            </span>
            {selectionText && (
                <span className="editor-context-selection" title={context.selectedText || ''}>
                    <span className="editor-context-icon">📝</span>
                    {selectionText}
                </span>
            )}
        </div>
    );
};
