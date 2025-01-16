#!/usr/bin/env python3
"""
Python Code Aggregator

This module provides functionality to aggregate source code files into a single,
well-structured document optimized for Large Language Model (LLM) comprehension.

Key Features:
- Intelligent file analysis and metadata extraction
- Cross-file reference tracking
- Directory structure analysis
- Large file chunking
- Change tracking between runs
- User-customizable summaries
- Multiple output formats (Markdown, HTML)

Usage:
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
"""

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
from hashlib import sha256
from typing import List, Optional, Pattern, Set, Dict, Tuple
from functools import lru_cache

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
class FileChange:
    """Represents a change in a file between runs."""
    file_path: str
    change_type: str  # 'added', 'modified', 'removed'
    old_hash: Optional[str] = None
    new_hash: Optional[str] = None

@dataclass
class TOCEntry:
    """Represents an entry in the table of contents."""
    title: str
    level: int
    anchor: str
    summary: Optional[str] = None

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
    user_summary: Optional[str] = None
    _file_analysis: Optional[str] = field(default=None, init=False)
    _formatted_content: str = field(default="", init=False)
    directory_hierarchy: Optional[str] = None
    content_hash: str = field(init=False)
    toc_entries: List[TOCEntry] = field(default_factory=list)
    
    def __post_init__(self):
        """Initialize computed fields after instance creation."""
        if not self.dependencies:
            self.dependencies = set()
        if not self.chunks:
            self.chunks = []
        # Calculate content hash
        self.content_hash = sha256(self.content.encode()).hexdigest()
    
    @property
    def formatted_content(self) -> str:
        """Get content with code fences and chunk demarcation."""
        if not self.chunks:
            # Single chunk with language-specific code fence
            return f"```{self.language_id}\n{self.content.strip()}\n```\n"
        
        formatted_chunks = []
        for i, chunk in enumerate(self.chunks, 1):
            formatted_chunks.append(
                f"# Chunk {i} of {len(self.chunks)} (Lines {chunk.start_line}-{chunk.end_line})\n"
                f"# {'-' * 40}\n"
                f"```{self.language_id}\n{chunk.content.strip()}\n```"
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

    def generate_toc_entries(self) -> None:
        """Generate table of contents entries for this file."""
        entries = []
        
        # Add file as main entry with purpose if available
        main_title = self.file_name
        main_summary = self.purpose if self.purpose else self.user_summary
        entries.append(TOCEntry(
            title=main_title,
            level=1,
            anchor=self._slugify(main_title),
            summary=main_summary
        ))
        
        # Add sections based on file analysis
        if self._file_analysis:
            try:
                tree = ast.parse(self.content)
                
                # Add entries for classes
                classes = [node.name for node in ast.walk(tree) if isinstance(node, ast.ClassDef)]
                if classes:
                    for class_name in sorted(classes):
                        entries.append(TOCEntry(
                            title=f"Class: {class_name}",
                            level=2,
                            anchor=self._slugify(f"{main_title}-class-{class_name}"),
                            summary=f"Class definition for {class_name}"
                        ))
                
                # Add entries for functions
                functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
                if functions:
                    for func_name in sorted(functions):
                        entries.append(TOCEntry(
                            title=f"Function: {func_name}",
                            level=2,
                            anchor=self._slugify(f"{main_title}-function-{func_name}"),
                            summary=f"Function definition for {func_name}"
                        ))
            except (SyntaxError, UnicodeDecodeError):
                pass
        
        # Add entries for chunks if present
        if self.chunks:
            for i, chunk in enumerate(self.chunks, 1):
                chunk_title = f"{self.file_name} (Part {i})"
                entries.append(TOCEntry(
                    title=chunk_title,
                    level=2,
                    anchor=self._slugify(f"{main_title}-part-{i}"),
                    summary=f"Lines {chunk.start_line}-{chunk.end_line}"
                ))
        
        self.toc_entries = entries
    
    def _slugify(self, text: str) -> str:
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

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

@lru_cache(maxsize=128)
def is_text_file(file_path: Path) -> bool:
    """Check if a file is a text file based on extension."""
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
        '.vsix',  # VS Code extension packages
    }
    return file_path.suffix.lower() not in binary_extensions

def get_user_summary(file_path: Path) -> Optional[str]:
    """Get user-provided summary from sidecar file if it exists."""
    logger.debug(f"Looking for user summary for file: {file_path}")
    logger.debug(f"File exists: {file_path.exists()}")
    logger.debug(f"File stem: {file_path.stem}")
    logger.debug(f"File suffix: {file_path.suffix}")
    
    # Check for different possible sidecar file extensions
    sidecar_extensions = ['.notes', '.summary', '.desc']
    
    # First check for sidecar files with the same name
    for ext in sidecar_extensions:
        # Create sidecar path by appending the extension
        sidecar_path = file_path.parent / f"{file_path.name}{ext}"
        logger.debug(f"Checking sidecar file: {sidecar_path}")
        logger.debug(f"Sidecar file exists: {sidecar_path.exists()}")
        if sidecar_path.exists():
            logger.debug(f"Found sidecar file: {sidecar_path}")
            try:
                with open(sidecar_path, 'r') as f:
                    content = f.read().strip()
                    logger.debug(f"Raw content from sidecar file: '{content}'")
                    if content:
                        logger.debug(f"Found content in sidecar file: '{content}'")
                        return content
                    else:
                        logger.debug("Sidecar file was empty")
            except Exception as e:
                logger.warning(f"Error reading sidecar file {sidecar_path}: {e}")
    
    # Then check for a .notes directory with a matching file
    notes_dir = file_path.parent / '.notes'
    logger.debug(f"Checking .notes directory: {notes_dir}")
    logger.debug(f"Notes directory exists: {notes_dir.exists()}")
    if notes_dir.exists():
        notes_file = notes_dir / file_path.name
        logger.debug(f"Checking notes file: {notes_file}")
        logger.debug(f"Notes file exists: {notes_file.exists()}")
        if notes_file.exists():
            logger.debug(f"Found notes file: {notes_file}")
            try:
                with open(notes_file, 'r') as f:
                    content = f.read().strip()
                    logger.debug(f"Raw content from notes file: '{content}'")
                    if content:
                        logger.debug(f"Found content in notes file: '{content}'")
                        return content
                    else:
                        logger.debug("Notes file was empty")
            except Exception as e:
                logger.warning(f"Error reading notes file {notes_file}: {e}")
    
    logger.debug("No user summary found")
    return None

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
    
    # Get user-provided summary first
    user_summary = get_user_summary(file_path)
    logger.debug(f"User summary for {file_path}: {user_summary}")
    
    # Get basic metadata
    metadata = FileMetadata(
        file_name=file_path.name,
        relative_path=relative_path,
        content=content,
        size=stats.st_size,
        last_modified=datetime.fromtimestamp(stats.st_mtime).isoformat(),
        language_id=get_language_from_path(file_path),
        user_summary=user_summary,  # Set the user summary here
        dependencies=set()  # Initialize as empty set
    )
    
    # Add enhanced metadata
    if metadata.language_id == 'python':
        metadata.purpose = generate_file_purpose(file_path) or "General-purpose file"
        try:
            metadata.dependencies = set(extract_dependencies(file_path))  # Convert list to set
        except Exception as e:
            logger.error(f"Error extracting dependencies from {file_path}: {e}")
            metadata.dependencies = set()  # Ensure it's a set even on error
        
        # Analyze import statements for cross-file references
        try:
            with open(file_path, 'r') as f:
                tree = ast.parse(f.read())
                for node in ast.walk(tree):
                    if isinstance(node, (ast.Import, ast.ImportFrom)):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                metadata.dependencies.add(alias.name)
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                metadata.dependencies.add(node.module)
        except Exception as e:
            logger.warning(f"Error parsing imports in {file_path}: {e}")
    
    # Add directory context
    parent_dir = file_path.parent
    if parent_dir.exists():
        try:
            dir_summary = create_directory_summary(parent_dir)
            metadata.directory_context = dir_summary.purpose
        except Exception as e:
            logger.warning(f"Error creating directory summary for {parent_dir}: {e}")
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
    
    # Generate table of contents entries
    metadata.generate_toc_entries()
    
    return metadata

@lru_cache(maxsize=128)
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
        
        # Generate comprehensive table of contents
        output.append("## Table of Contents\n")
        
        # Pre-generate all TOC entries to avoid repeated computation
        for file in files:
            file.generate_toc_entries()
        
        # Flatten and format all TOC entries
        for file in files:
            for entry in file.toc_entries:
                indent = "  " * (entry.level - 1)
                if entry.summary:
                    output.append(f"{indent}- [{entry.title}](#{entry.anchor}) - {entry.summary}")
                else:
                    output.append(f"{indent}- [{entry.title}](#{entry.anchor})")
                
                # Add sub-sections if this is a main file entry
                if entry.level == 1:
                    if file.chunks:
                        output.append(f"{indent}  - Sections: {len(file.chunks)} parts")
                    
        output.append("")
        
        # Add each file with enhanced metadata
        for file in files:
            chunks = self._chunk_content(file.content) if not file.chunks else [chunk.content for chunk in file.chunks]
            
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Part {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                anchor = f"{file._slugify(file.file_name)}-part-{i+1}" if chunk_info else file._slugify(file.file_name)
                
                # File header with enhanced metadata
                output.extend([
                    f"\n## {file.file_name}{chunk_info} {{{anchor}}}",
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
                
                # Directory hierarchy
                if file.directory_hierarchy:
                    output.extend([
                        "#### Directory Hierarchy",
                        f"`{file.directory_hierarchy}`",
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
                        "#### Chunking Information",
                        file.chunk_info,
                        ""
                    ])
                
                # User-provided summary if available
                if file.user_summary:
                    output.extend([
                        "### User-Provided Summary",
                        file.user_summary,
                        ""
                    ])
                
                # File content with proper language annotation
                output.extend([
                    "### Source Code",
                    f"# Chunk {i+1} of {len(chunks)}" if len(chunks) > 1 else "",
                    f"# Lines {i*self.chunk_size + 1}-{min((i+1)*self.chunk_size, len(chunk.splitlines()))}" if len(chunks) > 1 else "",
                    f"# {'-' * 40}" if len(chunks) > 1 else "",
                    f"```{file.language_id}\n{chunk.strip()}\n```",
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
        
        # Generate comprehensive table of contents
        output.extend([
            "<div class='toc'>",
            "<h2>Table of Contents</h2>",
            "<ul>"
        ])
        
        # Pre-generate all TOC entries to avoid repeated computation
        for file in files:
            file.generate_toc_entries()
        
        # Flatten and format all TOC entries
        for file in files:
            for entry in file.toc_entries:
                indent = "  " * (entry.level - 1)
                if entry.summary:
                    output.append(f"{indent}- [{entry.title}](#{entry.anchor}) - {entry.summary}")
                else:
                    output.append(f"{indent}- [{entry.title}](#{entry.anchor})")
                
                # Add sub-sections if this is a main file entry
                if entry.level == 1:
                    if file.chunks:
                        output.append(f"{indent}  - Sections: {len(file.chunks)} parts")
                    
        output.append("</ul></div>")
        
        # Add each file with enhanced metadata
        for file in files:
            chunks = self._chunk_content(file.content) if not file.chunks else [chunk.content for chunk in file.chunks]
            
            for i, chunk in enumerate(chunks):
                chunk_info = f" (Part {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
                anchor = f"{file._slugify(file.file_name)}-part-{i+1}" if chunk_info else file._slugify(file.file_name)
                
                output.extend([
                    f'<div class="file-section" id="{anchor}">',
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
                        "<h4>Chunking Information</h4>",
                        f"<p>{file.chunk_info}</p>",
                        "</div>"
                    ])
                
                if file.directory_hierarchy:
                    output.extend([
                        '<div class="directory-hierarchy">',
                        "<h4>Directory Hierarchy</h4>",
                        f"<p><code>{file.directory_hierarchy}</code></p>",
                        "</div>"
                    ])
                
                if hasattr(file, 'file_analysis') and file.file_analysis:
                    output.extend([
                        '<div class="analysis-section">',
                        file.file_analysis.replace("###", "####"),
                        "</div>"
                    ])
                
                if file.user_summary:
                    output.extend([
                        '<div class="user-summary-section">',
                        "<h3>User-Provided Summary</h3>",
                        f"<p>{file.user_summary}</p>",
                        "</div>"
                    ])
                
                output.extend([
                    "<h3>Source Code</h3>",
                    f'<pre><code class="language-{file.language_id}">',
                    f"# Chunk {i+1} of {len(chunks)}\n" if len(chunks) > 1 else "",
                    f"# Lines {i*self.chunk_size + 1}-{min((i+1)*self.chunk_size, len(chunk.splitlines()))}\n" if len(chunks) > 1 else "",
                    f"# {'-' * 40}\n" if len(chunks) > 1 else "",
                    f"{self._escape_html(chunk.strip())}</code></pre></div>",
                    ""
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

class ChangeTracker:
    """Track changes between aggregator runs."""
    
    def __init__(self, cache_file: Path):
        self.cache_file = cache_file
        self.previous_hashes = self._load_cache()
    
    def _load_cache(self) -> Dict[str, str]:
        """Load the previous run's file hashes from cache."""
        if self.cache_file.exists():
            try:
                content = self.cache_file.read_text()
                return {line.split('\t')[0]: line.split('\t')[1] 
                        for line in content.splitlines()}
            except Exception as e:
                logger.warning(f"Error loading cache file: {e}")
        return {}
    
    def _save_cache(self, current_hashes: Dict[str, str]) -> None:
        """Save the current run's file hashes to cache."""
        try:
            content = '\n'.join(f"{path}\t{hash_}" 
                              for path, hash_ in sorted(current_hashes.items()))
            self.cache_file.write_text(content)
        except Exception as e:
            logger.warning(f"Error saving cache file: {e}")
    
    def track_changes(self, files: List[FileMetadata]) -> List[FileChange]:
        """Track changes between the current and previous runs."""
        changes = []
        current_hashes = {}
        
        # Check for modified and new files
        for file in files:
            current_hashes[file.relative_path] = file.content_hash
            if file.relative_path in self.previous_hashes:
                if file.content_hash != self.previous_hashes[file.relative_path]:
                    changes.append(FileChange(
                        file_path=file.relative_path,
                        change_type='modified',
                        old_hash=self.previous_hashes[file.relative_path],
                        new_hash=file.content_hash
                    ))
            else:
                changes.append(FileChange(
                    file_path=file.relative_path,
                    change_type='added',
                    new_hash=file.content_hash
                ))
        
        # Check for removed files
        for old_path in self.previous_hashes:
            if old_path not in current_hashes:
                changes.append(FileChange(
                    file_path=old_path,
                    change_type='removed',
                    old_hash=self.previous_hashes[old_path]
                ))
        
        # Save current hashes for next run
        self._save_cache(current_hashes)
        
        return changes

def aggregate_files(
    root_dir: str = ".",
    exclude_dirs: Optional[List[str]] = None,
    max_file_size: int = 1_000_000,  # 1MB default max file size
    output_format: str = "markdown",
    chunk_size: int = 2000,
    extra_spacing: bool = True,
    track_changes: bool = False
) -> str:
    """Aggregate project files into a single output."""
    root_path = Path(root_dir).resolve()
    cache_file = root_path / ".aggregator_cache"
    change_tracker = ChangeTracker(cache_file) if track_changes else None
    
    # Initialize formatters
    if output_format == "html":
        formatter_class = HTMLFormatter
    else:
        formatter_class = MarkdownFormatter
    formatter = formatter_class(chunk_size=chunk_size, extra_spacing=extra_spacing)
    
    # Add custom exclude patterns to the default ones
    exclude_patterns = set(exclude_dirs or [])
    
    # Collect files
    files: List[FileMetadata] = []
    for file_path in root_path.rglob('*'):
        if (file_path.is_file() and
            not should_ignore_file(file_path) and
            not any(p in str(file_path) for p in exclude_patterns) and
            file_path.stat().st_size <= max_file_size and
            is_text_file(file_path)):
            try:
                metadata = get_file_metadata(file_path, root_path)
                files.append(metadata)
            except Exception as e:
                logger.warning(f"Error processing {file_path}: {e}")
                continue
    
    # Sort files by path for consistent output
    files.sort(key=lambda f: f.relative_path)
    
    # Track changes if enabled
    changes = []
    if change_tracker:
        changes = change_tracker.track_changes(files)
        if changes:
            logger.info(f"Detected {len(changes)} changes since last run")
    
    # Format output with changes summary if available
    output = []
    
    if track_changes and changes:
        output.extend([
            "## Changes Since Last Run",
            "",
            f"Detected {len(changes)} change(s) in this run:",
            ""
        ])
        
        # Group changes by type
        added = [c for c in changes if c.change_type == 'added']
        modified = [c for c in changes if c.change_type == 'modified']
        removed = [c for c in changes if c.change_type == 'removed']
        
        if added:
            output.extend([
                "### Added Files",
                *[f"- `{c.file_path}`" for c in added],
                ""
            ])
        
        if modified:
            output.extend([
                "### Modified Files",
                *[f"- `{c.file_path}`" for c in modified],
                ""
            ])
        
        if removed:
            output.extend([
                "### Removed Files",
                *[f"- `{c.file_path}`" for c in removed],
                ""
            ])
        
        output.append("---\n")
    elif track_changes:
        output.extend([
            "## Changes Since Last Run",
            "",
            "No changes detected in this run.",
            "",
            "---\n"
        ])
    
    # Add the main content
    output.append(formatter.format(files))
    
    return '\n'.join(output)

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Aggregate project files into a single LLM-friendly output file.",
        epilog="""
Examples:
  # Basic usage (outputs to stdout in markdown format)
  python python_aggregator.py
  
  # Generate HTML output and save to file
  python python_aggregator.py --format html --output-file output.html
  
  # Process specific directory with exclusions and change tracking
  python python_aggregator.py --root-dir /path/to/project \\
                             --exclude-dirs node_modules dist \\
                             --track-changes
  
  # Handle large files with custom chunk size
  python python_aggregator.py --chunk-size 500
  
Notes:
  - The tool automatically ignores binary files and common non-source directories
  - Use .notes files alongside source files for custom summaries
  - The --track-changes option creates a .aggregator_cache file in the root directory
""",
        formatter_class=argparse.RawDescriptionHelpFormatter
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
    parser.add_argument(
        "--track-changes",
        action="store_true",
        help="Track changes between aggregator runs"
    )
    
    args = parser.parse_args()
    
    try:
        output = aggregate_files(
            root_dir=args.root_dir,
            exclude_dirs=args.exclude_dirs,
            output_format=args.format,
            chunk_size=args.chunk_size,
            extra_spacing=not args.no_extra_spacing,
            track_changes=args.track_changes
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