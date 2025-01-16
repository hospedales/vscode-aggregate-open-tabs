# Python Project Aggregator

A standalone Python script that recursively traverses project directories and aggregates all text files into a single output file. This script complements the VS Code extension by providing a command-line interface for project-wide file aggregation.

## Features

- Recursive directory traversal
- Multiple output formats (plaintext, markdown, HTML)
- Sensitive data detection and redaction
- Configurable file chunking
- Customizable file exclusions
- Support for various programming languages

## Requirements

- Python 3.7 or higher
- No external dependencies required (uses standard library only)

## Installation

1. Copy `python_aggregator.py` to your project directory
2. Make it executable (Unix-like systems):
   ```bash
   chmod +x python_aggregator.py
   ```

## Usage

Basic usage:
```bash
./python_aggregator.py [options]
```

Options:
- `--root-dir PATH`: Root directory to start aggregation from (default: current directory)
- `--output-file PATH`: Output file path (default: print to stdout)
- `--exclude-dirs DIR1 DIR2 ...`: Additional directories to exclude
- `--redact`: Enable sensitive data redaction
- `--format FORMAT`: Output format (plaintext/markdown/html)
- `--chunk-size NUM`: Maximum lines per chunk (default: 2000, 0 to disable chunking)
- `--no-extra-spacing`: Disable extra spacing in output

### Examples

1. Aggregate all files in the current directory:
   ```bash
   ./python_aggregator.py
   ```

2. Save output to a file in markdown format:
   ```bash
   ./python_aggregator.py --format markdown --output-file project.md
   ```

3. Exclude specific directories and enable redaction:
   ```bash
   ./python_aggregator.py --exclude-dirs build dist temp --redact
   ```

4. Process a specific directory with custom chunk size:
   ```bash
   ./python_aggregator.py --root-dir /path/to/project --chunk-size 1000
   ```

## Output Formats

### Plaintext
- Simple text format with clear file separators
- File metadata in comments
- Optional chunking for large files

### Markdown
- Table of contents with links
- Collapsible file metadata sections
- Syntax-highlighted code blocks
- File chunking with clear labels

### HTML
- Responsive layout
- Table of contents with navigation
- Syntax-highlighted code blocks
- Metadata in tables
- Modern styling

## Security Features

The script includes security features to protect sensitive data:

- Detection of API keys
- Password detection
- Email address detection
- Private key detection
- Configurable redaction
- Custom pattern support

## Default Ignored Patterns

The following patterns are ignored by default:
- `node_modules/`
- `.git/`
- `.DS_Store`
- `Thumbs.db`
- `__pycache__/`
- `.pyc` (Python compiled files)
- `.pyo` (Python optimized files)
- `.pyd` (Python dynamic libraries)

## Binary File Handling

The script automatically excludes common binary file types:
- Documents (PDF, DOC, DOCX, etc.)
- Archives (ZIP, TAR, etc.)
- Executables (EXE, DLL, etc.)
- Images (JPG, PNG, etc.)
- Media files (MP3, MP4, etc.)
- Fonts (TTF, OTF, etc.)

## Error Handling

The script includes robust error handling:
- File access issues
- Encoding problems
- Invalid patterns
- Memory constraints

Errors are logged with appropriate detail level while allowing the script to continue processing other files.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Submit a pull request

## License

This project is licensed under the same terms as the VS Code extension. 