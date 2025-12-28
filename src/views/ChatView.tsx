import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { ChatContainer } from './components/ChatContainer';
import type ClaudeAgentPlugin from '../main';

export const VIEW_TYPE_CHAT = 'claude-agent-chat-view';

export class ChatView extends ItemView {
    private root: Root | null = null;
    private plugin: ClaudeAgentPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: ClaudeAgentPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CHAT;
    }

    getDisplayText(): string {
        return 'Claude Code';
    }

    getIcon(): string {
        return 'message-circle';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('claude-agent-view-container');

        this.root = createRoot(container as HTMLElement);
        this.root.render(
            <StrictMode>
                <ChatContainer
                    plugin={this.plugin}
                    app={this.app}
                />
            </StrictMode>
        );
    }

    async onClose(): Promise<void> {
        this.root?.unmount();
        this.root = null;
    }
}
