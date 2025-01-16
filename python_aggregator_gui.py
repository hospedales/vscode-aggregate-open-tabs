#!/usr/bin/env python3
"""GUI wrapper for the Python Code Aggregator."""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
import threading
import queue
from typing import Optional, Callable
from python_aggregator import aggregate_files

class AggregatorGUI:
    def __init__(self, root: tk.Tk, aggregator_func=None):
        self.root = root
        self.root.title("Python Code Aggregator")
        
        # Set the aggregator function (allows injection for testing)
        self.aggregator_func = aggregator_func or aggregate_files
        
        # Create a queue for thread-safe communication
        self.queue = queue.Queue()
        
        # Variables
        self.directory_var = tk.StringVar(value="")
        self.format_var = tk.StringVar(value="markdown")
        self.chunk_size_var = tk.StringVar(value="2000")
        self.extra_spacing_var = tk.BooleanVar(value=True)
        self.track_changes_var = tk.BooleanVar(value=False)
        self.exclude_dirs_var = tk.StringVar(value="")
        self.output_file_var = tk.StringVar(value="")
        self.status_var = tk.StringVar(value="Ready")
        self.progress_var = tk.DoubleVar(value=0)
        
        # Create GUI elements
        self.create_input_section()
        self.create_options_section()
        self.create_preview_section()
        self.create_status_section()
        
        # Start queue processing
        self.process_queue()
        
    def process_queue(self):
        """Process any pending events in the GUI."""
        try:
            while True:
                func = self.queue.get_nowait()
                func()
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self.process_queue)
            
    def schedule_gui_update(self, func: Callable):
        """Schedule a GUI update to run on the main thread."""
        self.queue.put(func)
        
    def update_status(self, message: str, progress: Optional[float] = None):
        """Update the status message and progress bar."""
        def _update():
            self.status_var.set(message)
            if progress is not None:
                self.progress_var.set(progress)
            self.root.update_idletasks()
        self.schedule_gui_update(_update)
        
    def create_input_section(self):
        """Create the input section of the GUI."""
        input_frame = ttk.LabelFrame(self.root, text="Input", padding="5 5 5 5")
        input_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Directory selection
        ttk.Label(input_frame, text="Project Directory:").pack(fill=tk.X)
        dir_frame = ttk.Frame(input_frame)
        dir_frame.pack(fill=tk.X)
        ttk.Entry(dir_frame, textvariable=self.directory_var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(dir_frame, text="Browse", command=self.browse_directory).pack(side=tk.RIGHT)
        
        # Output file selection
        ttk.Label(input_frame, text="Output File (optional):").pack(fill=tk.X)
        out_frame = ttk.Frame(input_frame)
        out_frame.pack(fill=tk.X)
        ttk.Entry(out_frame, textvariable=self.output_file_var).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(out_frame, text="Browse", command=self.browse_output_file).pack(side=tk.RIGHT)
        
    def create_options_section(self):
        """Create the options section of the GUI."""
        options_frame = ttk.LabelFrame(self.root, text="Options", padding="5 5 5 5")
        options_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Format selection
        ttk.Label(options_frame, text="Output Format:").pack(fill=tk.X)
        format_frame = ttk.Frame(options_frame)
        format_frame.pack(fill=tk.X)
        formats = ["markdown", "plaintext", "html"]
        for fmt in formats:
            ttk.Radiobutton(format_frame, text=fmt.title(), value=fmt, 
                          variable=self.format_var).pack(side=tk.LEFT)
        
        # Chunk size
        ttk.Label(options_frame, text="Chunk Size:").pack(fill=tk.X)
        ttk.Entry(options_frame, textvariable=self.chunk_size_var).pack(fill=tk.X)
        
        # Exclude directories
        ttk.Label(options_frame, text="Exclude Directories (comma-separated):").pack(fill=tk.X)
        ttk.Entry(options_frame, textvariable=self.exclude_dirs_var).pack(fill=tk.X)
        
        # Checkboxes
        ttk.Checkbutton(options_frame, text="Extra Spacing", 
                       variable=self.extra_spacing_var).pack(fill=tk.X)
        ttk.Checkbutton(options_frame, text="Track Changes", 
                       variable=self.track_changes_var).pack(fill=tk.X)
        
    def create_preview_section(self):
        """Create the preview section of the GUI."""
        preview_frame = ttk.LabelFrame(self.root, text="Preview", padding="5 5 5 5")
        preview_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Preview text area
        self.preview_text = tk.Text(preview_frame, wrap=tk.WORD, height=20)
        self.preview_text.pack(fill=tk.BOTH, expand=True)
        
        # Scrollbar
        scrollbar = ttk.Scrollbar(preview_frame, orient=tk.VERTICAL, 
                                command=self.preview_text.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.preview_text.config(yscrollcommand=scrollbar.set)
        
        # Buttons
        button_frame = ttk.Frame(preview_frame)
        button_frame.pack(fill=tk.X, pady=5)
        ttk.Button(button_frame, text="Preview", 
                  command=self.preview_aggregation).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Aggregate", 
                  command=lambda: self.start_aggregation(preview=False)).pack(side=tk.LEFT)
        
    def create_status_section(self):
        """Create the status section of the GUI."""
        status_frame = ttk.Frame(self.root, padding="5 5 5 5")
        status_frame.pack(fill=tk.X, padx=5, pady=5)
        
        # Status label
        ttk.Label(status_frame, textvariable=self.status_var).pack(side=tk.LEFT)
        
        # Progress bar
        self.progress_bar = ttk.Progressbar(status_frame, variable=self.progress_var,
                                          mode='determinate', length=200)
        self.progress_bar.pack(side=tk.RIGHT)
        
    def browse_directory(self):
        """Open a directory browser dialog."""
        directory = filedialog.askdirectory()
        if directory:
            self.directory_var.set(directory)
            
    def browse_output_file(self):
        """Open a file save dialog."""
        file_path = filedialog.asksaveasfilename(
            defaultextension=".md",
            filetypes=[
                ("Markdown files", "*.md"),
                ("Text files", "*.txt"),
                ("HTML files", "*.html"),
                ("All files", "*.*")
            ]
        )
        if file_path:
            self.output_file_var.set(file_path)
            
    def validate_inputs(self) -> bool:
        """Validate user inputs before aggregation."""
        try:
            chunk_size = int(self.chunk_size_var.get())
            if chunk_size <= 0:
                self.update_status("Error: Invalid chunk size - must be positive")
                return False
        except ValueError as e:
            self.update_status("Error: Invalid chunk size - must be a number")
            return False
            
        directory = self.directory_var.get()
        if not directory:
            self.update_status("Error: Please select a project directory")
            return False
            
        return True
        
    def preview_aggregation(self):
        """Start aggregation in preview mode."""
        self.start_aggregation(preview=True)
        
    def start_aggregation(self, preview: bool = False):
        """Start the aggregation process."""
        if not self.validate_inputs():
            return
            
        # Clear previous preview
        if preview:
            def _clear_preview():
                self.preview_text.delete("1.0", tk.END)
            self.schedule_gui_update(_clear_preview)
            
        # Run aggregation directly for testing or in a thread for normal operation
        if threading.current_thread() is threading.main_thread():
            self.aggregate(preview)
        else:
            thread = threading.Thread(
                target=self.aggregate,
                args=(preview,),
                daemon=True
            )
            thread.start()
        
    def aggregate(self, preview: bool = False):
        """Perform the aggregation process."""
        try:
            directory = self.directory_var.get()
            exclude_dirs = [
                d.strip() for d in self.exclude_dirs_var.get().split(",")
                if d.strip()
            ]
            
            self.update_status("Aggregating files...", 0)
            
            output = self.aggregator_func(
                root_dir=directory,
                exclude_dirs=exclude_dirs or None,
                output_format=self.format_var.get(),
                chunk_size=int(self.chunk_size_var.get()),
                extra_spacing=self.extra_spacing_var.get(),
                track_changes=self.track_changes_var.get()
            )
            
            self.update_status("Processing complete", 100)
            
            def _update_output():
                if preview:
                    self.preview_text.delete("1.0", tk.END)
                    self.preview_text.insert("1.0", output)
                else:
                    output_file = self.output_file_var.get()
                    if output_file:
                        Path(output_file).write_text(output)
                        self.update_status(f"Output written to {output_file}")
                    else:
                        self.preview_text.delete("1.0", tk.END)
                        self.preview_text.insert("1.0", output)
                        self.update_status("Output displayed in preview (no output file specified)")
                        
            self.schedule_gui_update(_update_output)
            
        except Exception as error:
            error_msg = f"Error: {str(error)}"
            def _show_error():
                self.update_status(error_msg)
                if not preview:
                    messagebox.showerror("Error", error_msg)
            self.schedule_gui_update(_show_error)

def main():
    root = tk.Tk()
    app = AggregatorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main() 