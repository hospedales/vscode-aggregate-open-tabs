# Python Project Aggregator

A powerful standalone Python script that recursively traverses project directories and aggregates source code files into a single, well-structured document optimized for Large Language Model (LLM) comprehension. This script complements the VS Code extension by providing both a command-line interface and a graphical interface for project-wide file aggregation.

## Key Features

- **Intelligent File Analysis**
  - Framework and dependency detection
  - Cross-file reference tracking
  - Directory structure analysis
  - Purpose detection for files and directories
  - Language-specific parsing and analysis

- **LLM-Friendly Output**
  - Enhanced metadata with file purpose detection
  - Directory context and relationships
  - Standardized YAML metadata blocks
  - Smart chunking with summaries
  - Cross-reference annotations
  - Consistent section headers

- **Multiple Interfaces**
  - Command-line interface for automation
  - Graphical interface for interactive use
  - Programmatic API for integration

- **Security & Privacy**
  - Sensitive data detection (API keys, passwords)
  - Configurable redaction options
  - Custom pattern support
  - Respects `.gitignore` patterns

- **Performance Features**
  - Incremental processing
  - Change tracking between runs
  - Large file chunking
  - Memory-efficient processing

## Requirements

- Python 3.7 or higher
- No external dependencies (uses standard library only)
- Optional GUI requires Tkinter (included with most Python installations)

## Installation

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

## Usage

### Command-Line Interface

Basic usage:
```bash
./python_aggregator.py [options]
```

Options:
- `--root-dir PATH`: Root directory to start aggregation from (default: current directory)
- `--output-file PATH`: Output file path (default: print to stdout)
- `--exclude-dirs DIR1 DIR2 ...`: Additional directories to exclude
- `--format FORMAT`: Output format (markdown/html)
- `--chunk-size NUM`: Maximum lines per chunk (default: 2000, 0 to disable chunking)
- `--no-extra-spacing`: Disable extra spacing in output
- `--track-changes`: Track changes between aggregator runs
- `--redact`: Enable sensitive data redaction

### Graphical Interface

Launch the GUI:
```bash
./python_aggregator_gui.py
```

The GUI provides:
- Directory selection dialog
- Format and options configuration
- Real-time preview
- Progress tracking
- Status updates

### Programmatic API

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

## Output Formats

### Markdown (Default)
- Table of contents with file summaries
- Collapsible sections for metadata
- Syntax-highlighted code blocks
- Cross-reference visualization
- Change tracking information

Example:
\`\`\`markdown
# Project Overview

## Directory Structure
- src/
  - main.ts (Entry point | Handles extension activation)
  - utils.ts (Utility functions | File operations)
  
## File Contents

### src/main.ts
#### Purpose
Main entry point for the extension

#### Dependencies
- vscode
- ./utils

#### Cross References
- References: utils.ts (importUtils)
- Referenced By: extension.ts (activate)

#### Source
\`\`\`typescript
// File contents here...
\`\`\`
\`\`\`

### HTML
- Responsive layout
- Interactive table of contents
- Collapsible file sections
- Syntax highlighting
- Metadata tables
- Change tracking visualization

## Advanced Features

### Change Tracking
The script can track changes between runs:
```bash
# Enable change tracking
./python_aggregator.py --track-changes

# View changes in output
Added Files:
- src/new-feature.ts (added)

Modified Files:
- src/main.ts (modified)

Removed Files:
- src/deprecated.ts (removed)
```

### Incremental Processing
- Only processes changed files
- Maintains a cache for faster subsequent runs
- Tracks file additions, modifications, and deletions

### File Analysis
The script performs detailed analysis of each file:
- Language detection
- Framework identification
- Dependency extraction
- Cross-reference tracking
- Purpose detection
- Directory context

### Security Features
Built-in protection for sensitive data:
- API key detection
- Password pattern matching
- Private key identification
- Environment variable detection
- Custom pattern support
- Configurable redaction

## Configuration

### Ignored Patterns
By default, the script ignores:
- Version control directories (`.git/`)
- Package directories (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Cache directories (`__pycache__/`)
- System files (`.DS_Store`, `Thumbs.db`)
- Binary files (images, executables, etc.)

### Binary File Handling
Automatically excludes:
- Documents (PDF, DOC, etc.)
- Archives (ZIP, TAR, etc.)
- Executables (EXE, DLL)
- Media files (images, audio, video)
- Database files
- Compiled files

## Examples

1. Basic aggregation:
   ```bash
   ./python_aggregator.py
   ```

2. Save as HTML with custom options:
   ```bash
   ./python_aggregator.py \
     --format html \
     --output-file project.html \
     --chunk-size 1000 \
     --track-changes
   ```

3. Exclude directories and enable redaction:
   ```bash
   ./python_aggregator.py \
     --exclude-dirs node_modules dist temp \
     --redact \
     --output-file safe-output.md
   ```

4. Process specific directory with change tracking:
   ```bash
   ./python_aggregator.py \
     --root-dir /path/to/project \
     --track-changes \
     --format markdown
   ```

## Error Handling

The script includes robust error handling for:
- File access issues
- Encoding problems
- Memory constraints
- Invalid patterns
- Binary file detection

Errors are logged with appropriate detail while allowing the script to continue processing other files.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

### Running Tests
```bash
python -m pytest tests/test_python_aggregator.py
```

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details. 