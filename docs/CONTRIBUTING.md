# Contributing to VSCode Tab Aggregator

## Table of Contents
1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Testing Guidelines](#testing-guidelines)
5. [Performance Guidelines](#performance-guidelines)
6. [Contribution Guidelines](#contribution-guidelines)

## Development Setup

### Prerequisites
- Node.js (v14 or higher)
- VSCode (v1.60 or higher)
- Git

### Getting Started
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vscode-tab-aggregator.git
   cd vscode-tab-aggregator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Open in VSCode:
   ```bash
   code .
   ```

4. Start debugging:
   - Press F5 to launch the extension development host
   - Use "Run Extension" from the debug menu

## Project Structure

```
vscode-tab-aggregator/
├── src/                      # Source code
│   ├── extension.ts          # Extension entry point
│   ├── analyzer.ts           # File analysis logic
│   ├── formatters.ts         # Output formatters
│   ├── configurationUI.ts    # Configuration panel
│   ├── previewPanel.ts       # Preview functionality
│   ├── cacheManager.ts       # Performance optimization
│   ├── tagManager.ts         # Tag management
│   └── utils.ts             # Helper functions
├── media/                    # Static assets
├── test/                     # Test files
└── docs/                     # Documentation
```

### Key Components

#### Extension Entry Point (`extension.ts`)
- Registers commands and providers
- Initializes core services
- Manages extension lifecycle

#### Analyzer (`analyzer.ts`)
- Parses file content
- Detects cross-references
- Generates file summaries
- Handles different summary depths

#### Formatters (`formatters.ts`)
- Implements different output formats
- Handles syntax highlighting
- Manages layout and styling

#### Configuration UI (`configurationUI.ts`)
- Visual settings panel
- Live preview functionality
- Preset management
- Settings validation

#### Preview Panel (`previewPanel.ts`)
- Real-time content preview
- Split view management
- Search functionality
- Auto-refresh handling

#### Cache Manager (`cacheManager.ts`)
- File content caching
- Memory management
- Performance optimization
- Progress tracking

#### Tag Manager (`tagManager.ts`)
- Tag creation and management
- Directory inheritance
- Tag visualization
- Tag storage

## Architecture Overview

### Core Concepts
1. **Command Pattern**: All user actions are implemented as commands
2. **Observer Pattern**: Used for real-time updates and event handling
3. **Factory Pattern**: Creates appropriate formatters and analyzers
4. **Singleton Pattern**: Used for managers (cache, tags)

### Data Flow
1. User triggers command
2. Extension processes command
3. Analyzer processes files
4. Formatter generates output
5. UI updates with results

### Performance Considerations
- Use caching for expensive operations
- Implement lazy loading for large files
- Debounce real-time updates
- Monitor memory usage

## Testing Guidelines

### Test Structure
- Unit tests for core functionality
- Integration tests for UI components
- End-to-end tests for workflows
- Performance benchmarks

### Running Tests
```bash
npm test                 # Run all tests
npm run test:unit       # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e        # Run end-to-end tests
```

### Writing Tests
1. Follow the existing test patterns
2. Include setup and teardown
3. Use meaningful test names
4. Add proper assertions
5. Handle async operations correctly

### Performance Testing
- Use the benchmark suite
- Test with varying file sizes
- Measure memory usage
- Compare cold vs. warm cache

## Performance Guidelines

### Optimization Targets
- File analysis: <1000ms
- Cache effectiveness: >50% improvement
- Aggregation: <2000ms
- UI responsiveness: <1500ms load time
- Memory usage: <100MB increase

### Best Practices
1. Use async operations for I/O
2. Implement proper cleanup
3. Monitor memory usage
4. Use progress indicators
5. Cache expensive computations

## Contribution Guidelines

### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Update documentation
6. Submit PR

### Code Style
- Use TypeScript strict mode
- Follow ESLint configuration
- Use meaningful variable names
- Add proper documentation
- Keep functions focused

### Commit Guidelines
- Use conventional commits
- Keep commits focused
- Write meaningful messages
- Reference issues

### Documentation
- Update relevant docs
- Add JSDoc comments
- Include code examples
- Update changelog

### Review Process
1. Automated checks must pass
2. Code review required
3. Documentation review
4. Performance review
5. Final approval

---

## Need Help?
- Join our [Discord server](https://discord.gg/yourdiscord)
- Check existing issues
- Ask questions in discussions
- Read the [FAQ](./FAQ.md) 