# CLAUDE.md

This file provides context for Claude Code when working on this project.

## Project Overview

Obsidian Claude Agent is an Obsidian plugin that integrates `@anthropic-ai/claude-agent-sdk` to provide Claude Code capabilities within Obsidian. Users can chat with Claude in a sidebar panel, and Claude can read, edit, create, and search files in the vault.

## Tech Stack

- **Runtime**: Obsidian (Electron-based desktop app)
- **Language**: TypeScript
- **UI Framework**: React 18
- **Build Tool**: esbuild
- **SDK**: @anthropic-ai/claude-agent-sdk (V1 query API)

## Project Structure

```
src/
├── main.ts                    # Plugin entry point, view registration
├── types.ts                   # TypeScript interfaces (ChatMessage, ChatSession, etc.)
├── services/
│   ├── AgentService.ts        # Claude SDK wrapper, query execution
│   └── SessionManager.ts      # Session persistence in plugin data
├── views/
│   ├── ChatView.ts            # Obsidian ItemView (sidebar panel)
│   └── components/            # React components
│       ├── ChatContainer.tsx  # Main chat state management
│       ├── MessageList.tsx    # Message rendering
│       ├── MessageItem.tsx    # Individual message display
│       ├── ChatInput.tsx      # Input textarea + send button
│       └── SessionSelector.tsx # Session dropdown
└── settings/
    ├── SettingsSchema.ts      # Settings interface + defaults
    └── SettingsTab.ts         # Settings UI (PluginSettingTab)
```

## Key Files

- `src/services/AgentService.ts` - Core integration with Claude Agent SDK
- `src/views/ChatView.ts` - Obsidian sidebar view mounting React
- `src/main.ts` - Plugin lifecycle, includes Electron compatibility polyfill

## Architecture Decisions

### Claude Agent SDK Usage

Uses the V1 `query()` API with built-in Claude Code tools:
- `Read`, `Edit`, `Write` - File operations
- `Glob`, `Grep` - File search

The vault path is set as `cwd` so Claude operates within the Obsidian vault.

### Electron Compatibility

Obsidian runs in Electron which has Node.js compatibility issues with the SDK:
- `main.ts` includes a polyfill for `events.setMaxListeners` with AbortSignal
- `getClaudeCodePath()` auto-detects Claude Code executable location

### Configuration

All API configuration is done via environment variables (not hardcoded settings):
- `ANTHROPIC_API_KEY` - API authentication
- `CLAUDE_MODEL` - Model selection
- `CLAUDE_CODE_PATH` - Executable path override
- Third-party providers via `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Production build
npm run dev          # Development build with watch
```

## Common Tasks

### Adding a new setting

1. Add field to `ClaudeAgentSettings` in `src/settings/SettingsSchema.ts`
2. Add default value to `DEFAULT_SETTINGS`
3. Add UI control in `src/settings/SettingsTab.ts`

### Modifying Claude's behavior

- System prompt: `AgentService.getSystemPrompt()`
- Allowed tools: `AgentService.getAllowedTools()`
- Query options: `AgentService.sendMessage()` queryOptions object

### Debugging

Console logs are prefixed with `plugin:claude-agent`. Key log points:
- Vault path detection
- Claude Code executable path
- SDK errors

## Testing

Reload Obsidian after building: Cmd+R (Mac) or Ctrl+R (Windows/Linux)

## Notes

- Plugin is desktop-only (`isDesktopOnly: true` in manifest.json)
- Sessions are stored in plugin data via `this.plugin.loadData()/saveData()`
- React components are mounted/unmounted in `ChatView.onOpen()/onClose()`
