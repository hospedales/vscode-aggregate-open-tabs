#!/usr/bin/env python3

import unittest
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass
import tempfile
import os
import shutil

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
    MarkdownFormatter
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
        self.assertIsInstance(metadata.dependencies, list)
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

if __name__ == '__main__':
    unittest.main() 