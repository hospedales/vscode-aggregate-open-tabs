# Python Project Aggregator

A powerful standalone Python script that recursively traverses project directories and aggregates source code files into a single, well-structured document optimized for Large Language Model (LLM) comprehension. This script complements the VS Code extension by providing both a command-line interface and a graphical interface for project-wide file aggregation.

## Key Features

- **Intelligent File Analysis**
  - Framework and dependency detection
  - Cross-file reference tracking
  - Directory structure analysis
  - Purpose detection for source code files
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

## File Type Support

### Fully Supported File Types
- Python (`.py`)
- JavaScript/TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`)
- Java (`.java`)
- C/C++ (`.c`, `.cpp`, `.h`, `.hpp`)
- Go (`.go`)
- Ruby (`.rb`)
- PHP (`.php`)
- Shell scripts (`.sh`, `.bash`)
- Configuration files (`.json`, `.yaml`, `.toml`)

### Partially Supported File Types
- Markdown (`.md`) - Content aggregation only
- HTML/CSS - Basic content aggregation
- Plain text (`.txt`) - Basic content aggregation
- XML/SVG - Basic content aggregation
- Environment files (`.env`) - Content with redaction

### Unsupported File Types
- Binary files
- Image files
- Audio/video files
- Compiled files
- Compressed archives

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

### Error Handling

The script includes comprehensive error handling for various scenarios:

#### Critical Errors (Stop Processing)
- Invalid command-line arguments
- Invalid output format
- Permission denied errors
- Memory exhaustion
- Invalid regex patterns

#### Non-Critical Errors (Warning Only)
- Purpose detection failures
- Unsupported file types
- Encoding issues
- Parse errors in specific files
- Missing optional metadata

Error messages are logged with appropriate detail levels:
```bash
# Example output with warnings
2025-01-16 08:36:57,489 - WARNING - Error generating purpose for file.txt: invalid syntax
2025-01-16 08:36:57,490 - WARNING - Error processing binary file: image.png
2025-01-16 08:36:57,525 - INFO - Successfully processed: main.py
```

### Best Practices

1. **File Type Handling**
   - Use `--exclude-dirs` to skip irrelevant directories
   - Focus on supported file types for best results
   - Use appropriate format for your use case

2. **Error Management**
   - Use `--verbose` for detailed error information
   - Use `--ignore-errors` for large projects
   - Check logs for warning patterns

3. **Performance Optimization**
   - Enable incremental processing for large projects
   - Use appropriate chunk sizes
   - Exclude unnecessary directories

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