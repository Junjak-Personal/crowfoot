# @liam-hq/mcp-server

Model Context Protocol (MCP) server for Liam development tools integration for AI agents.

## Overview

This package provides MCP server functionality that helps Cursor IDE interact with Liam's UI components, offering the following tools:

- `list_components`: Lists all UI components in the Liam UI package
- `get_component_files`: Gets the contents of a specific UI component's files

## Setup

### Installation

The package is part of the Liam monorepo. Install all dependencies with:

```bash
pnpm install
```

## Cursor IDE Integration

To use this MCP server with Cursor IDE, you need to configure a `.cursor/mcp.json` file in the root of your project.

### Setting up mcp.json

1. Create a `.cursor` directory in the project root if it doesn't exist
2. Create an `mcp.json` file inside this directory with the following structure:

```json
{
  "mcpServers": {
    "liam-development-mcp-server": {
      "command": "/path/to/your/node",
      "args": [
        "--experimental-strip-types",
        "/path/to/your/liam/frontend/internal-packages/mcp-server/src/index.ts"
      ]
    }
  }
}
```

Replace `/path/to/your/node` with the path to your Node.js executable and adjust the path to the index.ts file according to your local environment.

### Finding Your Node Path

You can find your Node.js path by running:

```bash
which node
```

### Why This File Isn't Committed to Git

The `mcp.json` file is not committed to Git because it contains absolute local file paths that are specific to each developer's environment. This prevents sharing a standard configuration that would work across all developer machines.
