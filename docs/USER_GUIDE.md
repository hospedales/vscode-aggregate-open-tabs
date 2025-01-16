# VSCode Tab Aggregator Extension User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Core Features](#core-features)
5. [Configuration](#configuration)
6. [Advanced Features](#advanced-features)
7. [Tips & Tricks](#tips--tricks)
8. [Troubleshooting](#troubleshooting)

## Introduction
The VSCode Tab Aggregator Extension helps you manage and analyze multiple open files in your workspace. It provides powerful features for aggregating file content, tracking cross-references, managing snapshots, and organizing files with tags.

### Key Features
- Aggregate content from multiple open tabs
- Track cross-references between files
- Create and manage file/directory tags
- Take and compare snapshots
- Customizable summary depths
- Real-time preview with syntax highlighting

## Installation
1. Open VSCode
2. Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "Tab Aggregator"
4. Click Install
5. Reload VSCode when prompted

## Quick Start
1. Open multiple files in your workspace
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Aggregate Open Tabs" and select the command
4. View the aggregated content in the preview panel

## Core Features

### File Aggregation
- **Basic Aggregation**: Use the "Aggregate Open Tabs" command to combine content from all open tabs
- **Selective Aggregation**: Choose specific files to include in the aggregation
- **Preview Panel**: View aggregated content with syntax highlighting and search capabilities
- **Auto-refresh**: Content updates automatically as you modify files

### Cross-References
Cross-references help you understand relationships between files:
- **Import/Export Tracking**: Automatically detects and displays file dependencies
- **Usage Analysis**: Shows where functions and variables are used
- **Visualization**: Clear visual representation of file relationships

### File Tagging
Organize your files with a flexible tagging system:
- **Create Tags**: Add custom tags with colors and descriptions
- **Apply Tags**: Tag individual files or entire directories
- **Tag Inheritance**: Child directories can inherit parent tags
- **Tag Visualization**: Tags appear in the preview with their assigned colors

### Snapshots
Track changes over time with snapshots:
- **Create Snapshots**: Save the current state of your files
- **Compare Snapshots**: View differences between snapshots
- **Metadata**: Each snapshot includes timestamp and description
- **Export/Import**: Share snapshots with team members

## Configuration

### Summary Depths
Choose from five levels of detail:
- **Minimal**: Basic file information only
- **Basic**: Adds key functions and classes
- **Standard**: Includes imports and exports
- **Detailed**: Adds cross-references and documentation
- **Comprehensive**: Full analysis with all available information

### Configuration Panel
Access the visual configuration panel to customize:
- **Output Format**: Choose between plain text, Markdown, or HTML
- **Preview Settings**: Configure split view, syntax highlighting, and auto-refresh
- **Performance Options**: Adjust caching and memory usage
- **Preset Configurations**: Choose from predefined settings for different workflows

### Keyboard Shortcuts
Default shortcuts (customizable in VSCode settings):
- `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (Mac): Aggregate open tabs
- `Ctrl+Shift+P` then type "Tab Aggregator": Access all commands

## Advanced Features

### Preview Panel Features
- **Split View**: View source and output side by side
- **Syntax Highlighting**: Language-specific code highlighting
- **Search/Filter**: Quick search through aggregated content
- **Collapsible Sections**: Expand/collapse file sections
- **Real-time Updates**: Content updates as you type

### Performance Optimization
- **File Caching**: Improved performance for frequently accessed files
- **Lazy Loading**: Efficient handling of large files
- **Memory Management**: Automatic optimization of memory usage
- **Progress Indicators**: Visual feedback for long operations

## Tips & Tricks
1. Use keyboard shortcuts for faster workflow
2. Create custom tags for project-specific organization
3. Use snapshots before major refactoring
4. Configure auto-refresh for real-time preview
5. Utilize preset configurations for different tasks

## Troubleshooting

### Common Issues
1. **Preview not updating**: Check if auto-refresh is enabled
2. **Performance issues**: 
   - Adjust cache memory limit
   - Enable lazy loading for large files
3. **Missing cross-references**: Ensure files are saved and indexed

### Getting Help
- Check the [GitHub Issues](https://github.com/yourusername/vscode-tab-aggregator/issues)
- Submit bug reports with detailed reproduction steps
- Join the community discussions

---

For developer documentation and contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md) 