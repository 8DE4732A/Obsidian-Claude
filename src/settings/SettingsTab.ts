import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type ClaudeAgentPlugin from '../main';
import { EnvTemplate, EnvVariable } from './SettingsSchema';
import { v4 as uuidv4 } from 'uuid';

// Interface for Claude settings.json
interface ClaudeSettings {
    permissions?: {
        deny?: string[];
    };
}

export class ClaudeAgentSettingsTab extends PluginSettingTab {
    plugin: ClaudeAgentPlugin;
    private expandedTemplateId: string | null = null;
    private denyRules: string[] = [];

    constructor(app: App, plugin: ClaudeAgentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        // Migrate legacy envVariables to template if needed
        this.migrateLegacyEnvVariables();

        // Load deny rules from .claude/settings.json
        await this.loadDenyRules();

        // Header
        containerEl.createEl('h1', { text: 'Claude Code Settings' });

        // Environment Templates Section
        containerEl.createEl('h2', { text: 'Environment Templates' });
        containerEl.createEl('p', {
            text: 'Configure multiple environment variable templates. Switch between them in the chat interface.',
            cls: 'setting-item-description'
        });

        // Help text with common variables
        const helpList = containerEl.createEl('ul', { cls: 'setting-item-description env-help-list' });
        helpList.createEl('li', { text: 'ANTHROPIC_API_KEY - Your Anthropic API key' });
        helpList.createEl('li', { text: 'CLAUDE_MODEL - Model to use (e.g., claude-sonnet-4-5-20250929)' });
        helpList.createEl('li', { text: 'CLAUDE_CODE_USE_BEDROCK=1 - Use Amazon Bedrock' });
        helpList.createEl('li', { text: 'CLAUDE_CODE_USE_VERTEX=1 - Use Google Vertex AI' });

        // Templates container
        const templatesContainer = containerEl.createDiv({ cls: 'env-templates-container' });
        this.renderTemplates(templatesContainer);

        // Add new template button
        new Setting(containerEl)
            .setName('Add Template')
            .setDesc('Create a new environment variable template')
            .addButton(button => button
                .setButtonText('+ New Template')
                .onClick(async () => {
                    const newTemplate: EnvTemplate = {
                        id: uuidv4(),
                        name: `Template ${this.plugin.settings.envTemplates.length + 1}`,
                        envVariables: []
                    };
                    this.plugin.settings.envTemplates.push(newTemplate);

                    // If this is the first template, set it as active
                    if (this.plugin.settings.envTemplates.length === 1) {
                        this.plugin.settings.activeTemplateId = newTemplate.id;
                    }

                    this.expandedTemplateId = newTemplate.id;
                    await this.plugin.saveSettings();
                    this.renderTemplates(templatesContainer);
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

        // File Access Permissions Section
        containerEl.createEl('h2', { text: 'File Access Restrictions' });
        containerEl.createEl('p', {
            text: 'Configure files and folders that Claude cannot access. Rules are saved to .claude/settings.json in your vault.',
            cls: 'setting-item-description'
        });

        // Help text with examples
        const accessHelpDiv = containerEl.createDiv({ cls: 'setting-item-description file-access-help' });
        accessHelpDiv.createEl('p', { text: 'Pattern examples:' });
        const accessHelpList = accessHelpDiv.createEl('ul');
        accessHelpList.createEl('li', { text: '.env - Single file in root' });
        accessHelpList.createEl('li', { text: 'secrets/ - All files in secrets folder' });
        accessHelpList.createEl('li', { text: 'secrets/** - All files in secrets and subfolders' });
        accessHelpList.createEl('li', { text: '**/*.log - All .log files anywhere' });
        accessHelpList.createEl('li', { text: 'private/*.md - All .md files in private folder' });

        // Deny rules container
        const denyRulesContainer = containerEl.createDiv({ cls: 'deny-rules-container' });
        this.renderDenyRules(denyRulesContainer);

        // Add new deny rule
        const addRuleDiv = containerEl.createDiv({ cls: 'add-deny-rule' });
        const ruleInput = addRuleDiv.createEl('input', {
            type: 'text',
            placeholder: 'Enter file path or pattern (e.g., .env, secrets/**, *.log)',
            cls: 'deny-rule-input'
        });
        const addRuleBtn = addRuleDiv.createEl('button', {
            text: '+ Add Rule',
            cls: 'deny-rule-add-btn'
        });
        addRuleBtn.addEventListener('click', async () => {
            const pattern = ruleInput.value.trim();
            if (pattern) {
                await this.addDenyRule(pattern);
                ruleInput.value = '';
                this.renderDenyRules(denyRulesContainer);
            }
        });
        ruleInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const pattern = ruleInput.value.trim();
                if (pattern) {
                    await this.addDenyRule(pattern);
                    ruleInput.value = '';
                    this.renderDenyRules(denyRulesContainer);
                }
            }
        });

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

        new Setting(containerEl)
            .setName('Chat Font Size')
            .setDesc(`Adjust the font size of chat messages (${this.plugin.settings.chatFontSize}px)`)
            .addSlider(slider => slider
                .setLimits(12, 20, 1)
                .setValue(this.plugin.settings.chatFontSize)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.chatFontSize = value;
                    await this.plugin.saveSettings();
                    // Update the description to show current value
                    this.display();
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
     * Migrate legacy envVariables to a default template
     */
    private async migrateLegacyEnvVariables(): Promise<void> {
        if (this.plugin.settings.envVariables.length > 0 &&
            this.plugin.settings.envTemplates.length === 0) {
            // Create a default template from legacy variables
            const defaultTemplate: EnvTemplate = {
                id: uuidv4(),
                name: 'Default',
                envVariables: [...this.plugin.settings.envVariables]
            };
            this.plugin.settings.envTemplates.push(defaultTemplate);
            this.plugin.settings.activeTemplateId = defaultTemplate.id;
            this.plugin.settings.envVariables = []; // Clear legacy
            await this.plugin.saveSettings();
        }
    }

    /**
     * Render the templates list
     */
    private renderTemplates(container: HTMLElement): void {
        container.empty();

        if (this.plugin.settings.envTemplates.length === 0) {
            container.createEl('p', {
                text: 'No templates configured. Create a template to add environment variables.',
                cls: 'setting-item-description'
            });
            return;
        }

        this.plugin.settings.envTemplates.forEach((template) => {
            const isActive = template.id === this.plugin.settings.activeTemplateId;
            const isExpanded = template.id === this.expandedTemplateId;

            const templateDiv = container.createDiv({
                cls: `env-template-item ${isActive ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`
            });

            // Template header
            const headerDiv = templateDiv.createDiv({ cls: 'env-template-header' });

            // Active indicator and name
            const titleDiv = headerDiv.createDiv({ cls: 'env-template-title' });
            if (isActive) {
                titleDiv.createSpan({ text: '✓ ', cls: 'env-template-active-icon' });
            }

            // Editable name
            const nameInput = titleDiv.createEl('input', {
                type: 'text',
                value: template.name,
                cls: 'env-template-name-input'
            });
            nameInput.addEventListener('change', async (e) => {
                template.name = (e.target as HTMLInputElement).value;
                await this.plugin.saveSettings();
            });
            nameInput.addEventListener('click', (e) => e.stopPropagation());

            // Var count badge
            titleDiv.createSpan({
                text: `(${template.envVariables.length} vars)`,
                cls: 'env-template-var-count'
            });

            // Action buttons
            const actionsDiv = headerDiv.createDiv({ cls: 'env-template-actions' });

            // Set as active button (if not active)
            if (!isActive) {
                const activateBtn = actionsDiv.createEl('button', {
                    text: 'Use',
                    cls: 'env-template-btn activate'
                });
                activateBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    this.plugin.settings.activeTemplateId = template.id;
                    await this.plugin.saveSettings();
                    this.renderTemplates(container);
                });
            }

            // Expand/collapse button
            const expandBtn = actionsDiv.createEl('button', {
                text: isExpanded ? '▼' : '▶',
                cls: 'env-template-btn expand'
            });
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.expandedTemplateId = isExpanded ? null : template.id;
                this.renderTemplates(container);
            });

            // Delete button
            const deleteBtn = actionsDiv.createEl('button', {
                text: '×',
                cls: 'env-template-btn delete'
            });
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = this.plugin.settings.envTemplates.findIndex(t => t.id === template.id);
                if (index > -1) {
                    this.plugin.settings.envTemplates.splice(index, 1);

                    // If deleted active template, set another as active
                    if (isActive && this.plugin.settings.envTemplates.length > 0) {
                        this.plugin.settings.activeTemplateId = this.plugin.settings.envTemplates[0].id;
                    } else if (this.plugin.settings.envTemplates.length === 0) {
                        this.plugin.settings.activeTemplateId = null;
                    }

                    if (this.expandedTemplateId === template.id) {
                        this.expandedTemplateId = null;
                    }

                    await this.plugin.saveSettings();
                    this.renderTemplates(container);
                }
            });

            // Expanded content - environment variables
            if (isExpanded) {
                const contentDiv = templateDiv.createDiv({ cls: 'env-template-content' });
                this.renderEnvVariables(contentDiv, template);

                // Add variable button
                const addVarBtn = contentDiv.createEl('button', {
                    text: '+ Add Variable',
                    cls: 'env-template-add-var-btn'
                });
                addVarBtn.addEventListener('click', async () => {
                    template.envVariables.push({ key: '', value: '' });
                    await this.plugin.saveSettings();
                    this.renderTemplates(container);
                });
            }
        });
    }

    /**
     * Render the environment variables for a template
     */
    private renderEnvVariables(container: HTMLElement, template: EnvTemplate): void {
        if (template.envVariables.length === 0) {
            container.createEl('p', {
                text: 'No variables in this template.',
                cls: 'setting-item-description'
            });
            return;
        }

        const varsContainer = container.createDiv({ cls: 'env-vars-list' });

        template.envVariables.forEach((envVar, index) => {
            const varDiv = varsContainer.createDiv({ cls: 'env-var-row' });

            // Key input
            const keyInput = varDiv.createEl('input', {
                type: 'text',
                placeholder: 'KEY',
                value: envVar.key,
                cls: 'env-var-key'
            });
            keyInput.addEventListener('change', async (e) => {
                template.envVariables[index].key = (e.target as HTMLInputElement).value;
                await this.plugin.saveSettings();
            });

            // Value input
            const valueInput = varDiv.createEl('input', {
                type: this.shouldHideValue(envVar.key) ? 'password' : 'text',
                placeholder: 'value',
                value: envVar.value,
                cls: 'env-var-value'
            });
            valueInput.addEventListener('change', async (e) => {
                template.envVariables[index].value = (e.target as HTMLInputElement).value;
                await this.plugin.saveSettings();
            });

            // Delete button
            const deleteBtn = varDiv.createEl('button', {
                text: '×',
                cls: 'env-var-delete'
            });
            deleteBtn.addEventListener('click', async () => {
                template.envVariables.splice(index, 1);
                await this.plugin.saveSettings();
                this.renderTemplates(container.parentElement!.parentElement!);
            });
        });
    }

    /**
     * Check if value should be hidden (password field)
     */
    private shouldHideValue(key: string): boolean {
        const lowerKey = key.toLowerCase();
        return lowerKey.includes('key') ||
               lowerKey.includes('secret') ||
               lowerKey.includes('token') ||
               lowerKey.includes('password');
    }

    /**
     * Get the path to .claude/settings.json in the vault
     */
    private getClaudeSettingsPath(): string {
        return '.claude/settings.json';
    }

    /**
     * Load deny rules from .claude/settings.json
     */
    private async loadDenyRules(): Promise<void> {
        try {
            const filePath = this.getClaudeSettingsPath();
            const adapter = this.app.vault.adapter;

            // Check if .claude directory exists
            const claudeDirExists = await adapter.exists('.claude');
            if (!claudeDirExists) {
                this.denyRules = [];
                return;
            }

            // Check if settings.json exists
            const fileExists = await adapter.exists(filePath);
            if (!fileExists) {
                this.denyRules = [];
                return;
            }

            const content = await adapter.read(filePath);
            const settings: ClaudeSettings = JSON.parse(content);

            // Extract patterns from deny rules (remove Read() wrapper)
            this.denyRules = (settings.permissions?.deny || []).map(rule => {
                // Parse "Read(./pattern)" format to extract pattern
                const match = rule.match(/^Read\(\.\/(.+)\)$/);
                return match ? match[1] : rule;
            });
        } catch (error) {
            console.error('Failed to load deny rules:', error);
            this.denyRules = [];
        }
    }

    /**
     * Save deny rules to .claude/settings.json
     */
    private async saveDenyRules(): Promise<void> {
        try {
            const filePath = this.getClaudeSettingsPath();
            const adapter = this.app.vault.adapter;

            // Ensure .claude directory exists
            const claudeDirExists = await adapter.exists('.claude');
            if (!claudeDirExists) {
                await adapter.mkdir('.claude');
            }

            // Load existing settings or create new
            let settings: ClaudeSettings = { permissions: { deny: [] } };
            const fileExists = await adapter.exists(filePath);
            if (fileExists) {
                try {
                    const content = await adapter.read(filePath);
                    settings = JSON.parse(content);
                } catch {
                    // If file is corrupted, start fresh
                    settings = { permissions: { deny: [] } };
                }
            }

            // Convert patterns to Read() format
            const denyRules = this.denyRules.map(pattern => `Read(./${pattern})`);

            // Update permissions
            if (!settings.permissions) {
                settings.permissions = {};
            }
            settings.permissions.deny = denyRules;

            // Write back
            await adapter.write(filePath, JSON.stringify(settings, null, 2));
            new Notice('File access rules saved');
        } catch (error) {
            console.error('Failed to save deny rules:', error);
            new Notice('Failed to save file access rules');
        }
    }

    /**
     * Add a new deny rule
     */
    private async addDenyRule(pattern: string): Promise<void> {
        // Normalize pattern (remove leading ./ if present)
        const normalizedPattern = pattern.replace(/^\.\//, '');

        // Check for duplicates
        if (this.denyRules.includes(normalizedPattern)) {
            new Notice('This pattern already exists');
            return;
        }

        this.denyRules.push(normalizedPattern);
        await this.saveDenyRules();
    }

    /**
     * Remove a deny rule by index
     */
    private async removeDenyRule(index: number): Promise<void> {
        if (index >= 0 && index < this.denyRules.length) {
            this.denyRules.splice(index, 1);
            await this.saveDenyRules();
        }
    }

    /**
     * Render the deny rules list
     */
    private renderDenyRules(container: HTMLElement): void {
        container.empty();

        if (this.denyRules.length === 0) {
            container.createEl('p', {
                text: 'No file access restrictions configured. Claude can access all files in your vault.',
                cls: 'setting-item-description deny-rules-empty'
            });
            return;
        }

        const rulesListDiv = container.createDiv({ cls: 'deny-rules-list' });

        this.denyRules.forEach((pattern, index) => {
            const ruleDiv = rulesListDiv.createDiv({ cls: 'deny-rule-item' });

            // Pattern display
            const patternSpan = ruleDiv.createSpan({
                text: pattern,
                cls: 'deny-rule-pattern'
            });

            // Delete button
            const deleteBtn = ruleDiv.createEl('button', {
                text: '×',
                cls: 'deny-rule-delete-btn'
            });
            deleteBtn.setAttribute('aria-label', 'Remove this rule');
            deleteBtn.addEventListener('click', async () => {
                await this.removeDenyRule(index);
                this.renderDenyRules(container);
            });
        });
    }
}
