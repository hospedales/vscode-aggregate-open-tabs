import { FileMetadata } from './utils';

export interface FormatOptions {
    extraSpacing: boolean;
    enhancedSummaries: boolean;
}

abstract class BaseFormatter {
    protected options: FormatOptions;

    constructor(options: FormatOptions) {
        this.options = options;
    }

    protected getExtraNewlines(): string {
        return this.options.extraSpacing ? '\n' : '';
    }

    abstract generateTableOfContents(files: FileMetadata[]): string;
    abstract generateFileHeader(file: FileMetadata): string;
    abstract generateFileFooter(file: FileMetadata): string;
    abstract wrapContent(content: string): string;
}

export class PlainTextFormatter extends BaseFormatter {
    generateTableOfContents(files: FileMetadata[]): string {
        let toc = '//=============================================================================\n';
        toc += '// TABLE OF CONTENTS\n';
        toc += '//=============================================================================\n\n';
        
        files.forEach((file, index) => {
            const workspace = file.workspace ? ` (${file.workspace})` : '';
            toc += `// ${index + 1}. ${file.relativePath}${workspace}\n`;
            toc += `//    Language: ${file.languageId}, Size: ${file.size} bytes\n`;
            if (file.summary) {
                toc += `//    Summary: ${file.summary}\n`;
            }
            if (this.options.extraSpacing) toc += '\n';
        });
        
        toc += '\n//=============================================================================\n\n';
        return toc;
    }

    generateFileHeader(file: FileMetadata): string {
        const workspace = file.workspace ? ` (${file.workspace})` : '';
        let header = '//=============================================================================\n';
        header += `// File: ${file.relativePath}${workspace}\n`;
        header += `// Language: ${file.languageId}\n`;
        header += `// Size: ${file.size} bytes\n`;
        header += `// Last Modified: ${file.lastModified.toLocaleString()}\n`;
        if (file.summary) {
            header += `// Summary: ${file.summary}\n`;
        }
        header += '//=============================================================================\n\n';
        
        if (file.languageId !== 'plaintext') {
            header += '```' + file.languageId + '\n';
        }
        
        return header;
    }

    generateFileFooter(file: FileMetadata): string {
        let footer = '';
        if (file.languageId !== 'plaintext') {
            footer = '\n```\n';
        }
        footer += '\n//=============================================================================\n\n';
        return footer;
    }

    wrapContent(content: string): string {
        return content;
    }
}

export class MarkdownFormatter extends BaseFormatter {
    generateTableOfContents(files: FileMetadata[]): string {
        let toc = '# Table of Contents\n\n';
        
        files.forEach((file, index) => {
            const workspace = file.workspace ? ` (${file.workspace})` : '';
            toc += `${index + 1}. [${file.relativePath}](#file-${index + 1})${workspace}\n`;
            toc += `   - Language: \`${file.languageId}\`\n`;
            toc += `   - Size: ${file.size} bytes\n`;
            if (file.summary) {
                toc += `   - Summary: ${file.summary}\n`;
            }
            if (this.options.extraSpacing) toc += '\n';
        });
        
        toc += '\n---\n\n';
        return toc;
    }

    generateFileHeader(file: FileMetadata): string {
        const workspace = file.workspace ? ` (${file.workspace})` : '';
        let header = `## ${file.relativePath}${workspace}\n\n`;
        header += `- **Language:** \`${file.languageId}\`\n`;
        header += `- **Size:** ${file.size} bytes\n`;
        header += `- **Last Modified:** ${file.lastModified.toLocaleString()}\n`;
        if (file.summary) {
            header += `- **Summary:** ${file.summary}\n`;
        }
        header += '\n';
        
        header += '```' + file.languageId + '\n';
        return header;
    }

    generateFileFooter(file: FileMetadata): string {
        return '\n```\n\n---\n\n';
    }

    wrapContent(content: string): string {
        return content;
    }
}

export class HtmlFormatter extends BaseFormatter {
    generateTableOfContents(files: FileMetadata[]): string {
        let toc = '<h1>Table of Contents</h1>\n<ol>\n';
        
        files.forEach((file) => {
            const workspace = file.workspace ? ` (${file.workspace})` : '';
            toc += `  <li>\n    <strong>${file.relativePath}</strong>${workspace}\n`;
            toc += `    <ul>\n`;
            toc += `      <li>Language: <code>${file.languageId}</code></li>\n`;
            toc += `      <li>Size: ${file.size} bytes</li>\n`;
            if (file.summary) {
                toc += `      <li>Summary: ${file.summary}</li>\n`;
            }
            toc += `    </ul>\n  </li>\n`;
            if (this.options.extraSpacing) toc += '\n';
        });
        
        toc += '</ol>\n<hr>\n\n';
        return toc;
    }

    generateFileHeader(file: FileMetadata): string {
        const workspace = file.workspace ? ` (${file.workspace})` : '';
        let header = `<h2>${file.relativePath}${workspace}</h2>\n`;
        header += '<ul>\n';
        header += `  <li><strong>Language:</strong> <code>${file.languageId}</code></li>\n`;
        header += `  <li><strong>Size:</strong> ${file.size} bytes</li>\n`;
        header += `  <li><strong>Last Modified:</strong> ${file.lastModified.toLocaleString()}</li>\n`;
        if (file.summary) {
            header += `  <li><strong>Summary:</strong> ${file.summary}</li>\n`;
        }
        header += '</ul>\n\n';
        
        header += '<pre><code class="language-' + file.languageId + '">\n';
        return header;
    }

    generateFileFooter(file: FileMetadata): string {
        return '\n</code></pre>\n\n<hr>\n\n';
    }

    wrapContent(content: string): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Aggregated Code</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; padding: 2rem; max-width: 1200px; margin: 0 auto; }
        pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        code { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }
        hr { margin: 2rem 0; border: 0; border-top: 1px solid #eaecef; }
    </style>
</head>
<body>
${content}
</body>
</html>`;
    }
}

export function createFormatter(format: string, options: FormatOptions): BaseFormatter {
    switch (format) {
        case 'markdown':
            return new MarkdownFormatter(options);
        case 'html':
            return new HtmlFormatter(options);
        default:
            return new PlainTextFormatter(options);
    }
} 