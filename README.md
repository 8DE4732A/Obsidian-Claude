# Obsidian Claude Code

An Obsidian plugin that integrates Claude Code capabilities into your vault through a chat interface in the sidebar.

## Features

- Chat with Claude directly in Obsidian's right sidebar
- Claude can read, edit, create, and search files in your vault
- Uses Claude Code's built-in tools (Read, Edit, Write, Glob, Grep)
- Session management with conversation history
- Streaming responses for real-time feedback
- Supports third-party API providers (AWS Bedrock, Google Vertex AI, Azure)

## Requirements

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed on your system
- An Anthropic API key (or configured third-party provider)
- Obsidian desktop app (not mobile)

## Installation

### From Source

1. Clone this repository into your vault's `.obsidian/plugins/` folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/
   git clone https://github.com/your-repo/obsidian-claude-agent.git
   cd obsidian-claude-agent
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Reload Obsidian and enable the plugin in Settings > Community plugins

## Configuration

### Environment Variables

Configure API authentication in **Settings > Claude Agent > Environment Variables**.

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `CLAUDE_MODEL` | Model to use (e.g., `claude-sonnet-4-5-20250929`) |
| `CLAUDE_CODE_PATH` | Path to Claude Code executable (auto-detected) |

#### Third-Party Providers

**AWS Bedrock:**
```
CLAUDE_CODE_USE_BEDROCK=1
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

**Google Vertex AI:**
```
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=us-central1
ANTHROPIC_VERTEX_PROJECT_ID=your-project-id
```

### Tool Permissions

Control which Claude Code tools are available:

- **File Reading** - Read, Glob, Grep tools
- **File Editing** - Edit tool for modifying existing files
- **File Creation** - Write tool for creating new files
- **Search** - Grep tool for content search

### System Prompt

Customize the system prompt to change Claude's behavior when working with your vault.

## Usage

1. Click the message icon in the left ribbon, or use the command palette: "Open Claude Agent Chat"
2. Type your message and press Enter or click Send
3. Claude will respond and can use tools to interact with your vault files

### Example Prompts

- "List all markdown files in the notes folder"
- "Read the content of my daily note"
- "Create a new note called 'Meeting Notes' with a template"
- "Search for all files mentioning 'project'"
- "Update the TODO section in my README"

## Session Management

- Click the session dropdown to switch between conversations
- Click "+" to start a new session
- Sessions are persisted locally in your vault

## Troubleshooting

### Claude Code not found

If you see path-related errors, manually set `CLAUDE_CODE_PATH` in environment variables:

```bash
# Find Claude Code location
which claude
```

Add the result as the value for `CLAUDE_CODE_PATH`.

### API Key Issues

Ensure `ANTHROPIC_API_KEY` is set correctly in the environment variables section. The key should start with `sk-ant-`.

## Development

```bash
# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

## License

MIT
