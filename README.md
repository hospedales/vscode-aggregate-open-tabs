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
  - **NEW**: Python script for project-wide file aggregation (see [Python Aggregator](#python-aggregator)).

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
  - Output can be formatted as **Markdown**, **Plain Text**, or **HTML**  
  - Control chunk separation style, code fence languages, extra spacing, and more
  - **NEW**: Five customizable summary depths (minimal, basic, standard, detailed, comprehensive)
  - **NEW**: Preset configurations for different use cases (development, documentation, etc.)

- **Preview Panel**  
  - View the aggregated result in real time in a separate webview
  - Automatically refreshes when files are edited
  - **NEW**: Split view with source and preview
  - **NEW**: Real-time search with match highlighting
  - **NEW**: Collapsible sections with smooth animations
  - **NEW**: Syntax highlighting for code blocks

- **Selective Aggregation**  
  - Quickly pick and choose which files to include via a Quick Pick interface

- **Cross-References & Tags**
  - Track relationships between files with import/export analysis
  - Apply custom tags with colors and descriptions
  - Tag inheritance for directories
  - Visual representation in preview

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
| `aggregateOpenTabs.aiSummaryStyle`              | Summary depth level: `'minimal'`, `'basic'`, `'standard'`, `'detailed'`, or `'comprehensive'` (default: `standard`).                                                                   |
| `aggregateOpenTabs.includeKeyPoints`            | If `true`, includes bullet-point key findings for each file (default: `true`).                                                                                                        |
| `aggregateOpenTabs.includeImports`              | If `true`, includes a list of imports for each file (default: `true`).                                                                                                                |
| `aggregateOpenTabs.includeExports`              | If `true`, includes a list of exports for each file (default: `true`).                                                                                                                |
| `aggregateOpenTabs.includeDependencies`         | If `true`, includes detected external package dependencies (default: `true`).                                                                                                         |
| `aggregateOpenTabs.tailoredSummaries`           | If `true`, attempts to tailor the AI summary to each file's content (default: `true`).                                                                                                |
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
| `aggregateOpenTabs.previewSplitView`          | If `true`, enables split view in preview panel with source and preview panes (default: `true`).                                                                                        |
| `aggregateOpenTabs.previewAutoRefresh`        | If `true`, preview updates automatically when files change (default: `true`).                                                                                                          |
| `aggregateOpenTabs.previewSyntaxHighlight`    | If `true`, enables syntax highlighting in preview (default: `true`).                                                                                                                   |
| `aggregateOpenTabs.previewCollapsibleSections`| If `true`, enables collapsible sections in preview (default: `true`).                                                                                                                 |

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
summary_depth: comprehensive
```

### Cross References
<details>
<summary>References and Dependencies</summary>

**References:**
- → `./utils.ts` (importUtils) - Line 12
  - Context: Imports utility functions for file handling
- → `./treeView.ts` (TreeProvider) - Line 15
  - Context: Imports tree view provider for file visualization

**Referenced By:**
- ← `extension.ts` (activate) - Line 25
  - Context: Main extension entry point
</details>

### Source Code
```typescript
// File contents here...
```
```

## Summary Depth Levels

The extension now supports five levels of detail for file analysis:

1. **Minimal**: Basic file information and core purpose
2. **Basic**: Adds frameworks and up to 2 key features
3. **Standard**: Includes dependencies and up to 5 key points
4. **Detailed**: Adds imports/exports, cross-references, and up to 10 key points
5. **Comprehensive**: Shows all available information with additional context

## Enhanced Preview Panel

The preview panel has been significantly improved with:

1. **Split View**
   - Side-by-side view of source and preview
   - Resizable split panes
   - Synchronized scrolling

2. **Real-time Updates**
   - Auto-refresh with file changes
   - Debounced updates for performance
   - Progress indicators for long operations

3. **Search & Navigation**
   - Real-time search with match highlighting
   - Match count indicators
   - Jump to definition support

4. **Visual Enhancements**
   - Syntax highlighting for code blocks
   - Collapsible sections with animations
   - Native VSCode styling

## Improved Configuration UI

A new visual configuration panel provides:

1. **Split Layout**
   - Settings panel on the left
   - Live preview on the right

2. **Preset Configurations**
   - Minimal: Basic file information only
   - Standard: Balanced set of features
   - Detailed: Comprehensive analysis
   - Development: Optimized for development workflow
   - Documentation: Optimized for documentation generation

3. **Enhanced UX**
   - Real-time settings preview
   - Import/export functionality
   - Improved pattern management
   - Native VSCode styling

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

## Python Aggregator

A standalone Python script is now available for project-wide file aggregation. This complements the VS Code extension by providing both a command-line interface and a graphical interface that can process entire project directories, not just open tabs.

### Key Features
- **Intelligent File Analysis**
  - Framework and dependency detection
  - Cross-file reference tracking
  - Directory structure analysis
  - Purpose detection for source code files
  - Language-specific parsing and analysis

- **Multiple Interfaces**
  - Command-line interface for automation
  - Graphical interface with real-time preview
  - Programmatic API for integration

- **Performance Features**
  - Incremental processing
  - Change tracking between runs
  - Large file chunking
  - Memory-efficient processing

- **Security & Privacy**
  - Sensitive data detection (API keys, passwords)
  - Configurable redaction options
  - Custom pattern support
  - Respects `.gitignore` patterns

### File Type Support
- **Fully Supported**: Python, JavaScript/TypeScript, Java, C/C++, Go, Ruby, PHP, Shell scripts, Configuration files
- **Partially Supported**: Markdown, HTML/CSS, Plain text, XML/SVG, Environment files
- **Unsupported**: Binary files, Images, Audio/video, Compiled files, Archives

### Requirements
- Python 3.7 or higher
- No external dependencies (uses standard library only)
- Optional GUI requires Tkinter (included with most Python installations)

### Installation

1. Copy the script files to your project:
   ```bash
   # Command-line version
   cp python_aggregator.py /path/to/your/project/

   # GUI version (optional)
   cp python_aggregator_gui.py /path/to/your/project/
   ```

2. Make the scripts executable (Unix-like systems):
   ```bash
   chmod +x python_aggregator.py
   chmod +x python_aggregator_gui.py  # if using GUI
   ```

### Usage

#### Command-Line Interface
```bash
./python_aggregator.py [options]
```

Available options:
- `--root-dir PATH`: Root directory to start aggregation from (default: current directory)
- `--output-file PATH`: Output file path (default: print to stdout)
- `--exclude-dirs DIR1 DIR2 ...`: Additional directories to exclude
- `--format FORMAT`: Output format (markdown/html)
- `--chunk-size NUM`: Maximum lines per chunk (default: 2000, 0 to disable chunking)
- `--track-changes`: Track changes between aggregator runs
- `--redact`: Enable sensitive data redaction
- `--no-extra-spacing`: Disable extra spacing in output
- `--ignore-errors`: Continue processing on non-critical errors
- `--verbose`: Enable detailed logging output

#### Error Handling
The script includes robust error handling:
- **Critical Errors** (stop processing): Invalid arguments, permission issues, memory errors
- **Non-Critical Errors** (warning only): Purpose detection failures, unsupported files, encoding issues
- Use `--ignore-errors` to continue processing on non-critical errors
- Use `--verbose` for detailed error information

#### Graphical Interface
Launch the GUI for an interactive experience:
```bash
./python_aggregator_gui.py
```

Features:
- Directory selection dialog
- Format and options configuration
- Real-time preview
- Progress tracking
- Status updates

#### Programmatic API
```python
from python_aggregator import aggregate_files

# Basic usage
output = aggregate_files("path/to/project")

# Advanced usage with options
output = aggregate_files(
    root_dir="path/to/project",
    output_format="html",
    track_changes=True,
    chunk_size=1000
)
```

### Examples

1. Basic aggregation of current directory:
   ```bash
   ./python_aggregator.py
   ```

2. Generate HTML with change tracking:
   ```bash
   ./python_aggregator.py \
     --format html \
     --output-file project.html \
     --track-changes
   ```

3. Exclude directories and enable redaction:
   ```bash
   ./python_aggregator.py \
     --exclude-dirs node_modules dist temp \
     --redact \
     --output-file safe-output.md
   ```

4. Process specific directory with custom chunk size:
   ```bash
   ./python_aggregator.py \
     --root-dir /path/to/project \
     --chunk-size 1000
   ```

### Advanced Features

#### Change Tracking
Track modifications between runs:
```bash
./python_aggregator.py --track-changes

# Output includes:
Added Files:
- src/new-feature.ts

Modified Files:
- src/main.ts

Removed Files:
- src/deprecated.ts
```

#### Incremental Processing
- Only processes changed files
- Maintains a cache for faster subsequent runs
- Tracks file additions, modifications, and deletions

#### Security Features
Built-in protection for sensitive data:
- API key detection
- Password pattern matching
- Private key identification
- Environment variable detection
- Custom pattern support
- Configurable redaction

For more detailed information about the Python script, see [python_aggregator.md](./python_aggregator.md).