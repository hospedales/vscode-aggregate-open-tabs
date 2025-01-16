import unittest
import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Dict
from python_aggregator import (
    FileMetadata,
    get_file_metadata,
    should_ignore_file,
    detect_sensitive_data,
    redact_sensitive_data,
    aggregate_files,
    BaseFormatter,
    PlainTextFormatter,
    MarkdownFormatter,
    HTMLFormatter,
)

class TestPythonAggregator(unittest.TestCase):
    def setUp(self):
        # Create a temporary directory for test files
        self.test_dir = tempfile.mkdtemp()
        self.sample_files = self._create_sample_files()

    def tearDown(self):
        # Clean up temporary directory
        shutil.rmtree(self.test_dir)

    def _create_sample_files(self) -> Dict[str, str]:
        """Create sample files for testing and return their paths and contents."""
        files = {
            "main.py": "def main():\n    print('Hello, World!')\n\nif __name__ == '__main__':\n    main()",
            "config.json": '{\n    "api_key": "secret123",\n    "debug": true\n}',
            "README.md": "# Test Project\nThis is a test project.",
            ".env": "API_KEY=secret123\nDEBUG=true",
            "node_modules/package/index.js": "console.log('Should be ignored')",
            ".git/config": "[core]\n    bare = false",
        }

        for rel_path, content in files.items():
            full_path = Path(self.test_dir) / rel_path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)

        return files

    def test_file_metadata(self):
        """Test file metadata collection."""
        test_file = Path(self.test_dir) / "main.py"
        metadata = get_file_metadata(test_file)

        self.assertEqual(metadata.file_name, "main.py")
        self.assertEqual(metadata.language_id, "python")
        self.assertEqual(metadata.content, self.sample_files["main.py"])
        self.assertGreater(metadata.size, 0)
        self.assertTrue(metadata.last_modified)

    def test_ignore_patterns(self):
        """Test file ignoring patterns."""
        # Should be ignored
        self.assertTrue(should_ignore_file(Path(self.test_dir) / "node_modules/package/index.js"))
        self.assertTrue(should_ignore_file(Path(self.test_dir) / ".git/config"))
        
        # Should not be ignored
        self.assertFalse(should_ignore_file(Path(self.test_dir) / "main.py"))
        self.assertFalse(should_ignore_file(Path(self.test_dir) / "config.json"))

    def test_sensitive_data_detection(self):
        """Test sensitive data detection."""
        content = self.sample_files["config.json"]
        matches = detect_sensitive_data(content)

        self.assertTrue(any(match.pattern == "api_key" for match in matches))
        self.assertTrue(any("secret123" in match.value for match in matches))

    def test_sensitive_data_redaction(self):
        """Test sensitive data redaction."""
        content = self.sample_files["config.json"]
        matches = detect_sensitive_data(content)
        redacted = redact_sensitive_data(content, matches)

        self.assertNotIn("secret123", redacted)
        self.assertIn("*****", redacted)

    def test_file_aggregation(self):
        """Test file aggregation process."""
        output = aggregate_files(
            root_dir=self.test_dir,
            exclude_dirs=["node_modules", ".git"],
            redact=True,
            output_format="plaintext"
        )

        # Check that ignored files are not included
        self.assertNotIn("Should be ignored", output)
        self.assertNotIn("[core]", output)

        # Check that other files are included
        self.assertIn("def main():", output)
        self.assertIn("# Test Project", output)

        # Check that sensitive data is redacted
        self.assertNotIn("secret123", output)

    def test_plaintext_formatter(self):
        """Test plaintext output formatting."""
        formatter = PlainTextFormatter()
        metadata = get_file_metadata(Path(self.test_dir) / "main.py")
        output = formatter.format([metadata])

        self.assertIn("=============================================================================", output)
        self.assertIn("File: main.py", output)
        self.assertIn("def main():", output)

    def test_markdown_formatter(self):
        """Test markdown output formatting."""
        formatter = MarkdownFormatter()
        metadata = get_file_metadata(Path(self.test_dir) / "main.py")
        output = formatter.format([metadata])

        self.assertIn("## main.py", output)
        self.assertIn("```python", output)
        self.assertIn("def main():", output)
        self.assertIn("```", output)

    def test_html_formatter(self):
        """Test HTML output formatting."""
        formatter = HTMLFormatter()
        metadata = get_file_metadata(Path(self.test_dir) / "main.py")
        output = formatter.format([metadata])

        self.assertIn('<h2 class="file-title">main.py</h2>', output)
        self.assertIn('<pre><code class="language-python">', output)
        self.assertIn("def main():", output)
        self.assertIn("</code></pre>", output)

if __name__ == '__main__':
    unittest.main() 