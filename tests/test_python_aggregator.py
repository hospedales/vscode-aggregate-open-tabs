#!/usr/bin/env python3

import unittest
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass
import tempfile
import os
import shutil
import pytest

# Import the module to test
from python_aggregator import (
    FileMetadata,
    DirectoryMetadata,
    ChunkMetadata,
    get_file_metadata,
    generate_file_purpose,
    extract_dependencies,
    create_directory_summary,
    BaseFormatter,
    MarkdownFormatter,
    HTMLFormatter,
    get_language_from_path,
    should_ignore_file,
    is_text_file,
    GitIgnoreFilter,
    SensitiveMatch,
    aggregate_files,
)

class TestEnhancedMetadata(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for test files
        self.test_dir = Path(tempfile.mkdtemp())
        
        # Create some test files and directories
        self.test_files = {
            'main.py': '''
import utils
from config import settings

def main():
    print("Hello World")
    
if __name__ == "__main__":
    main()
''',
            'utils.py': '''
def helper():
    return "Helper function"
''',
            'config/settings.py': '''
API_KEY = "dummy_key"
DEBUG = True
'''
        }
        
        # Create the files in the temp directory
        for file_path, content in self.test_files.items():
            full_path = self.test_dir / file_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)
    
    def tearDown(self):
        # Clean up the temporary directory
        shutil.rmtree(self.test_dir)
    
    def test_file_metadata_enhanced_fields(self):
        """Test the enhanced FileMetadata class with new fields"""
        file_path = self.test_dir / 'main.py'
        metadata = get_file_metadata(file_path)
        
        # Basic metadata fields
        self.assertEqual(metadata.file_name, 'main.py')
        self.assertEqual(metadata.language_id, 'python')
        
        # New enhanced fields
        self.assertIsInstance(metadata.purpose, str)
        self.assertIsInstance(metadata.dependencies, set)
        self.assertIsInstance(metadata.directory_context, str)
        
        # Check dependencies are correctly identified
        self.assertIn('utils', metadata.dependencies)
        self.assertIn('config.settings', metadata.dependencies)
    
    def test_directory_metadata(self):
        """Test the DirectoryMetadata class"""
        config_dir = self.test_dir / 'config'
        dir_metadata = create_directory_summary(config_dir)
        
        self.assertIsInstance(dir_metadata.name, str)
        self.assertIsInstance(dir_metadata.purpose, str)
        self.assertIsInstance(dir_metadata.files, list)
        self.assertEqual(len(dir_metadata.files), 1)  # Should contain settings.py
    
    def test_chunk_metadata(self):
        """Test the ChunkMetadata for large file sectioning"""
        large_content = "\n".join([f"line {i}" for i in range(1000)])
        large_file = self.test_dir / 'large_file.py'
        large_file.write_text(large_content)
        
        metadata = get_file_metadata(large_file)
        self.assertIsNotNone(metadata.chunk_info)
        self.assertGreater(len(metadata.chunks), 0)
        
        # Test chunk properties
        first_chunk = metadata.chunks[0]
        self.assertIsInstance(first_chunk.summary, str)
        self.assertIsInstance(first_chunk.start_line, int)
        self.assertIsInstance(first_chunk.end_line, int)
    
    def test_file_purpose_generation(self):
        """Test the file purpose generation functionality"""
        main_file = self.test_dir / 'main.py'
        purpose = generate_file_purpose(main_file)
        
        self.assertIsInstance(purpose, str)
        self.assertGreater(len(purpose), 0)
        self.assertIn("main", purpose.lower())  # Should mention it's a main script
    
    def test_dependency_extraction(self):
        """Test the dependency extraction functionality"""
        main_file = self.test_dir / 'main.py'
        deps = extract_dependencies(main_file)
        
        self.assertIsInstance(deps, list)
        self.assertEqual(len(deps), 2)  # Should find utils and config.settings
        self.assertIn('utils', deps)
        self.assertIn('config.settings', deps)

class TestEnhancedFormatters(unittest.TestCase):
    def setUp(self):
        self.test_file = FileMetadata(
            file_name='test.py',
            relative_path='src/test.py',
            content='print("test")',
            size=100,
            last_modified='2025-01-16T00:00:00Z',
            language_id='python',
            purpose='Test file for unit tests',
            dependencies=['utils'],
            directory_context='Source directory containing application code'
        )
    
    def test_markdown_formatter_enhanced_output(self):
        """Test the enhanced markdown formatter output"""
        formatter = MarkdownFormatter()
        output = formatter.format([self.test_file])
        
        # Check for new metadata sections
        self.assertIn('## File Purpose', output)
        self.assertIn('Test file for unit tests', output)
        self.assertIn('## Dependencies', output)
        self.assertIn('utils', output)
        self.assertIn('## Directory Context', output)
        self.assertIn('Source directory', output)
        
        # Check for code section
        self.assertIn('```python', output)
        self.assertIn('print("test")', output)
        self.assertIn('```', output)

# Mock data for testing
@pytest.fixture()
def mock_file_metadata(tmp_path: Path):
    file_path = tmp_path / "test_file.py"
    file_path.write_text(
        "import os\nimport sys\n\ndef my_function():\n    pass\nclass MyClass:\n    pass"
    )
    return get_file_metadata(file_path, tmp_path)

@pytest.fixture
def mock_directory_metadata(tmp_path):
    dir_path = tmp_path / "test_dir"
    dir_path.mkdir()
    (dir_path / "file1.py").write_text("import module1")
    (dir_path / "file2.txt").write_text("Some text")
    return create_directory_summary(dir_path)

# Tests for new features
def test_cross_file_references(tmp_path):
    # Create two files with cross-references
    file1_path = tmp_path / "file1.py"
    file2_path = tmp_path / "file2.py"
    file1_path.write_text("import file2")
    file2_path.write_text("import file1")
    
    # Get metadata for each file
    file1_metadata = get_file_metadata(file1_path, tmp_path)
    file2_metadata = get_file_metadata(file2_path, tmp_path)
    
    # Verify that dependencies are correctly recorded
    assert "file2" in file1_metadata.dependencies
    assert "file1" in file2_metadata.dependencies

def test_file_analysis_summary(mock_file_metadata):
    # Verify that the file analysis summary is generated
    assert "Quick Analysis" in mock_file_metadata.file_analysis
    assert "**Classes Defined:** MyClass" in mock_file_metadata.file_analysis
    assert "**Primary Functions:** my_function" in mock_file_metadata.file_analysis
    assert "**Key Dependencies:** os, sys" in mock_file_metadata.file_analysis

def test_chunk_demarcation(tmp_path):
    # Create a large file
    large_file_path = tmp_path / "large_file.py"
    large_file_path.write_text("\n".join([f"line {i}" for i in range(600)]))
    
    # Get metadata for the large file
    large_file_metadata = get_file_metadata(large_file_path, tmp_path)
    
    # Verify that chunks are created and demarcated
    assert len(large_file_metadata.chunks) > 1
    assert "Chunk 1 of" in large_file_metadata.formatted_content

def test_file_directory_hierarchy_path(tmp_path):
    # Create a nested directory structure
    nested_dir_path = tmp_path / "dir1" / "dir2" / "dir3"
    nested_dir_path.mkdir(parents=True)
    file_path = nested_dir_path / "test_file.py"
    file_path.write_text("content")

    # Get metadata for the file, using tmp_path as root_path
    file_metadata = get_file_metadata(file_path, tmp_path)

    # Verify that the relative path is correct relative to tmp_path
    assert file_metadata.relative_path == "dir1/dir2/dir3/test_file.py"

def test_optional_summary_of_changes(tmp_path):
    """Test that file changes are properly tracked and reported."""
    # Create a file and get its metadata
    file_path = tmp_path / "test_file.py"
    cache_file = tmp_path / ".aggregator_cache"
    
    # First run - new file
    file_path.write_text("initial content")
    output1 = aggregate_files(
        root_dir=str(tmp_path),
        track_changes=True
    )
    
    # Second run - modified file
    file_path.write_text("updated content")
    output2 = aggregate_files(
        root_dir=str(tmp_path),
        track_changes=True
    )
    
    # Third run - remove file
    file_path.unlink()
    output3 = aggregate_files(
        root_dir=str(tmp_path),
        track_changes=True
    )
 
    # Verify that the summary of changes is included
    assert "Added Files" in output1  # First run should show the file as added
    assert "test_file.py" in output1
    
    assert "Modified Files" in output2  # Second run should show the file as modified
    assert "test_file.py" in output2
    
    assert "Removed Files" in output3  # Third run should show the file as removed
    assert "test_file.py" in output3

def test_user_customizable_summaries(tmp_path):
    """Test that user-provided summaries are correctly read from sidecar files."""
    # Create a file and a sidecar file with a custom summary
    file_path = tmp_path / "test_file.py"
    sidecar_path = tmp_path / "test_file.py.notes"
    
    # Create both files with explicit mode
    file_path.write_text("content")
    sidecar_path.write_text("This is a user-provided summary.")
    file_path.chmod(0o644)  # Read/write for owner, read for others
    sidecar_path.chmod(0o644)  # Read/write for owner, read for others
    
    # Ensure the files exist and are readable
    assert file_path.exists(), "Main file was not created"
    assert sidecar_path.exists(), "Sidecar file was not created"
    assert os.access(str(file_path), os.R_OK), "Main file is not readable"
    assert os.access(str(sidecar_path), os.R_OK), "Sidecar file is not readable"
    
    # Print debug information
    print(f"\nDebug info:")
    print(f"Main file path: {file_path}")
    print(f"Main file exists: {file_path.exists()}")
    print(f"Main file is readable: {os.access(str(file_path), os.R_OK)}")
    print(f"Sidecar file path: {sidecar_path}")
    print(f"Sidecar file exists: {sidecar_path.exists()}")
    print(f"Sidecar file is readable: {os.access(str(sidecar_path), os.R_OK)}")
    print(f"Sidecar file content: {sidecar_path.read_text()}")
    
    # Get metadata for the file
    file_metadata = get_file_metadata(file_path, tmp_path)
    
    # Verify that the user summary is included
    assert file_metadata.user_summary == "This is a user-provided summary."
    
    # Test alternative sidecar file locations
    notes_dir = tmp_path / ".notes"
    notes_dir.mkdir()
    alt_file_path = tmp_path / "alt_file.py"
    alt_notes_path = notes_dir / "alt_file.py"
    
    # Create the alternative files with explicit mode
    alt_file_path.write_text("content")
    alt_notes_path.write_text("Alternative summary location")
    alt_file_path.chmod(0o644)
    alt_notes_path.chmod(0o644)
    
    # Ensure the alternative files exist and are readable
    assert alt_file_path.exists(), "Alternative main file was not created"
    assert alt_notes_path.exists(), "Alternative notes file was not created"
    assert os.access(str(alt_file_path), os.R_OK), "Alternative main file is not readable"
    assert os.access(str(alt_notes_path), os.R_OK), "Alternative notes file is not readable"
    
    alt_metadata = get_file_metadata(alt_file_path, tmp_path)
    assert alt_metadata.user_summary == "Alternative summary location"
    
    # Test formatting
    formatter = MarkdownFormatter()
    output = formatter.format([file_metadata])
    assert "### User-Provided Summary" in output
    assert "This is a user-provided summary." in output

def test_code_fence_language_mapping(tmp_path):
    # Create a Python file
    python_file_path = tmp_path / "test_file.py"
    python_file_path.write_text("def my_function():\n    pass")
    
    # Get metadata for the file
    python_file_metadata = get_file_metadata(python_file_path, tmp_path)
    
    # Verify that code chunks are wrapped in Python code fences
    assert "```python" in python_file_metadata.formatted_content

def test_toc_with_sub_sections(tmp_path):
    # Create a file with multiple chunks
    large_file_path = tmp_path / "large_file.py"
    large_file_path.write_text("\n".join([f"line {i}" for i in range(600)]))

    # Get metadata for the file
    large_file_metadata = get_file_metadata(large_file_path, tmp_path)

    # Verify that the TOC includes sub-sections for chunks
    large_file_metadata.generate_toc_entries()
    
    # Check TOC entries
    assert len(large_file_metadata.toc_entries) > 1
    assert large_file_metadata.toc_entries[0].title == "large_file.py"
    assert large_file_metadata.toc_entries[1].title == "large_file.py (Part 1)"
    
    # Check formatting
    formatter = MarkdownFormatter()
    output = formatter.format([large_file_metadata])
    assert "## Table of Contents" in output
    assert "- [large_file.py (Part 1)]" in output

# Existing tests (can be updated to cover new output format)
def test_get_file_metadata(mock_file_metadata):
    assert mock_file_metadata.file_name == "test_file.py"
    assert mock_file_metadata.language_id == "python"
    assert "import os" in mock_file_metadata.content

def test_generate_file_purpose(tmp_path):
    file_path = tmp_path / "test_purpose.py"
    file_path.write_text("# This file is for testing purposes.")
    purpose = generate_file_purpose(file_path)
    assert purpose == "This file is for testing purposes."

def test_extract_dependencies(tmp_path):
    file_path = tmp_path / "test_dependencies.py"
    file_path.write_text("import os\nfrom sys import path")
    dependencies = extract_dependencies(file_path)
    assert set(dependencies) == {"os", "sys"}

def test_create_directory_summary(mock_directory_metadata):
    assert mock_directory_metadata.name == "test_dir"
    assert len(mock_directory_metadata.files) == 2

def test_base_formatter(mock_file_metadata):
    class TestFormatter(BaseFormatter):
        def format(self, files: List[FileMetadata]) -> str:
            return "Test format"
    
    formatter = TestFormatter()
    assert formatter.chunk_size == 2000
    assert formatter.extra_spacing is True
    
    # Test with custom values
    custom_formatter = TestFormatter(chunk_size=1000, extra_spacing=False)
    assert custom_formatter.chunk_size == 1000
    assert custom_formatter.extra_spacing is False

def test_markdown_formatter(mock_file_metadata):
    formatter = MarkdownFormatter()
    formatted_output = formatter.format([mock_file_metadata])
    assert "File Purpose" in formatted_output

def test_html_formatter(mock_file_metadata):
    formatter = HTMLFormatter()
    formatted_output = formatter.format([mock_file_metadata])
    assert "<h3>File Purpose</h3>" in formatted_output

def test_get_language_from_path():
    assert get_language_from_path(Path("test.py")) == "python"
    assert get_language_from_path(Path("test.js")) == "javascript"
    assert get_language_from_path(Path("test.txt")) == "plaintext"

def test_should_ignore_file(tmp_path):
    assert should_ignore_file(tmp_path / "node_modules" / "test.js")
    assert should_ignore_file(tmp_path / ".git" / "index")
    assert not should_ignore_file(tmp_path / "main.py")

def test_is_text_file():
    assert is_text_file(Path("test.py"))
    assert not is_text_file(Path("image.png"))

def test_gitignore_filter(tmp_path):
    (tmp_path / ".gitignore").write_text("*.tmp\n/ignore_dir/\nignored_file.txt")
    filter = GitIgnoreFilter(tmp_path)
    assert filter.should_ignore(tmp_path / "file.tmp")
    assert filter.should_ignore(tmp_path / "ignore_dir" / "file.txt")
    assert filter.should_ignore(tmp_path / "ignored_file.txt")
    assert not filter.should_ignore(tmp_path / "file.txt")

def test_blank_line_offset_handling(tmp_path):
    """Test that line numbers are correctly adjusted for blank lines."""
    file_path = tmp_path / "test_file.py"
    content = "\n\n\n\ndef function1():\n    pass\n\n\n\ndef function2():\n    pass"
    file_path.write_text(content)
    
    metadata = get_file_metadata(file_path, tmp_path)
    
    # Check that line numbers in analysis are adjusted
    assert "function1 (Lines 1-2)" in metadata.file_analysis  # Should be adjusted from actual line 5-6
    assert "function2 (Lines 4-5)" in metadata.file_analysis  # Should be adjusted from actual line 10-11

def test_nested_function_detection(tmp_path):
    """Test that nested functions are properly detected and labeled."""
    file_path = tmp_path / "test_file.py"
    content = """
def outer_function():
    def inner_function1():
        pass
    def inner_function2():
        pass
    inner_function1()
"""
    file_path.write_text(content)
    
    metadata = get_file_metadata(file_path, tmp_path)
    
    # Check that nested functions are properly labeled
    assert "outer_function -> inner_function1" in metadata.file_analysis
    assert "outer_function -> inner_function2" in metadata.file_analysis

def test_automatic_fallback_summary(tmp_path):
    """Test that files without docstrings get automatic summaries."""
    # File without docstrings
    file1_path = tmp_path / "no_docstring.py"
    content1 = """
def utility_function():
    pass

class HelperClass:
    pass
"""
    file1_path.write_text(content1)
    
    # File with docstrings
    file2_path = tmp_path / "with_docstring.py"
    content2 = '''"""This is a documented module."""\n''' + content1
    file2_path.write_text(content2)
    
    metadata1 = get_file_metadata(file1_path, tmp_path)
    metadata2 = get_file_metadata(file2_path, tmp_path)
    
    # No docstring file should have an auto-generated purpose
    assert "utility functions" in metadata1.purpose.lower()
    # Docstring file should use its docstring
    assert "documented module" in metadata2.purpose.lower()

def test_complex_type_glossary(tmp_path):
    """Test that complex types and decorators are properly captured."""
    file_path = tmp_path / "test_file.py"
    content = """
from typing import List, Dict, Optional

@decorator
def complex_function(data: List[Dict[str, Optional[int]]]) -> None:
    pass
"""
    file_path.write_text(content)
    
    metadata = get_file_metadata(file_path, tmp_path)
    
    # Check that complex type is captured
    assert "List[Dict[str, Optional[int]]]" in metadata.file_analysis
    # Check that decorator is noted
    assert "@decorator" in metadata.file_analysis

def test_pattern_match_line_numbers(tmp_path):
    """Test that pattern matches preserve original line numbers."""
    file_path = tmp_path / "test_file.py"
    content = """
# Some code
# More code
# TODO: Fix this
# More code
# FIXME: Another issue
"""
    file_path.write_text(content)
    
    metadata = get_file_metadata(file_path, tmp_path)
    
    # Check that line numbers are preserved
    assert "TODO (Line 4):" in metadata.file_analysis
    assert "FIXME (Line 6):" in metadata.file_analysis

def test_readme_directory_purpose(tmp_path):
    """Test that README.md informs directory purpose but isn't counted as source."""
    dir_path = tmp_path / "src"
    dir_path.mkdir()
    
    # Create README.md
    readme_path = dir_path / "README.md"
    readme_path.write_text("# Source Directory\nContains core application logic.")
    
    # Create a source file
    source_path = dir_path / "main.py"
    source_path.write_text("print('hello')")
    
    dir_metadata = create_directory_summary(dir_path)
    
    # README should inform purpose
    assert "core application logic" in dir_metadata.purpose.lower()
    # But shouldn't be counted in files
    assert len(dir_metadata.files) == 1
    assert "main.py" in dir_metadata.files
    assert "README.md" not in dir_metadata.files

def test_html_code_block_format(tmp_path):
    """Test that HTML formatter produces exact code block format."""
    file_path = tmp_path / "test.py"
    file_path.write_text("print('test')")
    
    metadata = get_file_metadata(file_path, tmp_path)
    formatter = HTMLFormatter()
    output = formatter.format([metadata])
    
    expected_pattern = '<pre><code class="python">'
    assert expected_pattern in output

def test_incremental_mode(tmp_path):
    """Test that incremental mode only processes changed files."""
    # Create initial files
    file1 = tmp_path / "file1.py"
    file2 = tmp_path / "file2.py"
    file1.write_text("print('v1')")
    file2.write_text("print('v1')")
    
    # First run to establish baseline
    result1 = aggregate_files(
        root_dir=str(tmp_path),
        track_changes=True
    )
    
    # Modify only file1
    file1.write_text("print('v2')")
    
    # Second run in incremental mode
    result2 = aggregate_files(
        root_dir=str(tmp_path),
        track_changes=True,
        incremental=True  # New parameter
    )
    
    # Only file1 should be marked as changed
    assert "file1.py (modified)" in result2
    assert "file2.py" not in result2

if __name__ == '__main__':
    pytest.main() 