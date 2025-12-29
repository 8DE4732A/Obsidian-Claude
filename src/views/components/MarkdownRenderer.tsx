import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Highlight, themes } from 'prism-react-renderer';

interface MarkdownRendererProps {
    content: string;
}

interface ThinkingBlockProps {
    content: string;
    defaultExpanded?: boolean;
}

/**
 * Collapsible thinking block component for <think> tags
 */
const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content, defaultExpanded = false }) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="thinking-block">
            <div
                className="thinking-block-header"
                onClick={() => setExpanded(!expanded)}
            >
                <span className="thinking-block-icon">{expanded ? '▼' : '▶'}</span>
                <span className="thinking-block-label">Thinking</span>
            </div>
            {expanded && (
                <div className="thinking-block-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

interface CodeBlockProps {
    className?: string;
    children?: React.ReactNode;
}

/**
 * Syntax highlighted code block component
 */
const CodeBlock: React.FC<CodeBlockProps> = ({ className, children }) => {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';
    const code = String(children).replace(/\n$/, '');

    // Inline code (no language specified and short)
    if (!match && code.length < 100 && !code.includes('\n')) {
        return <code className="inline-code">{children}</code>;
    }

    return (
        <Highlight
            theme={themes.vsDark}
            code={code}
            language={language}
        >
            {({ className: hlClassName, style, tokens, getLineProps, getTokenProps }) => (
                <div className="code-block-wrapper">
                    <div className="code-block-header">
                        <span className="code-block-language">{language}</span>
                    </div>
                    <pre className={hlClassName} style={{ ...style, margin: 0, padding: '12px', overflow: 'auto' }}>
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                ))}
                            </div>
                        ))}
                    </pre>
                </div>
            )}
        </Highlight>
    );
};

/**
 * Parse content and extract think blocks
 */
function parseContent(content: string): Array<{ type: 'text' | 'think'; content: string }> {
    const parts: Array<{ type: 'text' | 'think'; content: string }> = [];
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;

    let lastIndex = 0;
    let match;

    while ((match = thinkRegex.exec(content)) !== null) {
        // Add text before the think block
        if (match.index > lastIndex) {
            const textContent = content.slice(lastIndex, match.index).trim();
            if (textContent) {
                parts.push({ type: 'text', content: textContent });
            }
        }

        // Add the think block
        parts.push({ type: 'think', content: match[1].trim() });
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last think block
    if (lastIndex < content.length) {
        const textContent = content.slice(lastIndex).trim();
        if (textContent) {
            parts.push({ type: 'text', content: textContent });
        }
    }

    // If no think blocks found, return the whole content as text
    if (parts.length === 0 && content.trim()) {
        parts.push({ type: 'text', content: content.trim() });
    }

    return parts;
}

/**
 * Main markdown renderer component
 * Handles markdown content with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - Syntax highlighted code blocks
 * - Collapsible <think> blocks
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const parts = parseContent(content);

    return (
        <div className="markdown-content">
            {parts.map((part, index) => {
                if (part.type === 'think') {
                    return <ThinkingBlock key={index} content={part.content} />;
                }

                return (
                    <ReactMarkdown
                        key={index}
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code: ({ className, children, ...props }) => (
                                <CodeBlock className={className}>{children}</CodeBlock>
                            ),
                            // Ensure links open in external browser
                            a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                    {children}
                                </a>
                            ),
                        }}
                    >
                        {part.content}
                    </ReactMarkdown>
                );
            })}
        </div>
    );
};

export default MarkdownRenderer;
