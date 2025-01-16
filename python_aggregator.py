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
from collections import Counter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def format_size(size: int) -> str:
    """Format a size in bytes to a human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

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
    """Metadata about a directory."""
    name: str
    purpose: str
    files: List[str]
    parent: Optional[str]
    subdirectories: List[str]
    num_files: int = 0
    num_dirs: int = 0
    size: int = 0
    relative_path: Optional[str] = None

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
                
                # Collect classes and functions with their line numbers
                classes = []
                functions = []
                nested_functions = []
                type_hints = []
                decorators = []
                patterns = extract_patterns(self.content)
                
                def process_node(node, parent_name=None):
                    if isinstance(node, ast.ClassDef):
                        start_line, end_line = adjust_line_numbers(self.content, node.lineno, node.end_lineno)
                        classes.append((node.name, start_line, end_line))
                        
                        # Process class decorators
                        for dec in node.decorator_list:
                            if dec_str := get_decorator_str(dec):
                                decorators.append(dec_str)
                        
                        # Process methods
                        for child in ast.iter_child_nodes(node):
                            if isinstance(child, ast.FunctionDef):
                                process_node(child, node.name)
                    
                    elif isinstance(node, ast.FunctionDef):
                        start_line, end_line = adjust_line_numbers(self.content, node.lineno, node.end_lineno)
                        
                        # Process function decorators
                        for dec in node.decorator_list:
                            if dec_str := get_decorator_str(dec):
                                decorators.append(dec_str)
                        
                        # Process return type annotation
                        if node.returns:
                            if type_str := get_type_annotation_str(node.returns):
                                type_hints.append(f"return -> {type_str}")
                        
                        # Process argument type annotations
                        for arg in node.args.args:
                            if arg.annotation:
                                if type_str := get_type_annotation_str(arg.annotation):
                                    type_hints.append(f"{arg.arg}: {type_str}")
                        
                        if parent_name:
                            nested_functions.append((f"{parent_name} -> {node.name}", start_line, end_line))
                        else:
                            functions.append((node.name, start_line, end_line))
                        
                        # Process nested functions
                        for child in ast.iter_child_nodes(node):
                            if isinstance(child, ast.FunctionDef):
                                process_node(child, node.name)
                
                # Process all nodes
                for node in ast.iter_child_nodes(tree):
                    process_node(node)
                
                summary = ["### Quick Analysis"]
                if classes:
                    class_lines = [f"{name} (Lines {start}-{end})" for name, start, end in sorted(classes)]
                    summary.append(f"- **Classes Defined:** {', '.join(class_lines)}")
                if functions:
                    func_lines = [f"{name} (Lines {start}-{end})" for name, start, end in sorted(functions)]
                    summary.append(f"- **Primary Functions:** {', '.join(func_lines)}")
                if nested_functions:
                    nested_lines = [f"{name} (Lines {start}-{end})" for name, start, end in sorted(nested_functions)]
                    summary.append(f"- **Nested Functions:** {', '.join(nested_lines)}")
                if decorators:
                    summary.append(f"- **Decorators Used:** {', '.join(sorted(set(decorators)))}")
                if type_hints:
                    summary.append(f"- **Type Annotations:** {', '.join(sorted(set(type_hints)))}")
                if patterns:
                    summary.append(f"- **Code Patterns:** {', '.join(patterns)}")
                if self.dependencies:
                    deps = sorted(self.dependencies)
                    summary.append(f"- **Key Dependencies:** {', '.join(deps)}")
                
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
    """Get user-provided summary from a sidecar file or .notes directory."""
    try:
        # First check for .notes sidecar file
        sidecar_path = file_path.with_suffix(file_path.suffix + '.notes')
        if sidecar_path.exists() and sidecar_path.is_file():
            try:
                content = sidecar_path.read_text().strip()
                if content:
                    return content
            except Exception as e:
                logger.warning(f"Error reading sidecar file {sidecar_path}: {str(e)}")
        
        # Then check for file in .notes directory
        notes_dir = file_path.parent / '.notes'
        if notes_dir.exists() and notes_dir.is_dir():
            notes_file = notes_dir / file_path.name
            if notes_file.exists() and notes_file.is_file():
                try:
                    content = notes_file.read_text().strip()
                    if content:
                        return content
                except Exception as e:
                    logger.warning(f"Error reading notes file {notes_file}: {str(e)}")
        
        return None
    except Exception as e:
        logger.warning(f"Error checking for user summary: {str(e)}")
        return None

def count_leading_blank_lines(content: str) -> int:
    """Count the number of leading blank lines in the content."""
    count = 0
    for line in content.splitlines():
        if not line.strip():
            count += 1
        else:
            break
    return count

def count_blank_lines_between(content: str, start_line: int, end_line: int) -> int:
    """Count blank lines between start_line and end_line (1-indexed)."""
    lines = content.splitlines()
    blank_count = 0
    for i in range(start_line - 1, end_line):
        if i < len(lines) and not lines[i].strip():
            blank_count += 1
    return blank_count

def adjust_line_numbers(content: str, start_line: int, end_line: int) -> Tuple[int, int]:
    """Adjust line numbers by removing leading blank lines and preserving relative spacing."""
    lines = content.splitlines()
    
    # Count leading blank lines
    leading_blanks = 0
    for line in lines[:start_line-1]:
        if not line.strip():
            leading_blanks += 1
        else:
            break
    
    # Count blank lines between functions
    blank_between = count_blank_lines_between(content, start_line, end_line)
    
    # Adjust line numbers
    adjusted_start = start_line - leading_blanks
    adjusted_end = end_line - leading_blanks
    
    # For subsequent functions, we need to adjust based on blank lines between functions
    if adjusted_start > 1:
        # Find the last non-blank line before this function
        last_code_line = 0
        for i in range(start_line-2, -1, -1):
            if i < len(lines) and lines[i].strip():
                last_code_line = i + 1
                break
        
        # Count blank lines between last code and this function
        blank_before = 0
        for i in range(last_code_line, start_line-1):
            if i < len(lines) and not lines[i].strip():
                blank_before += 1
        
        # Adjust line numbers based on blank lines between functions
        if blank_before > 0:
            adjusted_start = last_code_line - leading_blanks + 2
            adjusted_end = adjusted_start + 1
    
    return adjusted_start, adjusted_end

def get_file_metadata(file_path: Path, root_path: Optional[Path] = None) -> FileMetadata:
    """Get metadata for a file."""
    try:
        content = file_path.read_text()
        leading_blanks = count_leading_blank_lines(content)
        
        # Get file stats
        stats = file_path.stat()
        
        # Get relative path if root_path is provided
        relative_path = str(file_path.relative_to(root_path)) if root_path else str(file_path)
        
        # Get language and determine if we should parse AST
        language_id = get_language_from_path(file_path)
        should_parse_ast = language_id == 'python' and not file_path.name.startswith('.')
        
        # Create metadata
        metadata = FileMetadata(
            file_name=file_path.name,
            relative_path=relative_path,
            content=content,
            size=stats.st_size,
            last_modified=datetime.fromtimestamp(stats.st_mtime).strftime('%Y-%m-%dT%H:%M:%SZ'),
            language_id=language_id,
            purpose=generate_file_purpose(file_path),
            dependencies=set(extract_dependencies(file_path)) if should_parse_ast else set(),
            directory_context=file_path.parent.name,
            directory_hierarchy=str(file_path.parent.relative_to(root_path)) if root_path else None,
            user_summary=get_user_summary(file_path)
        )
        
        # Process chunks if needed
        if len(content.splitlines()) > 100:  # Only chunk large files
            chunks = []
            lines = content.splitlines()
            chunk_size = 50  # Lines per chunk
            
            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i:i + chunk_size]
                chunk = ChunkMetadata(
                    start_line=i + 1,  # 1-based line numbers
                    end_line=min(i + chunk_size, len(lines)),
                    content='\n'.join(chunk_lines),
                    summary=f"Lines {i + 1}-{min(i + chunk_size, len(lines))}"
                )
                chunks.append(chunk)
            
            metadata.chunks = chunks
            metadata.chunk_info = f"File split into {len(chunks)} chunks"
        
        # Parse AST only for Python files
        if should_parse_ast:
            try:
                tree = ast.parse(content)
                # Adjust line numbers for leading blanks
                for node in ast.walk(tree):
                    if hasattr(node, 'lineno'):
                        node.lineno = max(1, node.lineno - leading_blanks)
                    if hasattr(node, 'end_lineno') and node.end_lineno is not None:
                        node.end_lineno = max(1, node.end_lineno - leading_blanks)
            except SyntaxError:
                logger.warning(f"Could not parse Python AST for {file_path}")
        
        # Generate TOC entries
        metadata.generate_toc_entries()
        
        return metadata
    except Exception as e:
        logger.error(f"Error processing file {file_path}: {str(e)}")
        raise

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
    """Generate a purpose description for a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # First check for file-level comment
        first_line = content.strip().split('\n')[0]
        if first_line.startswith('#'):
            return first_line.lstrip('#').strip()
            
        tree = ast.parse(content)
        
        # Try to get module docstring
        module_doc = ast.get_docstring(tree)
        if module_doc:
            # Take first line/paragraph of docstring
            first_para = module_doc.split('\n\n')[0].strip()
            return first_para
            
        # For test files, check test class/function docstrings
        if file_path.name.startswith('test_') or file_path.name.endswith('_test.py'):
            return "This file is for testing purposes"
            
        # Analyze content
        classes = []
        functions = []
        imports = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes.append(node.name)
            elif isinstance(node, ast.FunctionDef):
                if not node.name.startswith('_'):
                    functions.append(node.name)
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                if isinstance(node, ast.Import):
                    imports.extend(n.name for n in node.names)
                else:
                    imports.append(node.module or '')
        
        # Check if these are utility functions
        utility_indicators = {'util', 'helper', 'format', 'convert', 'parse', 'validate', 'check', 'get', 'set'}
        has_utility_funcs = any(any(ind in func.lower() for ind in utility_indicators) for func in functions)
        
        # Generate purpose based on content
        if has_utility_funcs:
            if len(functions) == 1:
                return "Provides utility functions"
            else:
                return f"Provides utility functions including {', '.join(functions[:3])}"
        elif classes:
            if len(classes) == 1:
                return f"Defines the {classes[0]} class"
            else:
                return f"Defines multiple classes: {', '.join(classes[:3])}"
        elif functions:
            if len(functions) == 1:
                return f"Implements the {functions[0]} function"
            else:
                return f"Implements multiple functions including {', '.join(functions[:3])}"
        elif imports and not (classes or functions):
            return "Module that re-exports functionality from other modules"
            
        # Fallback to filename-based purpose
        name = file_path.stem
        if name == '__init__':
            return "Package initialization module"
        elif name == '__main__':
            return "Main entry point module"
        else:
            # Convert snake_case to words
            words = name.replace('_', ' ').title()
            return f"Module for {words}"
            
    except Exception as e:
        logger.warning(f"Error generating purpose for {file_path}: {str(e)}")
        return "Purpose could not be determined"

def extract_dependencies(file_path: Path) -> List[str]:
    """Extract dependencies from Python imports."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
        
        tree = ast.parse(content)
        dependencies = set()
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    # Keep full path for config.settings
                    if alias.name.startswith('config.'):
                        dependencies.add(alias.name)
                    else:
                        # For other imports, just keep the top-level module
                        top_level = alias.name.split('.')[0]
                        dependencies.add(top_level)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    # Keep full path for imports from config
                    if node.module == 'config':
                        for alias in node.names:
                            full_path = f"{node.module}.{alias.name}"
                            dependencies.add(full_path)
                    else:
                        # For other imports, just keep the top-level module
                        top_level = node.module.split('.')[0]
                        dependencies.add(top_level)
                else:
                    # For relative imports like 'from . import x'
                    for alias in node.names:
                        dependencies.add(alias.name)
        
        return sorted(list(dependencies))
    except Exception as e:
        logger.error(f"Error extracting dependencies from {file_path}: {str(e)}")
        return []

def extract_readme_purpose(readme_path: Path) -> Optional[str]:
    """Extract a purpose description from a README.md file."""
    try:
        content = readme_path.read_text(encoding='utf-8')
        
        # Try to find a title (# Header)
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        
        # Try to find the first paragraph after the title
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        description = None
        
        if paragraphs:
            # Skip the title paragraph if it matches what we found
            start_idx = 0
            if title_match and paragraphs[0].startswith('#'):
                start_idx = 1
            
            # Find the first non-header paragraph
            for p in paragraphs[start_idx:]:
                if not p.startswith('#') and not p.startswith('```'):
                    # Clean up markdown syntax
                    description = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', p)  # Remove links
                    description = re.sub(r'[*_]{1,2}([^*_]+)[*_]{1,2}', r'\1', description)  # Remove bold/italic
                    description = re.sub(r'`([^`]+)`', r'\1', description)  # Remove code
                    description = description.replace('\n', ' ').strip()
                    break
        
        # If no description found, try to find text after the title on the same line
        if not description and title_match:
            title_line = next((line for line in content.splitlines() if line.startswith('# ')), '')
            title = title_match.group(1).strip()
            after_title = title_line.split('# ' + title)[-1].strip()
            if after_title:
                return f"{title} - {after_title}"
            
            # Try to find text on the next line
            lines = content.splitlines()
            for i, line in enumerate(lines):
                if line.startswith('# ' + title):
                    if i + 1 < len(lines) and lines[i + 1].strip() and not lines[i + 1].startswith('#'):
                        return f"{title} - {lines[i + 1].strip()}"
                    break
            
            return title
        
        return description
    except Exception as e:
        logger.warning(f"Could not extract purpose from README: {str(e)}")
        return None

def create_directory_summary(directory: Path) -> DirectoryMetadata:
    """Create a summary of a directory's contents."""
    # Initialize metadata
    metadata = DirectoryMetadata(
        name=directory.name,
        purpose="",
        files=[],
        parent=str(directory.parent.name) if directory.parent != directory else None,
        subdirectories=[],
        relative_path=str(directory.relative_to(directory.parent)) if directory.parent != directory else "."
    )
    
    # Try to get purpose from README.md first
    readme_path = directory / "README.md"
    if readme_path.exists():
        if purpose := extract_readme_purpose(readme_path):
            metadata.purpose = purpose
    
    # Process directory contents
    source_files = []
    subdirs = []
    
    for item in directory.iterdir():
        # Skip hidden files/dirs
        if item.name.startswith('.'):
            continue
            
        # Skip common non-source files
        if item.name.lower() in {
            'readme.md', 'license', 'license.txt', 'license.md',
            'requirements.txt', 'setup.py', 'setup.cfg',
            'pyproject.toml', 'manifest.in', '.gitignore'
        }:
            continue
            
        if item.is_file():
            if is_text_file(item):
                source_files.append(item.name)
                metadata.size += item.stat().st_size
        elif item.is_dir():
            subdirs.append(item.name)
    
    metadata.files = sorted(source_files)
    metadata.subdirectories = sorted(subdirs)
    metadata.num_files = len(source_files)
    metadata.num_dirs = len(subdirs)
    
    # If no README purpose found, generate from contents
    if not metadata.purpose:
        if metadata.num_files == 0:
            metadata.purpose = "Empty directory"
        else:
            # Look at file types
            extensions = Counter(Path(f).suffix.lower() for f in source_files if Path(f).suffix)
            if extensions:
                main_type = extensions.most_common(1)[0][0][1:]  # Remove leading dot
                metadata.purpose = f"Directory containing {metadata.num_files} {main_type} files"
            else:
                metadata.purpose = f"Directory containing {metadata.num_files} files"
            
            if metadata.num_dirs > 0:
                metadata.purpose += f" and {metadata.num_dirs} subdirectories"
    
    return metadata

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
    """Format files as HTML with syntax highlighting."""
    
    def format(self, files_metadata: List[FileMetadata]) -> str:
        """Format the files as HTML."""
        output = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "<meta charset='utf-8'>",
            "<title>Code Overview</title>",
            "<style>",
            "body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 2rem; }",
            "pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }",
            "code { font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace; }",
            ".file-header { background: #f6f8fa; padding: 1rem; margin-bottom: 1rem; border-radius: 6px; }",
            ".file-header h2 { margin: 0 0 0.5rem 0; }",
            ".file-header p { margin: 0.25rem 0; color: #666; }",
            ".file-content { margin: 1rem 0 2rem; }",
            ".file-metadata { color: #666; font-size: 0.9rem; margin: 0.5rem 0; }",
            ".changes-section { margin: 1rem 0; padding: 1rem; background: #fff8dc; border-radius: 6px; }",
            ".changes-section h3 { margin-top: 0; }",
            "</style>",
            "</head>",
            "<body>"
        ]
        
        # Add table of contents
        if len(files_metadata) > 1:
            output.extend([
                "<h1>Table of Contents</h1>",
                "<ul>"
            ])
            
            for metadata in files_metadata:
                file_id = f"file_{hash(str(metadata.relative_path))}"
                output.append(f"<li><a href='#{file_id}'>{metadata.relative_path}</a></li>")
            
            output.append("</ul>")
            output.append("<hr>")
        
        # Format each file
        for metadata in files_metadata:
            file_id = f"file_{hash(str(metadata.relative_path))}"
            
            # File header
            output.extend([
                f"<div class='file-header' id='{file_id}'>",
                f"<h2>{metadata.relative_path}</h2>",
                "<h3>File Purpose</h3>",
                f"<p>{metadata.purpose}</p>",
                f"<p><strong>Size:</strong> {format_size(metadata.size)}</p>",
                f"<p><strong>Last Modified:</strong> {metadata.last_modified}</p>"
            ])
            
            # Dependencies
            if metadata.dependencies:
                output.append("<p><strong>Dependencies:</strong></p>")
                output.append("<ul>")
                for dep in metadata.dependencies:
                    output.append(f"<li>{dep}</li>")
                output.append("</ul>")
            
            output.append("</div>")
            
            # File content
            output.append("<div class='file-content'>")
            
            if metadata.chunks:
                for i, chunk in enumerate(metadata.chunks, 1):
                    if len(metadata.chunks) > 1:
                        output.append(f"<h4>Chunk {i}</h4>")
                    output.extend([
                        f'<pre><code class="{metadata.language_id}">',
                        self._escape_html(chunk.content),
                        "</code></pre>"
                    ])
                    
                    if self.extra_spacing:
                        output.append("<br>")
            else:
                output.extend([
                    f'<pre><code class="{metadata.language_id}">',
                    self._escape_html(metadata.content),
                    "</code></pre>"
                ])
            
            # Technical metadata
            output.append("<div class='file-metadata'>")
            
            if metadata.file_analysis:
                output.append(metadata.file_analysis)
            
            output.append("</div>")  # Close file-metadata
            output.append("</div>")  # Close file-content
            
            if self.extra_spacing:
                output.append("<hr>")
        
        output.append("</body></html>")
        return "\n".join(output)
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    
    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters."""
        return (text.replace('&', '&amp;')
                   .replace('<', '&lt;')
                   .replace('>', '&gt;')
                   .replace('"', '&quot;')
                   .replace("'", '&#39;'))

class ChangeTracker:
    """Track changes between runs."""
    
    def __init__(self, cache_file: Path):
        """Initialize change tracker with cache file path."""
        self.cache_file = cache_file
    
    def _load_cache(self) -> Dict[str, str]:
        """Load file hashes from cache file."""
        if not self.cache_file.exists():
            return {}
        try:
            return json.loads(self.cache_file.read_text())
        except Exception as e:
            logger.warning(f"Error loading cache file: {str(e)}")
            return {}
    
    def _save_cache(self, cache: Dict[str, str]) -> None:
        """Save file hashes to cache file."""
        try:
            self.cache_file.write_text(json.dumps(cache))
        except Exception as e:
            logger.warning(f"Error saving cache file: {str(e)}")
    
    def track_changes(self, files_metadata: List[FileMetadata]) -> List[FileChange]:
        """Track changes between runs."""
        changes = []
        
        # Load previous hashes
        old_hashes = self._load_cache()
        
        # Get current hashes
        current_hashes = {
            str(Path(metadata.relative_path)): metadata.content_hash
            for metadata in files_metadata
        }
        
        # Find added and modified files
        for file_path, current_hash in current_hashes.items():
            if file_path not in old_hashes:
                changes.append(FileChange(
                    file_path=file_path,
                    change_type="added",
                    old_hash=None,
                    new_hash=current_hash
                ))
            elif old_hashes[file_path] != current_hash:
                changes.append(FileChange(
                    file_path=file_path,
                    change_type="modified",
                    old_hash=old_hashes[file_path],
                    new_hash=current_hash
                ))
        
        # Find removed files
        for file_path in old_hashes:
            if file_path not in current_hashes:
                changes.append(FileChange(
                    file_path=file_path,
                    change_type="removed",
                    old_hash=old_hashes[file_path],
                    new_hash=None
                ))
        
        # Save current hashes
        self._save_cache(current_hashes)
        
        return changes

def aggregate_files(
    root_dir: str = ".",
    exclude_dirs: Optional[List[str]] = None,
    max_file_size: int = 1_000_000,  # 1MB default max file size
    output_format: str = "markdown",
    chunk_size: int = 2000,
    extra_spacing: bool = True,
    track_changes: bool = False,
    incremental: bool = False
) -> str:
    """
    Aggregate files from a directory into a single document.
    
    Args:
        root_dir: Root directory to start from
        exclude_dirs: List of directory patterns to exclude
        max_file_size: Maximum file size to process
        output_format: Output format ('markdown' or 'html')
        chunk_size: Size of chunks for large files
        extra_spacing: Whether to add extra spacing in output
        track_changes: Whether to track changes between runs
        incremental: Whether to only process changed files
    
    Returns:
        Formatted string containing aggregated content
    """
    root_path = Path(root_dir).resolve()
    if not root_path.is_dir():
        raise ValueError(f"Directory not found: {root_dir}")
    
    # Initialize change tracker if needed
    change_tracker = None
    if track_changes or incremental:
        cache_file = root_path / ".aggregator_cache"
        change_tracker = ChangeTracker(cache_file)
    
    # Get all files
    files_metadata: List[FileMetadata] = []
    git_ignore_filter = GitIgnoreFilter(root_path)
    
    # Load cache for incremental mode
    cache = {}
    if incremental and change_tracker:
        cache = change_tracker._load_cache()
    
    # Track processed files for incremental mode
    processed_files = set()
    modified_files = set()
    
    # Keep track of all files for change detection
    all_files = set()
    
    for file_path in root_path.rglob("*"):
        if should_ignore_file(file_path, git_ignore_filter):
            continue
        
        if exclude_dirs:
            skip = False
            for pattern in exclude_dirs:
                if any(part.startswith(pattern) for part in file_path.parts):
                    skip = True
                    break
            if skip:
                continue
        
        if not file_path.is_file() or file_path.stat().st_size > max_file_size:
            continue
        
        if not is_text_file(file_path):
            continue
        
        # Skip cache file in incremental mode
        if incremental and file_path.name == ".aggregator_cache":
            continue
        
        # Get relative path for consistent comparison
        relative_path = str(file_path.relative_to(root_path))
        
        # Add to all files set
        all_files.add(relative_path)
        
        # In incremental mode, check if file has changed
        if incremental and change_tracker:
            current_hash = sha256(file_path.read_bytes()).hexdigest()
            cached_hash = cache.get(relative_path, None)
            
            if cached_hash == current_hash:
                logger.debug(f"Skipping unchanged file: {relative_path}")
                continue
            else:
                modified_files.add(relative_path)
        
        try:
            metadata = get_file_metadata(file_path, root_path)
            files_metadata.append(metadata)
            processed_files.add(relative_path)
        except Exception as e:
            logger.warning(f"Error processing {relative_path}: {str(e)}")
            continue
    
    # Sort files by path for consistent output
    files_metadata.sort(key=lambda x: x.relative_path)
    
    # Create formatter
    if output_format.lower() == "html":
        formatter = HTMLFormatter(chunk_size=chunk_size, extra_spacing=extra_spacing)
    else:
        formatter = MarkdownFormatter(chunk_size=chunk_size, extra_spacing=extra_spacing)
    
    # Format output
    output = formatter.format(files_metadata)
    
    # Track changes if requested
    if track_changes and change_tracker:
        # In incremental mode, only consider processed files
        if incremental:
            changes = []
            for file_path in modified_files:
                changes.append(FileChange(
                    file_path=file_path,
                    change_type="modified",
                    old_hash=cache.get(file_path),
                    new_hash=sha256(Path(root_path / file_path).read_bytes()).hexdigest()
                ))
            
            # Update cache with new hashes
            new_cache = {}
            for file_path in all_files:
                if file_path.endswith(".aggregator_cache"):
                    continue
                new_cache[file_path] = sha256(Path(root_path / file_path).read_bytes()).hexdigest()
            change_tracker._save_cache(new_cache)
        else:
            changes = change_tracker.track_changes(files_metadata)
        
        if changes:
            # Group changes by type
            added = []
            modified = []
            removed = []
            
            for change in changes:
                if change.change_type == "added":
                    added.append(change.file_path)
                elif change.change_type == "modified":
                    modified.append(change.file_path)
                elif change.change_type == "removed":
                    removed.append(change.file_path)
            
            # Format change summary
            change_summary = []
            if added:
                change_summary.extend([
                    "### Added Files",
                    "",
                    *[f"- {path} (added)" for path in sorted(added)],
                    ""
                ])
            if modified:
                change_summary.extend([
                    "### Modified Files",
                    "",
                    *[f"- {path} (modified)" for path in sorted(modified)],
                    ""
                ])
            if removed:
                change_summary.extend([
                    "### Removed Files",
                    "",
                    *[f"- {path} (removed)" for path in sorted(removed)],
                    ""
                ])
            
            # Add change summary to output
            if output_format.lower() == "html":
                html_changes = []
                if added:
                    html_changes.extend([
                        '<div class="changes-section">',
                        '<h3>Added Files</h3>',
                        '<ul>',
                        *[f'<li>{path} (added)</li>' for path in sorted(added)],
                        '</ul>',
                        '</div>'
                    ])
                if modified:
                    html_changes.extend([
                        '<div class="changes-section">',
                        '<h3>Modified Files</h3>',
                        '<ul>',
                        *[f'<li>{path} (modified)</li>' for path in sorted(modified)],
                        '</ul>',
                        '</div>'
                    ])
                if removed:
                    html_changes.extend([
                        '<div class="changes-section">',
                        '<h3>Removed Files</h3>',
                        '<ul>',
                        *[f'<li>{path} (removed)</li>' for path in sorted(removed)],
                        '</ul>',
                        '</div>'
                    ])
                output = output.replace("</body>", f"{''.join(html_changes)}</body>")
            else:
                output = '\n'.join(change_summary) + '\n\n' + output
    
    return output

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

def get_type_annotation_str(node: ast.AST) -> Optional[str]:
    """Extract the string representation of a type annotation."""
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Constant):
        return str(node.value)
    elif isinstance(node, ast.Subscript):
        value = get_type_annotation_str(node.value)
        slice_str = get_type_annotation_str(node.slice)
        if value and slice_str:
            return f"{value}[{slice_str}]"
    elif isinstance(node, ast.Index):  # Python 3.8
        return get_type_annotation_str(node.value)
    elif isinstance(node, ast.Tuple):
        elts = [get_type_annotation_str(elt) for elt in node.elts]
        return ", ".join(filter(None, elts))
    return None

def get_decorator_str(decorator: ast.AST) -> Optional[str]:
    """Extract the string representation of a decorator."""
    if isinstance(decorator, ast.Name):
        return f"@{decorator.id}"
    elif isinstance(decorator, ast.Call):
        if isinstance(decorator.func, ast.Name):
            args = []
            for arg in decorator.args:
                if isinstance(arg, ast.Constant):
                    args.append(str(arg.value))
                elif isinstance(arg, ast.Name):
                    args.append(arg.id)
            if args:
                return f"@{decorator.func.id}({', '.join(args)})"
            return f"@{decorator.func.id}"
    elif isinstance(decorator, ast.Attribute):
        return f"@{ast.unparse(decorator)}"
    return None

def extract_patterns(content: str) -> List[str]:
    """Extract TODO/FIXME patterns with line numbers."""
    patterns = []
    for i, line in enumerate(content.splitlines(), 1):
        line = line.strip()
        if line.startswith('#'):
            comment = line.lstrip('#').strip()
            if 'TODO:' in comment:
                todo = comment.split('TODO:', 1)[1].strip()
                patterns.append(f"TODO (Line {i}): {todo}")
            elif 'FIXME:' in comment:
                fixme = comment.split('FIXME:', 1)[1].strip()
                patterns.append(f"FIXME (Line {i}): {fixme}")
    return patterns

if __name__ == '__main__':
    exit(main()) 