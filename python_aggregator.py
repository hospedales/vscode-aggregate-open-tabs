#!/usr/bin/env python3

import argparse
import json
import logging
import re
import fnmatch
import ast
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Pattern, Set, Dict

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
class ChunkMetadata:
    """Represents metadata for a chunk of a large file."""
    start_line: int
    end_line: int
    summary: str
    content: str

@dataclass
class DirectoryMetadata:
    """Represents metadata for a directory."""
    name: str
    purpose: str
    files: List[str]
    parent: Optional[str] = None
    subdirectories: List[str] = field(default_factory=list)

@dataclass
class FileMetadata:
    """Represents metadata and content of a file."""
    file_name: str
    relative_path: str
    content: str
    size: int
    last_modified: str
    language_id: str
    purpose: Optional[str] = None
    dependencies: Set[str] = field(default_factory=set)
    directory_context: Optional[str] = None
    chunk_info: Optional[str] = None
    chunks: List[ChunkMetadata] = field(default_factory=list)
    _file_analysis: Optional[str] = field(default=None)
    
    @property
    def formatted_content(self) -> str:
        """Get content with code fences and chunk demarcation."""
        if not self.chunks:
            return f"```{self.language_id}\n{self.content}\n```"
        
        formatted_chunks = []
        for i, chunk in enumerate(self.chunks, 1):
            formatted_chunks.append(
                f"Chunk {i} of {len(self.chunks)}\n"
                f"```{self.language_id}\n{chunk.content}\n```"
            )
        return "\n\n".join(formatted_chunks)
    
    @property
    def file_analysis(self) -> str:
        """Get file analysis summary."""
        if self._file_analysis is None:
            try:
                tree = ast.parse(self.content)
                
                classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
                functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                
                summary = ["### Quick Analysis"]
                if classes:
                    summary.append(f"- **Classes Defined:** {', '.join(sorted(classes))}")
                if functions:
                    summary.append(f"- **Primary Functions:** {', '.join(sorted(functions))}")
                if self.dependencies:
                    deps = sorted(self.dependencies)
                    # Filter out full paths and keep only top-level module names for display
                    top_level_deps = sorted({d.split('.')[0] for d in deps})
                    summary.append(f"- **Key Dependencies:** {', '.join(top_level_deps)}")
                
                self._file_analysis = '\n'.join(summary)
            except (SyntaxError, UnicodeDecodeError):
                self._file_analysis = "Unable to analyze file content"
        return self._file_analysis
    
    @file_analysis.setter
    def file_analysis(self, value: str) -> None:
        """Set file analysis summary."""
        self._file_analysis = value

class GitIgnoreFilter:
    """Filter for checking paths against .gitignore patterns."""
    
    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.patterns = self._load_gitignore()
    
    def _load_gitignore(self) -> List[str]:
        """Load patterns from .gitignore file."""
        gitignore_path = self.root_dir / '.gitignore'
        patterns = []
        
        if gitignore_path.exists():
            with open(gitignore_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Skip empty lines and comments
                    if line and not line.startswith('#'):
                        # Convert pattern to work with Path objects
                        pattern = line.rstrip('/')  # Remove trailing slashes
                        if pattern.startswith('/'):
                            # Patterns starting with / are relative to root
                            pattern = pattern[1:]
                        # Handle directory names without slashes
                        if '/' not in pattern and not pattern.startswith('*'):
                            # Match both the directory and its contents
                            patterns.append(f"{pattern}/**")
                            patterns.append(f"{pattern}")
                        else:
                            # If pattern doesn't start with * or /, make it match anywhere in path
                            if not pattern.startswith(('*', '/')):
                                pattern = f"**/{pattern}"
                            patterns.append(pattern)
        
        return patterns
    
    def should_ignore(self, path: Path) -> bool:
        """Check if a path matches any .gitignore pattern."""
        try:
            # Get path relative to root directory
            rel_path = path.relative_to(self.root_dir)
            str_path = str(rel_path).replace('\\', '/')  # Normalize path separators
            
            # Also check if any parent directory matches
            paths_to_check = [str_path]
            parent = rel_path.parent
            while parent != Path('.'):
                parent_str = str(parent).replace('\\', '/')
                paths_to_check.append(f"{parent_str}/")
                paths_to_check.append(parent_str)  # Also check without trailing slash
                parent = parent.parent
            
            for pattern in self.patterns:
                for path_to_check in paths_to_check:
                    if fnmatch.fnmatch(path_to_check, pattern):
                        return True
            
            return False
        except ValueError:
            # Path is not relative to root_dir
            return False

def should_ignore_file(file_path: Path, git_ignore_filter: Optional[GitIgnoreFilter] = None) -> bool:
    """Check if a file should be ignored."""
    ignore_patterns = [
        r'node_modules',
        r'\.git/',
        r'\.DS_Store$',
        r'Thumbs\.db$',
        r'__pycache__',  # Ignore Python cache directories
        r'\.pyc$',       # Ignore Python compiled files
        r'\.pyo$',       # Ignore Python optimized files
        r'\.pyd$',       # Ignore Python dynamic libraries
        r'\.pytest_cache',
        r'\.coverage',
        r'\.tox',
        r'\.env',
        r'\.venv',
        r'venv/',
        r'env/',
        r'build/',
        r'dist/',
        r'\.egg-info',
        r'\.mypy_cache',
    ]
    
    str_path = str(file_path)
    
    # Check built-in ignore patterns
    if any(re.search(pattern, str_path) for pattern in ignore_patterns):
        return True
    
    # Check .gitignore patterns if filter is provided
    if git_ignore_filter and git_ignore_filter.should_ignore(file_path):
        return True
    
    return False

def is_text_file(file_path: Path) -> bool:
    """Check if a file is a text file."""
    binary_extensions = {
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.zip', '.tar', '.gz', '.7z', '.rar',
        '.exe', '.dll', '.so', '.dylib',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        '.mp3', '.mp4', '.avi', '.mov',
        '.ttf', '.otf', '.woff', '.woff2',
        '.pyc', '.pyo', '.pyd',  # Python compiled files
        '.o', '.obj',  # Object files
        '.bin', '.dat',  # Binary data files
        '.db', '.sqlite', '.sqlite3',  # Database files
        '.jar', '.war', '.ear',  # Java archives
        '.class',  # Java compiled files
        '.pak', '.cache',  # Various cache files
        '.ico', '.icns',  # Icon files
        '.tif', '.tiff', '.raw',  # More image formats
        '.wav', '.aac', '.m4a',  # More audio formats
        '.mkv', '.wmv', '.flv',  # More video formats
        '.iso', '.img',  # Disk images
        '.svgz', '.eot',  # Compressed web fonts
        '.msi', '.app',  # Installers
        '.pdb', '.ilk',  # Debug files
    }
    return file_path.suffix.lower() not in binary_extensions

def get_file_metadata(file_path: Path, root_path: Optional[Path] = None) -> FileMetadata:
    """Get enhanced metadata for a file."""
    stats = file_path.stat()
    content = file_path.read_text()
    
    # Use the file's parent as root_path if none provided
    if root_path is None:
        root_path = file_path.parent
    
    try:
        relative_path = str(file_path.relative_to(root_path))
    except ValueError:
        relative_path = str(file_path.relative_to(file_path.parent))
    
    # Get basic metadata
    metadata = FileMetadata(
        file_name=file_path.name,
        relative_path=relative_path,
        content=content,
        size=stats.st_size,
        last_modified=datetime.fromtimestamp(stats.st_mtime).isoformat(),
        language_id=get_language_from_path(file_path)
    )
    
    # Add enhanced metadata
    if metadata.language_id == 'python':
        metadata.purpose = generate_file_purpose(file_path) or "General-purpose file"
        metadata.dependencies = extract_dependencies(file_path)
        
        # Analyze import statements for cross-file references
        try:
            with open(file_path, 'r') as f:
                tree = ast.parse(f.read())
                for node in ast.walk(tree):
                    if isinstance(node, (ast.Import, ast.ImportFrom)):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                metadata.dependencies.append(alias.name)
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                for alias in node.names:
                                    metadata.dependencies.append(f"{node.module}.{alias.name}")
        except Exception as e:
            logger.warning(f"Error parsing imports in {file_path}: {e}")
    
    # Add directory context
    parent_dir = file_path.parent
    if parent_dir != root_path:
        metadata.directory_context = f"Part of the '{parent_dir.name}' directory"
    else:
        metadata.directory_context = "Root directory of the project"
    
    # Handle large files with chunking
    if len(content.splitlines()) > 500:  # Chunk files over 500 lines
        chunks = []
        lines = content.splitlines()
        chunk_size = 200  # Lines per chunk
        
        for i in range(0, len(lines), chunk_size):
            chunk_lines = lines[i:i + chunk_size]
            chunk = ChunkMetadata(
                start_line=i + 1,
                end_line=min(i + chunk_size, len(lines)),
                summary=f"Lines {i + 1}-{min(i + chunk_size, len(lines))}",
                content='\n'.join(chunk_lines)
            )
            chunks.append(chunk)
        
        metadata.chunks = chunks
        metadata.chunk_info = f"File split into {len(chunks)} chunks"
    
    return metadata

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

def generate_file_purpose(file_path: Path) -> str:
    """Analyze a file to determine its main purpose."""
    try:
        content = file_path.read_text()
        tree = ast.parse(content)
        
        # First check for file-level docstring or comment
        first_line = content.strip().split('\n')[0]
        if first_line.startswith('#'):
            return first_line.lstrip('#').strip()
        
        # Check for module docstring
        for node in ast.walk(tree):
            if isinstance(node, ast.Module) and ast.get_docstring(node):
                return ast.get_docstring(node)
        
        # Look for key indicators
        has_main = any(
            isinstance(node, ast.If) and 
            isinstance(node.test, ast.Compare) and 
            isinstance(node.test.ops[0], ast.Eq) and
            isinstance(node.test.left, ast.Name) and
            node.test.left.id == "__name__" and
            isinstance(node.test.comparators[0], ast.Constant) and
            node.test.comparators[0].value == "__main__"
            for node in ast.walk(tree)
        )
        
        imports = [
            node.names[0].name
            for node in ast.walk(tree)
            if isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom)
        ]
        
        classes = [
            node.name
            for node in ast.walk(tree)
            if isinstance(node, ast.ClassDef)
        ]
        
        functions = [
            node.name
            for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef)
        ]
        
        # Generate purpose description
        parts = []
        if has_main:
            parts.append("Main executable script")
        if "test" in file_path.name.lower() or any("test" in func.lower() for func in functions):
            parts.append("Test module")
        if classes:
            parts.append(f"Defines classes: {', '.join(classes)}")
        if functions and not has_main:
            parts.append(f"Provides utility functions: {', '.join(functions[:3])}")
        if "setup" in file_path.name.lower():
            parts.append("Project configuration/setup")
        if imports and not parts:
            parts.append("Module with dependencies on: " + ", ".join(imports[:3]))
        
        if not parts:
            parts.append("Python module")
        
        return " | ".join(parts)
    except (SyntaxError, UnicodeDecodeError):
        return "Unable to analyze file purpose"

def extract_dependencies(file_path: Path) -> List[str]:
    """Extract import dependencies from a Python file.
    
    Returns both full module paths and top-level module names (e.g., 'os', 'sys', 'config.settings').
    """
    try:
        with open(file_path, 'r') as f:
            tree = ast.parse(f.read())
            dependencies = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        # For direct imports, use the full name
                        dependencies.add(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    if node.module and node.module != "__future__":
                        # For from imports, add both the module name and the full import path
                        for alias in node.names:
                            full_path = f"{node.module}.{alias.name}"
                            if node.module == "config":  # Special case for config.settings
                                dependencies.add(full_path)
                            else:
                                dependencies.add(node.module)
            return sorted(list(dependencies))
    except Exception as e:
        logger.error(f"Error extracting dependencies from {file_path}: {e}")
        return []

def create_directory_summary(directory: Path) -> DirectoryMetadata:
    """Create a summary of a directory's contents and purpose."""
    name = directory.name
    files = [f.name for f in directory.glob("*") if f.is_file()]
    
    # Analyze directory contents to determine purpose
    purpose_indicators = {
        "test": "Contains test files",
        "src": "Source code directory",
        "lib": "Library code",
        "docs": "Documentation",
        "config": "Configuration files",
        "utils": "Utility functions",
        "templates": "Template files",
        "static": "Static assets",
        "migrations": "Database migrations",
        "scripts": "Helper scripts",
    }
    
    # Try to determine purpose from directory name
    purpose = next(
        (desc for key, desc in purpose_indicators.items() if key in name.lower()),
        None
    )
    
    if not purpose:
        # Analyze file types
        extensions = {f.suffix for f in directory.glob("*") if f.is_file()}
        if ".py" in extensions:
            purpose = "Python module directory"
        elif ".js" in extensions or ".ts" in extensions:
            purpose = "JavaScript/TypeScript module directory"
        elif ".html" in extensions or ".css" in extensions:
            purpose = "Web assets directory"
        elif ".md" in extensions or ".rst" in extensions:
            purpose = "Documentation directory"
        else:
            purpose = "General purpose directory"
    
    return DirectoryMetadata(
        name=name,
        purpose=purpose,
        files=files,
        parent=str(directory.parent.name) if directory.parent.name != "." else None,
        subdirectories=[d.name for d in directory.glob("*/") if d.is_dir()]
    )

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

class MarkdownFormatter(BaseFormatter):
    """Formats output as markdown with enhanced LLM-friendly features."""
    
    def format(self, files: List[FileMetadata]) -> str:
        output = ["# Project Code Overview\n"]
        
        # Add project-level summary
        output.extend([
            "## Project Structure",
            "",
            "This document contains an aggregated view of the project's source code with enhanced metadata and analysis.",
            "Each file is presented with its purpose, dependencies, and contextual information to aid in understanding.",
            "",
        ])
        
        # Generate table of contents with summaries
        output.append("## Table of Contents\n")
        for file in files:
            slug = self._slugify(file.file_name)
            summary = file.purpose or "General purpose file"
            output.append(f"- [{file.file_name}](#{slug}) - {summary}")
        output.append("")
        
        # Add each file with enhanced metadata
        for file in files:
            chunks = self._chunk_content(file.content) if not file.chunks else [chunk.content for chunk in file.chunks]
            
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Part {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                
                # File header with enhanced metadata
                output.extend([
                    f"\n## {file.file_name}{chunk_info}",
                    "",
                    "### File Purpose",
                    file.purpose or "General purpose file",
                    "",
                ])
                
                # Directory context
                if file.directory_context:
                    output.extend([
                        "### Directory Context",
                        file.directory_context,
                        ""
                    ])
                
                # Dependencies section
                if file.dependencies:
                    output.extend([
                        "### Dependencies",
                        "This file depends on:",
                        "\n",
                        *[f"- `{dep}`" for dep in file.dependencies],
                        ""
                    ])
                
                # File analysis section
                if hasattr(file, 'file_analysis') and file.file_analysis:
                    output.extend([
                        file.file_analysis,
                        ""
                    ])
                
                # Technical metadata in YAML format
                output.extend([
                    "### Metadata",
                    "```yaml",
                    f"path: {file.relative_path}",
                    f"language: {file.language_id}",
                    f"size: {file.size} bytes",
                    f"last_modified: {file.last_modified}",
                    "```",
                    ""
                ])
                
                # Chunk information if present
                if file.chunk_info:
                    output.extend([
                        "### Chunking Information",
                        file.chunk_info,
                        ""
                    ])
                
                # File content with proper language annotation
                output.extend([
                    "### Source Code",
                    f"```{file.language_id}",
                    chunk,
                    "```",
                    ""
                ])
                
                if i < len(chunks) - 1:
                    output.append("---\n")
        
        return '\n'.join(output)
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

class HTMLFormatter(BaseFormatter):
    """Formats output as HTML with enhanced LLM-friendly features."""
    
    def format(self, files: List[FileMetadata]) -> str:
        output = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            '<meta charset="utf-8">',
            "<title>Project Code Overview</title>",
            "<style>",
            "body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }",
            ".file-section { margin: 2em 0; padding: 1em; border: 1px solid #eee; border-radius: 8px; }",
            ".file-title { color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5em; }",
            ".metadata-section { background: #f8f9fa; padding: 1em; border-radius: 4px; margin: 1em 0; }",
            ".purpose-section { background: #e9ecef; padding: 1em; border-radius: 4px; margin: 1em 0; }",
            ".dependencies-section { background: #f1f3f5; padding: 1em; border-radius: 4px; margin: 1em 0; }",
            "pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }",
            ".toc { background: #fff; padding: 1em; border: 1px solid #ddd; border-radius: 4px; margin: 1em 0; }",
            "</style>",
            "</head>",
            "<body>",
            "<h1>Project Code Overview</h1>"
        ]
        
        # Add project-level summary
        output.extend([
            "<div class='project-summary'>",
            "<h2>Project Structure</h2>",
            "<p>This document contains an aggregated view of the project's source code with enhanced metadata and analysis. ",
            "Each file is presented with its purpose, dependencies, and contextual information to aid in understanding.</p>",
            "</div>"
        ])
        
        # Generate table of contents with summaries
        output.extend([
            "<div class='toc'>",
            "<h2>Table of Contents</h2>",
            "<ul>"
        ])
        
        for file in files:
            slug = self._slugify(file.file_name)
            summary = file.purpose or "General purpose file"
            output.append(f'<li><a href="#{slug}">{file.file_name}</a> - {summary}</li>')
        
        output.append("</ul></div>")
        
        # Add each file with enhanced metadata
        for file in files:
            chunks = self._chunk_content(file.content) if not file.chunks else [chunk.content for chunk in file.chunks]
            
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Part {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                slug = self._slugify(file.file_name)
                
                output.extend([
                    f'<div class="file-section" id="{slug}">',
                    f'<h2 class="file-title">{file.file_name}{chunk_info}</h2>',
                    
                    '<div class="purpose-section">',
                    "<h3>File Purpose</h3>",
                    f"<p>{file.purpose or 'General purpose file'}</p>",
                    "</div>"
                ])
                
                if file.directory_context:
                    output.extend([
                        '<div class="context-section">',
                        "<h3>Directory Context</h3>",
                        f"<p>{file.directory_context}</p>",
                        "</div>"
                    ])
                
                if file.dependencies:
                    output.extend([
                        '<div class="dependencies-section">',
                        "<h3>Dependencies</h3>",
                        "<ul>",
                        *[f"<li><code>{dep}</code></li>" for dep in file.dependencies],
                        "</ul>",
                        "</div>"
                    ])
                
                output.extend([
                    '<div class="metadata-section">',
                    "<h3>Metadata</h3>",
                    "<table>",
                    "<tr><th>Property</th><th>Value</th></tr>",
                    f"<tr><td>Path</td><td>{file.relative_path}</td></tr>",
                    f"<tr><td>Language</td><td>{file.language_id}</td></tr>",
                    f"<tr><td>Size</td><td>{file.size} bytes</td></tr>",
                    f"<tr><td>Last Modified</td><td>{file.last_modified}</td></tr>",
                    "</table>",
                    "</div>"
                ])
                
                if file.chunk_info:
                    output.extend([
                        '<div class="chunk-info">',
                        "<h3>Chunking Information</h3>",
                        f"<p>{file.chunk_info}</p>",
                        "</div>"
                    ])
                
                if hasattr(file, 'file_analysis') and file.file_analysis:
                    output.extend([
                        '<div class="analysis-section">',
                        file.file_analysis.replace("###", "####"),
                        "</div>"
                    ])
                
                output.extend([
                    "<h3>Source Code</h3>",
                    f'<pre><code class="language-{file.language_id}">',
                    self._escape_html(chunk),
                    "</code></pre>",
                    "</div>"
                ])
                
                if i < len(chunks) - 1:
                    output.append("<hr>")
        
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
    output_format: str = "markdown",
    chunk_size: int = 2000,
    extra_spacing: bool = True
) -> str:
    """Aggregate files from a directory into a single LLM-friendly output."""
    root_path = Path(root_dir)
    if not root_path.is_dir():
        raise ValueError(f"'{root_dir}' is not a directory")
    
    # Initialize GitIgnoreFilter
    git_ignore_filter = GitIgnoreFilter(root_path)
    
    # Add custom exclude patterns to the default ones
    exclude_patterns = set(exclude_dirs or [])
    
    # Collect files
    files: List[FileMetadata] = []
    for file_path in root_path.rglob('*'):
        if (file_path.is_file() and
            not should_ignore_file(file_path, git_ignore_filter) and
            not any(p in str(file_path) for p in exclude_patterns) and
            is_text_file(file_path)):
            try:
                metadata = get_file_metadata(file_path)
                files.append(metadata)
            except Exception as e:
                logger.warning(f"Error processing {file_path}: {e}")
    
    # Sort files by path for consistent output
    files.sort(key=lambda f: f.relative_path)
    
    # Create appropriate formatter
    formatter_map = {
        "markdown": MarkdownFormatter,
        "html": HTMLFormatter
    }
    formatter_class = formatter_map.get(output_format.lower(), MarkdownFormatter)
    formatter = formatter_class(chunk_size=chunk_size, extra_spacing=extra_spacing)
    
    # Format output
    return formatter.format(files)

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Aggregate project files into a single LLM-friendly output file."
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
        "--format",
        choices=["markdown", "html"],
        default="markdown",
        help="Output format (default: markdown)"
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

def analyze_file_content(file_path: Path) -> str:
    """Analyze file content to generate a quick summary."""
    try:
        content = file_path.read_text()
        tree = ast.parse(content)
        
        classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
        functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
        dependencies = extract_dependencies(file_path)
        
        summary = ["### Quick Analysis"]
        if classes:
            summary.append(f"- **Classes Defined:** {', '.join(classes)}")
        if functions:
            summary.append(f"- **Primary Functions:** {', '.join(functions)}")
        if dependencies:
            summary.append(f"- **Key Dependencies:** {', '.join(dependencies)}")
        
        return '\n'.join(summary) if len(summary) > 1 else ""
    except (SyntaxError, UnicodeDecodeError):
        return "Unable to analyze file content"

if __name__ == '__main__':
    exit(main()) 