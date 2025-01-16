# Aggregate Open Tabs

**Aggregate Open Tabs** is a Visual Studio Code extension that helps you gather, preview, and manage all of your open files in one place. It also provides powerful features for analyzing file contents, generating summaries, chunking large files, and filtering out sensitive or unnecessary files before sharing or reviewing.

## Features

- **Tree View Panel**  
  - Displays a summary of open files, file statistics, and workspace distribution.  
  - Supports drag-and-drop rearrangement of open tabs.  
  - Offers commands like “Toggle Preview”, “Copy to Clipboard”, and “Aggregate # Open Files”.

- **Aggregation**  
  - Combine all open tabs (or only a selected subset) into a single document.  
  - Automatically chunk long files for improved readability.  
  - Generate AI-powered summaries, lists of imports/exports, dependencies, and more.

- **File Analysis & Summaries**  
  - Optional AI-based analysis of each file (framework detection, purpose, imports, exports, dependencies).  
  - Choose between detailed or concise summaries, with or without code fences.

- **LLM-Friendly Output**
  - Enhanced metadata with file purpose detection and dependency analysis
  - Directory context and relationship tracking between files
  - Standardized YAML metadata blocks for easy parsing
  - Smart chunking with summaries for large files
  - Table of contents with file summaries
  - Cross-reference annotations for related files
  - Consistent section headers and code fence annotations

- **Sensitive Data Handling**  
  - Detect or redact sensitive data using configurable patterns or environment variables.

- **Configurable Output**  
  - Output can be formatted as **Markdown**, **Plain Text**, or **HTML**.  
  - Control chunk separation style, code fence languages, extra spacing, and more.

- **Preview Panel**  
  - View the aggregated result in real time in a separate webview.  
  - Automatically refreshes when files are edited.

- **Selective Aggregation**  
  - Quickly pick and choose which files to include via a Quick Pick interface.

## Installation

### 1. From the VS Code Marketplace (Recommended)

1. Open Visual Studio Code.
2. Go to the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS).
3. Search for "**Aggregate Open Tabs**".
4. Click **Install**.

### 2. From a VSIX File (Manual)

1. Download the `.vsix` file from the GitHub releases page (or from a local build).
2. In VS Code, open the **Extensions** view.
3. Click on the “...”(More Actions) in the top-right corner and select **Install from VSIX...**.
4. Select the `.vsix` file to install.

### 3. Building From Source (Advanced)

1. Clone this repository.
2. Run `npm install` or `yarn install`.
3. Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## Getting Started

1. **Open the "Aggregate Open Tabs" Tree View**  
   - By default, it appears in the Explorer sidebar (look for "**Aggregate Open Tabs**").  
   - If you don’t see it, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and run:
     ```
     View: Show Aggregate Open Tabs
     ```

2. **Aggregate Your Files**  
   - In the Tree View, click “Aggregate # Open Files” to combine all open tabs into a single output.  
   - Alternatively, click “Copy to Clipboard” to copy the aggregated content to your clipboard.

3. **Preview the Aggregation**  
   - Click “Toggle Preview” in the Tree View to open the webview panel.  
   - Any changes to open files will refresh the preview automatically (with a brief delay).

4. **Selective Aggregation**  
   - Run the command `Aggregate Selectively` (`extension.selectiveAggregate`) via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).  
   - A Quick Pick menu will let you choose which files to include.

## Commands

| Command                               | Description                                                                                           |
|---------------------------------------|-------------------------------------------------------------------------------------------------------|
| **`extension.aggregateOpenTabs`**     | Aggregates content from all open files into one unified output.                                       |
| **`extension.selectiveAggregate`**    | Prompts you to select which open files to aggregate.                                                  |
| **`extension.togglePreview`**         | Toggles the webview preview panel for the aggregated output.                                          |
| **`extension.copyAggregatedContent`** | Copies the aggregated content to your clipboard.                                                      |
| **`extension.openConfiguration`**     | Opens the extension’s configuration panel in a dedicated webview (alternative to using VS Code’s Settings). |

You can also access some of these commands from the **Aggregate Open Tabs** Tree View context menu.

## Configuration

All configuration settings can be found by opening **File** > **Preferences** > **Settings** (or `Ctrl+,`) and searching for **`aggregateOpenTabs`**.

### Settings Overview

| Setting Key                                     | Description                                                                                                                                                                           |
|-------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `aggregateOpenTabs.showPreviewOnStartup`        | If `true`, automatically open the Preview panel when VS Code starts (default: `false`).                                                                                              |
| `aggregateOpenTabs.includeFileTypes`            | List of file extensions (e.g. `[ ".ts", ".js" ]`). When not empty, only these file types are aggregated. Use `["*"]` to include all.                                                   |
| `aggregateOpenTabs.chunkSize`                   | Maximum number of lines per chunk (default: `2000`). Files larger than this are split into multiple chunks.                                                                           |
| `aggregateOpenTabs.excludePatterns`             | Array of glob patterns to exclude (e.g., `["**/node_modules/**", "**/.git/**"]`).                                                                                                     |
| `aggregateOpenTabs.addSummaries`                | If `true`, adds short file summaries (default: `true`).                                                                                                                               |
| `aggregateOpenTabs.enhancedSummaries`           | If `true`, uses AI-powered, detailed file analysis (default: `true`).                                                                                                                 |
| `aggregateOpenTabs.extraSpacing`                | If `true`, adds extra spacing around code blocks and sections (default: `true`).                                                                                                      |
| `aggregateOpenTabs.useCodeFences`               | If `true`, wraps code chunks in fenced blocks for Markdown/HTML (default: `true`).                                                                                                    |
| `aggregateOpenTabs.aiSummaryStyle`              | Summaries can be `'concise'` or `'detailed'` (default: `concise`).                                                                                                                    |
| `aggregateOpenTabs.includeKeyPoints`            | If `true`, includes bullet-point key findings for each file (default: `true`).                                                                                                        |
| `aggregateOpenTabs.includeImports`              | If `true`, includes a list of imports for each file (default: `true`).                                                                                                                |
| `aggregateOpenTabs.includeExports`              | If `true`, includes a list of exports for each file (default: `true`).                                                                                                                |
| `aggregateOpenTabs.includeDependencies`         | If `true`, includes detected external package dependencies (default: `true`).                                                                                                         |
| `aggregateOpenTabs.tailoredSummaries`           | If `true`, attempts to tailor the AI summary to each file’s content (default: `true`).                                                                                                |
| `aggregateOpenTabs.outputFormat`                | Output format of the aggregated content (`plaintext`, `markdown`, or `html`). Default is `markdown`.                                                                                  |
| `aggregateOpenTabs.chunkSeparatorStyle`         | Controls how chunks are separated (`double`, `single`, `minimal`). Default is `double`.                                                                                               |
| `aggregateOpenTabs.codeFenceLanguageMap`        | Map of language IDs to code fence labels (e.g., `{ "typescript": "ts" }`).                                                                                                            |
| `aggregateOpenTabs.sensitiveDataHandling`       | How to handle sensitive data (`warn`, `redact`, `skip`, or `ignore`). Default is `warn`.                                                                                              |
| `aggregateOpenTabs.customRedactionPatterns`     | Array of regex patterns for additional sensitive data redaction (e.g., `["API_KEY_\\w+", "SECRET_\\w+"]`).                                                                            |
| `aggregateOpenTabs.openInNewWindow`             | If `true`, aggregated content opens in a new VS Code window (default: `false`).                                                                                                       |
| `aggregateOpenTabs.llmFriendly`                | If `true`, generates output optimized for LLM consumption with enhanced metadata (default: `true`).                                                                                    |
| `aggregateOpenTabs.filePurposeDetection`       | If `true`, analyzes files to determine their main purpose (default: `true`).                                                                                                          |
| `aggregateOpenTabs.dependencyTracking`         | If `true`, tracks and displays file dependencies (default: `true`).                                                                                                                    |
| `aggregateOpenTabs.directoryContext`           | If `true`, includes directory-level context and relationships (default: `true`).                                                                                                       |
| `aggregateOpenTabs.yamlMetadata`              | If `true`, formats metadata in YAML blocks for easier parsing (default: `true`).                                                                                                       |

### Configuration Panel

For a more intuitive setup experience, you can open a dedicated **configuration UI**:

1. Run the command:

Aggregate Open Tabs: Open Configuration

2. A webview panel will appear with chunking, file exclusion, output settings, security, and other options.

## Example Workflow

1. **Open Multiple Files** in VS Code—various file types such as `.ts`, `.md`, `.json`, etc.
2. **Check the Tree View** (Explorer sidebar):
- View “File Statistics” for total size and language/workspace distribution.
- Expand “Open Files” to see each open file with a short analysis.
3. **Click “Aggregate # Open Files”**:
- You’ll see a single aggregated document in the Preview or copied to your clipboard.
- The output includes enhanced metadata, file purposes, and relationships.
4. **Use the Preview**:
- Toggle the preview in the Tree View or run `extension.togglePreview`.
- Automatic refresh when you change files.
5. **Selective Aggregation**:
- Run `extension.selectiveAggregate` from the Command Palette.
- Uncheck unwanted files from the Quick Pick prompt.

### LLM-Friendly Output Example

The enhanced output includes:

```markdown
# Project Code Overview

## Project Structure
This document contains an aggregated view of the project's source code with enhanced metadata and analysis.
Each file is presented with its purpose, dependencies, and contextual information to aid in understanding.

## Table of Contents
- [main.ts](#main-ts) - Main entry point for the extension
- [utils.ts](#utils-ts) - Utility functions for file handling and analysis
...

## main.ts
### File Purpose
Main executable script | Defines extension activation and commands

### Directory Context
Source directory containing core extension functionality

### Dependencies
- `vscode`
- `./utils`
- `./treeView`

### Metadata
```yaml
path: src/main.ts
language: typescript
size: 2048 bytes
last_modified: 2025-01-16T00:00:00Z
```

### Source Code
```typescript
// File contents here...
```
```

## Security & Sensitive Data

- By default, the extension detects environment variables and other potential secrets.
- Configure handling under **`aggregateOpenTabs.sensitiveDataHandling`**:
- `warn`: Show a warning but still include them in aggregated content.
- `redact`: Mask out sensitive values (e.g., `SECRET_KEY` → `REDACTED`).
- `skip`: Skip lines or files containing sensitive data.
- `ignore`: Do nothing special with sensitive data.
- You can add your own **`customRedactionPatterns`** (as an array of regex patterns) to further refine redactions.

## Contributing

1. **Fork** the repository.
2. **Create** a new branch for your feature or bug fix.
3. **Commit** and push your changes with tests (if applicable).
4. **Open** a pull request, describing your modifications.

## License

This project is licensed under the [MIT License](./LICENSE).  
See the [LICENSE](./LICENSE) file for details.

---

**Enjoy using Aggregate Open Tabs!** If you have questions, suggestions, or issues, please open a GitHub Issue or submit a PR.

Happy coding!