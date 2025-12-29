import React, { useState, useRef, useEffect } from 'react';
import { EnvTemplate } from '../../settings/SettingsSchema';

interface TemplateSelectorProps {
    templates: EnvTemplate[];
    activeTemplateId: string | null;
    onSelectTemplate: (templateId: string) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
    templates,
    activeTemplateId,
    onSelectTemplate
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Get active template
    const activeTemplate = templates.find(t => t.id === activeTemplateId);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Don't show if no templates
    if (templates.length === 0) {
        return null;
    }

    return (
        <div className="template-selector" ref={menuRef}>
            <button
                className="template-selector-button"
                onClick={() => setIsOpen(!isOpen)}
                title="Switch environment template"
            >
                <span className="template-selector-icon">⚙</span>
                <span className="template-selector-name">
                    {activeTemplate?.name || 'No template'}
                </span>
                <span className="template-selector-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="template-selector-menu">
                    <div className="template-selector-header">
                        Environment Templates
                    </div>
                    <div className="template-selector-list">
                        {templates.map(template => (
                            <div
                                key={template.id}
                                className={`template-selector-item ${template.id === activeTemplateId ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectTemplate(template.id);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="template-selector-item-check">
                                    {template.id === activeTemplateId ? '✓' : ''}
                                </span>
                                <span className="template-selector-item-name">
                                    {template.name}
                                </span>
                                <span className="template-selector-item-count">
                                    {template.envVariables.length} vars
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
