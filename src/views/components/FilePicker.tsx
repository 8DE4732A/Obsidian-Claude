import React, { useRef, useEffect } from 'react';
import { VaultItem } from '../../types';

interface FilePickerProps {
    items: VaultItem[];
    selectedIndex: number;
    filterText: string;
    onSelect: (item: VaultItem) => void;
    onClose: () => void;
}

// Get parent directory path
function getParentPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    parts.pop();
    return parts.join('/') + '/';
}

export const FilePicker: React.FC<FilePickerProps> = ({
    items,
    selectedIndex,
    filterText,
    onSelect,
    onClose
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

    return (
        <div className="file-picker-menu" ref={menuRef}>
            <div className="file-picker-header">
                <span className="file-picker-title">
                    @ Files
                    {filterText && (
                        <span className="file-picker-filter"> "{filterText}"</span>
                    )}
                </span>
                <span className="file-picker-hint">↑↓ Tab Esc</span>
            </div>
            <div className="file-picker-list">
                {items.length === 0 ? (
                    <div className="file-picker-empty">
                        {filterText ? `No files matching "${filterText}"` : 'No files found'}
                    </div>
                ) : (
                    items.map((item, index) => (
                        <div
                            key={item.path}
                            ref={index === selectedIndex ? selectedRef : null}
                            className={`file-picker-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => onSelect(item)}
                            onMouseEnter={(e) => e.currentTarget.classList.add('hover')}
                            onMouseLeave={(e) => e.currentTarget.classList.remove('hover')}
                        >
                            <span className="file-picker-icon">
                                {item.isFolder ? '📁' : '📄'}
                            </span>
                            <div className="file-picker-path">
                                <div className="file-picker-name">{item.name}</div>
                                {getParentPath(item.path) && (
                                    <div className="file-picker-dir">
                                        {getParentPath(item.path)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
