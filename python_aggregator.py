#!/usr/bin/env python3

import argparse
import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Pattern, Set

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class SensitiveMatch:
    """Represents a match of sensitive data in the content."""
    pattern: str
    value: str
    start: int
    end: int

@dataclass
class FileMetadata:
    """Represents metadata and content of a file."""
    file_name: str
    relative_path: str
    content: str
    size: int
    last_modified: str
    language_id: str
    chunk_info: Optional[str] = None

# Sensitive data patterns ported from TypeScript implementation
SENSITIVE_PATTERNS = [
    {
        "name": "API Key",
        "pattern": re.compile(r'(["\']?(?:api[_-]?key|api[_-]?token|access[_-]?token|auth[_-]?token)["\']?\s*[:=]\s*["\']?([^"\'\n]+)["\']?)', re.IGNORECASE),
        "group": 2
    },
    {
        "name": "Password",
        "pattern": re.compile(r'(["\']?(?:password|passwd|pwd)["\']?\s*[:=]\s*["\']?([^"\'\n]+)["\']?)', re.IGNORECASE),
        "group": 2
    },
    {
        "name": "Email",
        "pattern": re.compile(r'(["\']?(?:email|e-mail)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["\']?)', re.IGNORECASE),
        "group": 2
    },
    {
        "name": "Private Key",
        "pattern": re.compile(r'(-----BEGIN [^\n]+?PRIVATE KEY-----[^-]+?-----END [^\n]+?PRIVATE KEY-----)', re.DOTALL),
        "group": 1
    },
    {
        "name": "Environment Variable",
        "pattern": re.compile(r'([A-Z_]+)=([^\n]+)'),
        "group": 2
    }
]

def get_file_metadata(file_path: Path) -> FileMetadata:
    """Get metadata for a file."""
    stats = file_path.stat()
    content = file_path.read_text()
    
    return FileMetadata(
        file_name=file_path.name,
        relative_path=str(file_path.relative_to(file_path.parent.parent)),
        content=content,
        size=stats.st_size,
        last_modified=datetime.fromtimestamp(stats.st_mtime).isoformat(),
        language_id=get_language_from_path(file_path)
    )

def get_language_from_path(file_path: Path) -> str:
    """Get the language identifier from file extension."""
    ext = file_path.suffix.lower()
    language_map = {
        '.js': 'javascript',
        '.jsx': 'javascriptreact',
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c',
        '.cpp': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.m': 'objective-c',
        '.h': 'c',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.html': 'html',
        '.sql': 'sql',
        '.sh': 'shell',
        '.bash': 'shell',
        '.zsh': 'shell',
        '.ps1': 'powershell'
    }
    return language_map.get(ext, 'plaintext')

def should_ignore_file(file_path: Path) -> bool:
    """Check if a file should be ignored."""
    ignore_patterns = [
        r'node_modules',
        r'\.git/',
        r'\.DS_Store$',
        r'Thumbs\.db$'
    ]
    
    str_path = str(file_path)
    return any(re.search(pattern, str_path) for pattern in ignore_patterns)

def is_text_file(file_path: Path) -> bool:
    """Check if a file is a text file."""
    binary_extensions = {
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.zip', '.tar', '.gz', '.7z', '.rar',
        '.exe', '.dll', '.so', '.dylib',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        '.mp3', '.mp4', '.avi', '.mov',
        '.ttf', '.otf', '.woff', '.woff2'
    }
    return file_path.suffix.lower() not in binary_extensions

def detect_sensitive_data(content: str, custom_patterns: List[str] = None) -> List[SensitiveMatch]:
    """Detect sensitive data in content."""
    matches = []
    
    # Check built-in patterns
    for pattern_info in SENSITIVE_PATTERNS:
        for match in pattern_info["pattern"].finditer(content):
            value = match.group(pattern_info["group"])
            pattern = match.group(0)
            # Extract just the key name for the pattern
            key_match = re.search(r'["\']?([\w_-]+)["\']?\s*[:=]', pattern)
            pattern_name = key_match.group(1) if key_match else pattern
            
            matches.append(SensitiveMatch(
                pattern=pattern_name,
                value=value,
                start=match.start(),
                end=match.end()
            ))
    
    # Check custom patterns
    if custom_patterns:
        for pattern_str in custom_patterns:
            try:
                pattern = re.compile(pattern_str, re.IGNORECASE)
                for match in pattern.finditer(content):
                    matches.append(SensitiveMatch(
                        pattern=pattern_str,
                        value=match.group(0),
                        start=match.start(),
                        end=match.end()
                    ))
            except re.error as e:
                logger.warning(f"Invalid custom pattern '{pattern_str}': {e}")
    
    return matches

def redact_sensitive_data(content: str, matches: List[SensitiveMatch]) -> str:
    """Redact sensitive data from content."""
    # Sort matches by start position in reverse order to avoid offset issues
    sorted_matches = sorted(matches, key=lambda m: m.start, reverse=True)
    
    redacted = content
    for match in sorted_matches:
        redaction = '*' * len(match.value)
        redacted = (
            redacted[:match.start] +
            redacted[match.start:match.end].replace(match.value, redaction) +
            redacted[match.end:]
        )
    
    return redacted

class BaseFormatter(ABC):
    """Base class for output formatters."""
    
    def __init__(self, chunk_size: int = 2000, extra_spacing: bool = True):
        self.chunk_size = chunk_size
        self.extra_spacing = extra_spacing

    @abstractmethod
    def format(self, files: List[FileMetadata]) -> str:
        """Format the files into a single output string."""
        pass

    def _chunk_content(self, content: str) -> List[str]:
        """Split content into chunks based on chunk_size."""
        if not self.chunk_size or self.chunk_size <= 0:
            return [content]
        
        lines = content.splitlines()
        chunks = []
        current_chunk = []
        current_size = 0
        
        for line in lines:
            line_size = len(line) + 1  # +1 for newline
            if current_size + line_size > self.chunk_size and current_chunk:
                chunks.append('\n'.join(current_chunk))
                current_chunk = []
                current_size = 0
            current_chunk.append(line)
            current_size += line_size
        
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        return chunks

class PlainTextFormatter(BaseFormatter):
    """Formats output as plain text."""
    
    def format(self, files: List[FileMetadata]) -> str:
        output = []
        separator = "=" * 79
        
        for file in files:
            chunks = self._chunk_content(file.content)
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Chunk {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                
                header = [
                    f"\n//{separator}",
                    f"// File: {file.file_name}{chunk_info}",
                    f"//{separator}",
                    "",
                    "// File Metadata",
                    "// -------------",
                    f"// Language: {file.language_id}",
                    f"// Size: {file.size} bytes",
                    f"// Last Modified: {file.last_modified}",
                    "",
                    f"//{separator}",
                ]
                
                if self.extra_spacing:
                    header.append("")
                
                output.extend(header)
                output.append(chunk)
                
                if self.extra_spacing:
                    output.append("")
                output.append(f"//{separator}\n")
        
        return '\n'.join(output)

class MarkdownFormatter(BaseFormatter):
    """Formats output as markdown."""
    
    def format(self, files: List[FileMetadata]) -> str:
        output = ["# Aggregated Files\n"]
        
        # Generate table of contents
        output.append("## Table of Contents\n")
        for file in files:
            slug = self._slugify(file.file_name)
            output.append(f"- [{file.file_name}](#{slug})\n")
        
        # Add each file
        for file in files:
            chunks = self._chunk_content(file.content)
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Chunk {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                
                output.extend([
                    f"\n## {file.file_name}{chunk_info}",
                    "",
                    "<details><summary>File Metadata</summary>",
                    "",
                    "| Property | Value |",
                    "|----------|--------|",
                    f"| Language | {file.language_id} |",
                    f"| Size | {file.size} bytes |",
                    f"| Last Modified | {file.last_modified} |",
                    "",
                    "</details>",
                    "",
                    f"```{file.language_id}",
                    chunk,
                    "```",
                    ""
                ])
        
        return '\n'.join(output)
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

class HTMLFormatter(BaseFormatter):
    """Formats output as HTML."""
    
    def format(self, files: List[FileMetadata]) -> str:
        output = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            '<meta charset="utf-8">',
            "<title>Aggregated Files</title>",
            "<style>",
            "body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }",
            ".file-section { margin: 2em 0; }",
            ".file-title { color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5em; }",
            ".file-metadata { margin: 1em 0; }",
            ".file-metadata table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }",
            ".file-metadata th, .file-metadata td { padding: 0.5em; text-align: left; border: 1px solid #ddd; }",
            ".file-metadata th { background: #f5f5f5; }",
            "pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }",
            "</style>",
            "</head>",
            "<body>",
            "<h1>Aggregated Files</h1>"
        ]
        
        # Add table of contents
        output.extend([
            "<h2>Table of Contents</h2>",
            "<ul>"
        ])
        for file in files:
            slug = self._slugify(file.file_name)
            output.append(f'<li><a href="#{slug}">{file.file_name}</a></li>')
        output.append("</ul>")
        
        # Add each file
        for file in files:
            chunks = self._chunk_content(file.content)
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Chunk {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                slug = self._slugify(file.file_name)
                
                output.extend([
                    f'<div class="file-section" id="{slug}">',
                    f'<h2 class="file-title">{file.file_name}{chunk_info}</h2>',
                    '<div class="file-metadata">',
                    "<table>",
                    "<tr><th>Property</th><th>Value</th></tr>",
                    f"<tr><td>Language</td><td>{file.language_id}</td></tr>",
                    f"<tr><td>Size</td><td>{file.size} bytes</td></tr>",
                    f"<tr><td>Last Modified</td><td>{file.last_modified}</td></tr>",
                    "</table>",
                    "</div>",
                    f'<pre><code class="language-{file.language_id}">',
                    self._escape_html(chunk),
                    "</code></pre>",
                    "</div>"
                ])
        
        output.extend([
            "</body>",
            "</html>"
        ])
        
        return '\n'.join(output)
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    
    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters."""
        return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#039;'))

def aggregate_files(
    root_dir: str,
    exclude_dirs: List[str] = None,
    redact: bool = False,
    output_format: str = "plaintext",
    chunk_size: int = 2000,
    extra_spacing: bool = True
) -> str:
    """Aggregate files from a directory into a single output."""
    root_path = Path(root_dir)
    if not root_path.is_dir():
        raise ValueError(f"'{root_dir}' is not a directory")
    
    # Add custom exclude patterns to the default ones
    exclude_patterns = set(exclude_dirs or [])
    
    # Collect files
    files: List[FileMetadata] = []
    for file_path in root_path.rglob('*'):
        if (file_path.is_file() and
            not should_ignore_file(file_path) and
            not any(p in str(file_path) for p in exclude_patterns) and
            is_text_file(file_path)):
            try:
                metadata = get_file_metadata(file_path)
                
                # Handle sensitive data if redaction is enabled
                if redact:
                    matches = detect_sensitive_data(metadata.content)
                    if matches:
                        metadata.content = redact_sensitive_data(metadata.content, matches)
                        # Also redact any sensitive data in the file path
                        metadata.relative_path = redact_sensitive_data(metadata.relative_path, matches)
                
                files.append(metadata)
            except Exception as e:
                logger.warning(f"Error processing {file_path}: {e}")
    
    # Sort files by path for consistent output
    files.sort(key=lambda f: f.relative_path)
    
    # Create appropriate formatter
    formatter_map = {
        "plaintext": PlainTextFormatter,
        "markdown": MarkdownFormatter,
        "html": HTMLFormatter
    }
    formatter_class = formatter_map.get(output_format.lower(), PlainTextFormatter)
    formatter = formatter_class(chunk_size=chunk_size, extra_spacing=extra_spacing)
    
    # Format output
    return formatter.format(files)

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Aggregate project files into a single output file."
    )
    parser.add_argument(
        "--root-dir",
        default=".",
        help="Root directory to start aggregation from (default: current directory)"
    )
    parser.add_argument(
        "--output-file",
        help="Output file path (default: print to stdout)"
    )
    parser.add_argument(
        "--exclude-dirs",
        nargs="+",
        help="Additional directories to exclude"
    )
    parser.add_argument(
        "--redact",
        action="store_true",
        help="Enable sensitive data redaction"
    )
    parser.add_argument(
        "--format",
        choices=["plaintext", "markdown", "html"],
        default="plaintext",
        help="Output format (default: plaintext)"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=2000,
        help="Maximum lines per chunk (default: 2000, 0 to disable chunking)"
    )
    parser.add_argument(
        "--no-extra-spacing",
        action="store_true",
        help="Disable extra spacing in output"
    )
    
    args = parser.parse_args()
    
    try:
        output = aggregate_files(
            root_dir=args.root_dir,
            exclude_dirs=args.exclude_dirs,
            redact=args.redact,
            output_format=args.format,
            chunk_size=args.chunk_size,
            extra_spacing=not args.no_extra_spacing
        )
        
        if args.output_file:
            Path(args.output_file).write_text(output)
            logger.info(f"Output written to {args.output_file}")
        else:
            print(output)
            
    except Exception as e:
        logger.error(f"Error: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main()) 