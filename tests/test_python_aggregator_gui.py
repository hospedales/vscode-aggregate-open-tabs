#!/usr/bin/env python3
"""Unit tests for the Python Aggregator GUI."""

import unittest
import tkinter as tk
from tkinter import ttk
from pathlib import Path
import tempfile
import shutil
import threading
import time
import queue
from unittest.mock import Mock
from python_aggregator_gui import AggregatorGUI

class TestAggregatorGUI(unittest.TestCase):
    def setUp(self):
        self.root = tk.Tk()
        self.temp_dir = tempfile.mkdtemp()
        
        # Create some test files
        Path(self.temp_dir, "test.py").write_text("print('hello')")
        Path(self.temp_dir, "test2.py").write_text("print('world')")
        
        # Create mock output
        self.mock_output = (
            "# test.py\n"
            "print('hello')\n\n"
            "# test2.py\n"
            "print('world')\n"
        )
        
        # Create mock aggregator function
        self.mock_aggregate = Mock(return_value=self.mock_output)
        
        # Create GUI with mock
        self.gui = AggregatorGUI(self.root, aggregator_func=self.mock_aggregate)
        
    def tearDown(self):
        self.root.destroy()
        shutil.rmtree(self.temp_dir)
        
    def process_events(self, timeout: float = 2.0):
        """Process any pending events in the GUI with a timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            self.root.update()
            try:
                while True:
                    self.gui.queue.get_nowait()()
            except queue.Empty:
                pass
            time.sleep(0.1)
            
    def test_initial_state(self):
        """Test the initial state of the GUI."""
        self.assertEqual(self.gui.status_var.get(), "Ready")
        self.assertEqual(self.gui.format_var.get(), "markdown")
        self.assertEqual(self.gui.chunk_size_var.get(), "2000")
        self.assertTrue(self.gui.extra_spacing_var.get())
        self.assertFalse(self.gui.track_changes_var.get())
        self.assertEqual(self.gui.exclude_dirs_var.get(), "")
        self.assertEqual(self.gui.output_file_var.get(), "")
        
    def test_directory_selection(self):
        """Test directory selection functionality."""
        self.gui.directory_var.set(self.temp_dir)
        self.process_events()
        self.assertEqual(self.gui.directory_var.get(), self.temp_dir)
        
    def test_preview_without_directory(self):
        """Test preview functionality without selecting a directory."""
        self.gui.directory_var.set("")
        self.gui.chunk_size_var.set("100")  # Set valid chunk size first
        self.gui.preview_aggregation()
        self.process_events()
        self.assertEqual(self.gui.status_var.get(), "Error: Please select a project directory")
        
    def test_aggregation_with_valid_directory(self):
        """Test aggregation with a valid directory."""
        self.gui.directory_var.set(self.temp_dir)
        self.gui.chunk_size_var.set("100")  # Set valid chunk size
        self.gui.preview_aggregation()
        self.process_events(5.0)  # Longer timeout for aggregation
        
        # Verify the mock was called with correct arguments
        self.mock_aggregate.assert_called_once()
        args, kwargs = self.mock_aggregate.call_args
        self.assertEqual(kwargs['root_dir'], self.temp_dir)
        self.assertEqual(kwargs['chunk_size'], 100)
        self.assertEqual(kwargs['output_format'], 'markdown')
        
        # Verify the preview text matches the mock output
        preview_text = self.gui.preview_text.get("1.0", tk.END).strip()
        self.assertEqual(preview_text, self.mock_output.strip())
        
        # Verify the content
        self.assertIn("test.py", preview_text)
        self.assertIn("test2.py", preview_text)
        self.assertIn("print('hello')", preview_text)
        self.assertIn("print('world')", preview_text)
        
    def test_output_file_selection(self):
        """Test output file selection."""
        output_file = str(Path(self.temp_dir, "output.md"))
        self.gui.output_file_var.set(output_file)
        self.process_events()
        self.assertEqual(self.gui.output_file_var.get(), output_file)
        
    def test_exclude_directories(self):
        """Test excluding directories."""
        exclude_dirs = "node_modules,venv"
        self.gui.exclude_dirs_var.set(exclude_dirs)
        self.process_events()
        self.assertEqual(self.gui.exclude_dirs_var.get(), exclude_dirs)
        
    def test_format_selection(self):
        """Test format selection."""
        self.gui.format_var.set("plaintext")
        self.process_events()
        self.assertEqual(self.gui.format_var.get(), "plaintext")
        
    def test_chunk_size_validation(self):
        """Test chunk size validation."""
        # Test invalid chunk size
        self.gui.directory_var.set(self.temp_dir)  # Set valid directory first
        self.gui.chunk_size_var.set("invalid")
        self.gui.preview_aggregation()
        self.process_events()
        self.assertEqual(self.gui.status_var.get(), "Error: Invalid chunk size - must be a number")
        
        # Test negative chunk size
        self.gui.chunk_size_var.set("-100")
        self.gui.preview_aggregation()
        self.process_events()
        self.assertEqual(self.gui.status_var.get(), "Error: Invalid chunk size - must be positive")
        
        # Test valid chunk size
        self.gui.chunk_size_var.set("100")
        self.process_events()
        self.assertEqual(self.gui.chunk_size_var.get(), "100")

if __name__ == "__main__":
    unittest.main() 