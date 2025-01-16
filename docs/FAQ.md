# Frequently Asked Questions (FAQ)

## General Questions

### What is the Tab Aggregator extension?
The Tab Aggregator is a VSCode extension that helps you manage and analyze multiple open files. It combines content from open tabs, tracks relationships between files, and provides tools for organizing and documenting your code.

### What are the main features?
- File content aggregation
- Cross-reference tracking
- File/directory tagging
- Snapshot management
- Customizable summaries
- Real-time preview

### Which file types are supported?
The extension supports all text-based files, with enhanced features for:
- Programming languages (TypeScript, JavaScript, Python, etc.)
- Markup languages (HTML, Markdown, XML)
- Configuration files (JSON, YAML)
- Documentation files

## Usage Questions

### How do I start using the extension?
1. Install the extension from the VSCode marketplace
2. Open multiple files in your workspace
3. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
4. Type "Aggregate Open Tabs" to start

### How do I customize the output format?
1. Open the configuration panel
2. Choose your preferred output format (Plain Text, Markdown, HTML)
3. Adjust summary depth and included information
4. Use preset configurations for common scenarios

### How do tags work?
1. Create tags with custom colors and descriptions
2. Apply tags to files or directories
3. Tags can be inherited by subdirectories
4. Tags appear in the preview with their assigned colors

### How do I use snapshots?
1. Create a snapshot using the command palette
2. Add a description for the snapshot
3. Create another snapshot after making changes
4. Use the compare command to see differences

## Performance Questions

### Why is the extension running slowly?
Common reasons for performance issues:
1. Too many large files open
2. Cache memory limit too low
3. Lazy loading disabled for large files
4. Heavy analysis options enabled

Solutions:
- Adjust cache memory limit in settings
- Enable lazy loading for large files
- Use selective aggregation for specific files
- Choose a less detailed summary depth

### How much memory does the extension use?
- Base memory usage: ~50MB
- Additional usage varies based on:
  - Number of open files
  - File sizes
  - Cache settings
  - Analysis depth

### How can I improve performance?
1. Configure appropriate cache limits
2. Enable lazy loading for large files
3. Use selective aggregation when possible
4. Choose appropriate summary depth
5. Close unused files

## Configuration Questions

### What are summary depths?
The extension offers five summary depths:
1. **Minimal**: Basic file info only
2. **Basic**: Key functions and classes
3. **Standard**: Includes imports/exports
4. **Detailed**: Adds cross-references
5. **Comprehensive**: Full analysis

### How do I configure keyboard shortcuts?
1. Open VSCode keyboard shortcuts (`Ctrl+K Ctrl+S`)
2. Search for "Tab Aggregator"
3. Double-click the shortcut to edit
4. Press your desired key combination

### Can I export my settings?
Yes! The configuration panel provides:
- Export current settings to JSON
- Import settings from JSON
- Preset configurations
- Custom preset saving

## Troubleshooting

### Preview panel is not updating
Check the following:
1. Auto-refresh is enabled
2. Files are saved
3. No syntax errors in files
4. Sufficient memory available

### Cross-references are missing
Ensure that:
1. Files are saved
2. Files are in the workspace
3. Cross-reference tracking is enabled
4. Files are properly indexed

### Tags are not appearing
Verify that:
1. Tags are created correctly
2. Tags are applied to files
3. Tag visualization is enabled
4. Preview is refreshed

### Memory usage is too high
Solutions:
1. Reduce cache memory limit
2. Enable lazy loading
3. Close unused files
4. Use selective aggregation
5. Choose a lower summary depth

## Extension Updates

### How do I update the extension?
1. VSCode will notify you of updates
2. Click the reload button when prompted
3. Or manually check in the extensions panel

### Will updates preserve my settings?
Yes, your settings are preserved across updates, including:
- Custom configurations
- Saved tags
- Keyboard shortcuts
- Preset configurations

## Getting Help

### Where can I report bugs?
1. Visit our [GitHub Issues](https://github.com/yourusername/vscode-tab-aggregator/issues)
2. Check if the issue is already reported
3. Use the bug report template
4. Provide detailed reproduction steps

### How do I request features?
1. Check existing feature requests
2. Create a new issue with the feature request template
3. Describe the feature and its use case
4. Provide examples if possible

### Where can I get support?
- GitHub Issues for bug reports
- Discussions for questions
- Discord community for chat
- Documentation for guides

### How can I contribute?
1. Read the [CONTRIBUTING.md](./CONTRIBUTING.md) guide
2. Fork the repository
3. Make your changes
4. Submit a pull request
5. Participate in code review 