import { App, PluginSettingTab, Setting } from 'obsidian';
import type ClaudeAgentPlugin from '../main';

export class ClaudeAgentSettingsTab extends PluginSettingTab {
    plugin: ClaudeAgentPlugin;

    constructor(app: App, plugin: ClaudeAgentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Header
        containerEl.createEl('h1', { text: 'Claude Code Settings' });

        // Environment Variables Section
        containerEl.createEl('h2', { text: 'Environment Variables' });
        containerEl.createEl('p', {
            text: 'Configure environment variables for Claude Code. Common variables:',
            cls: 'setting-item-description'
        });

        // Help text with common variables
        const helpList = containerEl.createEl('ul', { cls: 'setting-item-description env-help-list' });
        helpList.createEl('li', { text: 'ANTHROPIC_API_KEY - Your Anthropic API key' });
        helpList.createEl('li', { text: 'CLAUDE_MODEL - Model to use (e.g., claude-sonnet-4-5-20250929)' });
        helpList.createEl('li', { text: 'CLAUDE_CODE_PATH - Path to Claude Code executable' });
        helpList.createEl('li', { text: 'CLAUDE_CODE_USE_BEDROCK=1 - Use Amazon Bedrock' });
        helpList.createEl('li', { text: 'CLAUDE_CODE_USE_VERTEX=1 - Use Google Vertex AI' });

        // Container for environment variables list
        const envVarsContainer = containerEl.createDiv({ cls: 'env-vars-container' });
        this.renderEnvVariables(envVarsContainer);

        // Add new environment variable button
        new Setting(containerEl)
            .setName('Add Environment Variable')
            .setDesc('Add a new key-value pair')
            .addButton(button => button
                .setButtonText('+ Add Variable')
                .onClick(async () => {
                    this.plugin.settings.envVariables.push({ key: '', value: '' });
                    await this.plugin.saveSettings();
                    this.renderEnvVariables(envVarsContainer);
                })
            );

        // System Prompt Section
        containerEl.createEl('h2', { text: 'System Prompt' });

        new Setting(containerEl)
            .setName('Custom System Prompt')
            .setDesc('Override the default system prompt (leave empty for default)')
            .addTextArea(text => {
                text
                    .setPlaceholder('You are a helpful assistant integrated into Obsidian...')
                    .setValue(this.plugin.settings.systemPrompt)
                    .onChange(async (value) => {
                        this.plugin.settings.systemPrompt = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 4;
                text.inputEl.style.width = '100%';
            });

        // Tool Permissions Section
        containerEl.createEl('h2', { text: 'Tool Permissions' });
        containerEl.createEl('p', {
            text: 'Control what Claude Code tools are available. Uses built-in Read, Edit, Write, Glob, Grep tools.',
            cls: 'setting-item-description'
        });

        new Setting(containerEl)
            .setName('Enable File Reading')
            .setDesc('Allow Claude to read files (Read, Glob, Grep tools)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileRead)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileRead = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Enable File Editing')
            .setDesc('Allow Claude to modify existing files (Edit tool)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileEdit)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileEdit = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Enable File Creation')
            .setDesc('Allow Claude to create new files (Write tool)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableFileCreate)
                .onChange(async (value) => {
                    this.plugin.settings.enableFileCreate = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Enable Search')
            .setDesc('Allow Claude to search content across your vault (Grep tool)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSearch)
                .onChange(async (value) => {
                    this.plugin.settings.enableSearch = value;
                    await this.plugin.saveSettings();
                })
            );

        // UI Settings Section
        containerEl.createEl('h2', { text: 'UI Settings' });

        new Setting(containerEl)
            .setName('Show Tool Results')
            .setDesc('Display tool execution results in the chat')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showToolResults)
                .onChange(async (value) => {
                    this.plugin.settings.showToolResults = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Auto-scroll Messages')
            .setDesc('Automatically scroll to the newest message')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoScrollMessages)
                .onChange(async (value) => {
                    this.plugin.settings.autoScrollMessages = value;
                    await this.plugin.saveSettings();
                })
            );

        // Session Settings Section
        containerEl.createEl('h2', { text: 'Session Settings' });

        new Setting(containerEl)
            .setName('Max Session History')
            .setDesc('Maximum number of sessions to keep in history (10-100)')
            .addSlider(slider => slider
                .setLimits(10, 100, 10)
                .setValue(this.plugin.settings.maxSessionHistory)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.maxSessionHistory = value;
                    await this.plugin.saveSettings();
                })
            );
    }

    /**
     * Render the environment variables list
     */
    private renderEnvVariables(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.envVariables.length === 0) {
            container.createEl('p', {
                text: 'No environment variables configured. Add ANTHROPIC_API_KEY to get started.',
                cls: 'setting-item-description'
            });
            return;
        }

        this.plugin.settings.envVariables.forEach((envVar, index) => {
            const envSetting = new Setting(container)
                .setClass('env-var-item');

            // Key input
            envSetting.addText(text => {
                text
                    .setPlaceholder('KEY')
                    .setValue(envVar.key)
                    .onChange(async (value) => {
                        this.plugin.settings.envVariables[index].key = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '180px';
                text.inputEl.style.fontFamily = 'monospace';
            });

            // Value input
            envSetting.addText(text => {
                text
                    .setPlaceholder('value')
                    .setValue(envVar.value)
                    .onChange(async (value) => {
                        this.plugin.settings.envVariables[index].value = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.style.width = '200px';
                // Hide sensitive values
                if (envVar.key.toLowerCase().includes('key') ||
                    envVar.key.toLowerCase().includes('secret') ||
                    envVar.key.toLowerCase().includes('token')) {
                    text.inputEl.type = 'password';
                }
            });

            // Delete button
            envSetting.addButton(button => button
                .setIcon('trash')
                .setTooltip('Delete')
                .onClick(async () => {
                    this.plugin.settings.envVariables.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.renderEnvVariables(container);
                })
            );
        });
    }
}
