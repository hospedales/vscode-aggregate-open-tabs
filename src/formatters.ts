import * as path from 'path';
import { FileMetadata } from './utils';

export interface FormatOptions {
    extraSpacing: boolean;
    enhancedSummaries: boolean;
    chunkSize: number;
}

abstract class BaseFormatter {
    constructor(protected options: FormatOptions) {}

    protected abstract generateTableOfContents(files: FileMetadata[]): string;
    protected abstract generateFileHeader(metadata: FileMetadata): string;
    protected abstract generateFileFooter(metadata: FileMetadata): string;
    protected abstract wrapContent(content: string, metadata: FileMetadata): string;

    protected getRelativePath(file: FileMetadata): string {
        return file.relativePath || file.fileName;
    }

    protected getLanguageSpecificInfo(metadata: FileMetadata): string {
        const info: string[] = [];
        
        if (metadata.languageId === 'typescriptreact' || metadata.languageId === 'typescript') {
            const hasUseClient = metadata.content.includes('use client');
            info.push(hasUseClient ? 'Client Component' : 'Server Component');
        }

        if (metadata.analysis?.frameworks && metadata.analysis.frameworks.length > 0) {
            info.push(`Frameworks: ${metadata.analysis.frameworks.join(', ')}`);
        }

        return info.join(' | ');
    }

    protected chunkContent(content: string): string[] {
        if (!this.options.chunkSize || this.options.chunkSize <= 0) {
            return [content];
        }

        const lines = content.split('\n');
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        let currentSize = 0;

        for (const line of lines) {
            if (currentSize + line.length > this.options.chunkSize && currentChunk.length > 0) {
                chunks.push(currentChunk.join('\n'));
                currentChunk = [];
                currentSize = 0;
            }
            currentChunk.push(line);
            currentSize += line.length;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join('\n'));
        }

        return chunks;
    }

    async format(files: FileMetadata[]): Promise<string> {
        const toc = this.generateTableOfContents(files);
        const sections: string[] = [];

        for (const file of files) {
            const chunks = this.chunkContent(file.content);
            for (let i = 0; i < chunks.length; i++) {
                const isChunked = chunks.length > 1;
                const chunkMeta = { 
                    ...file,
                    content: chunks[i],
                    chunkInfo: isChunked ? ` (Chunk ${i + 1}/${chunks.length})` : ''
                };

                const section = [
                    this.options.extraSpacing ? '\n' : '',
                    this.generateFileHeader(chunkMeta),
                    this.options.extraSpacing ? '\n' : '',
                    this.wrapContent(chunks[i], chunkMeta),
                    this.options.extraSpacing ? '\n' : '',
                    this.generateFileFooter(chunkMeta),
                    this.options.extraSpacing ? '\n' : ''
                ].join('');

                sections.push(section);
            }
        }

        return [toc, ...sections].join('\n');
    }
}

export class PlainTextFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): string {
        const lines = ['Table of Contents:', '=================='];
        let currentDir = '';
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file);
            const dir = path.dirname(relativePath);
            
            // Start a new directory section if needed
            if (dir !== currentDir) {
                if (dir !== '.') {
                    lines.push(`\n[${dir}]`);
                }
                currentDir = dir;
            }
            
            const indent = dir === '.' ? '' : '  ';
            const langInfo = this.getLanguageSpecificInfo(file);
            const fileName = path.basename(relativePath);
            
            lines.push(`${indent}${fileName}${langInfo ? ` (${langInfo})` : ''}`);
            
            if (this.options.enhancedSummaries && file.analysis) {
                const metadata = [];
                if (file.analysis.purpose) {
                    metadata.push(`Purpose: ${file.analysis.purpose}`);
                }
                if (file.analysis.frameworks?.length) {
                    metadata.push(`Uses: ${file.analysis.frameworks.join(', ')}`);
                }
                if (metadata.length) {
                    lines.push(`${indent}  ${metadata.join(' | ')}`);
                }
                
                if (file.analysis.aiSummary) {
                    lines.push(`${indent}  Summary: ${file.analysis.aiSummary}`);
                }
                if (file.analysis.keyPoints?.length) {
                    lines.push(`${indent}  Key Points:`);
                    file.analysis.keyPoints.forEach(point => {
                        lines.push(`${indent}    • ${point}`);
                    });
                }
            }
        }
        
        return lines.join('\n') + '\n';
    }

    protected generateFileHeader(metadata: FileMetadata): string {
        const relativePath = this.getRelativePath(metadata);
        const langInfo = this.getLanguageSpecificInfo(metadata);
        
        const lines = [
            '//=============================================================================',
            `// File: ${relativePath}${metadata.chunkInfo || ''}`,
            '//=============================================================================',
            '',
            '// File Metadata',
            '// -------------',
            `// Language: ${metadata.languageId}${langInfo ? ` | ${langInfo}` : ''}`,
            `// Size: ${metadata.size} bytes`,
            `// Last Modified: ${metadata.lastModified}`
        ];

        if (metadata.analysis) {
            if (metadata.analysis.purpose) {
                lines.push(`// Purpose: ${metadata.analysis.purpose}`);
            }
            if (metadata.analysis.frameworks?.length) {
                lines.push(`// Frameworks: ${metadata.analysis.frameworks.join(', ')}`);
            }
            if (metadata.analysis.dependencies?.length) {
                lines.push(`// Dependencies: ${metadata.analysis.dependencies.join(', ')}`);
            }
            if (metadata.analysis.imports?.length) {
                lines.push(`// Imports: ${metadata.analysis.imports.join(', ')}`);
            }
            if (metadata.analysis.exports?.length) {
                lines.push(`// Exports: ${metadata.analysis.exports.join(', ')}`);
            }

            if (metadata.analysis.aiSummary || metadata.analysis.keyPoints?.length) {
                lines.push('',
                    '// AI Analysis',
                    '// -----------');
                if (metadata.analysis.aiSummary) {
                    lines.push(`// Summary: ${metadata.analysis.aiSummary}`);
                }
                if (metadata.analysis.keyPoints?.length) {
                    lines.push('// Key Points:');
                    metadata.analysis.keyPoints.forEach(point => {
                        lines.push(`//   • ${point}`);
                    });
                }
            }
        }

        lines.push('',
            '//=============================================================================',
            '');
        
        return lines.join('\n');
    }

    protected generateFileFooter(_metadata: FileMetadata): string {
        return '\n//=============================================================================\n';
    }

    protected wrapContent(content: string, metadata: FileMetadata): string {
        if (!this.options.chunkSize || this.options.chunkSize <= 0) {
            return content;
        }

        const chunks = this.chunkContent(content);
        if (chunks.length <= 1) {
            return content;
        }

        // If content is chunked, add chunk headers
        const lines: string[] = [];
        chunks.forEach((chunk, index) => {
            const start = index * this.options.chunkSize + 1;
            const end = Math.min(start + chunk.split('\n').length - 1, metadata.content.split('\n').length);
            
            lines.push(`//-----------------------------------------------------------------------------`,
                `// Chunk ${index + 1}: Lines ${start}-${end}`,
                `//-----------------------------------------------------------------------------\n`);
            lines.push(chunk);
            if (index < chunks.length - 1) {
                lines.push('\n');
            }
        });

        return lines.join('\n');
    }
}

export class MarkdownFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): string {
        const lines = ['# Table of Contents\n'];
        let currentDir = '';
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file);
            const dir = path.dirname(relativePath);
            
            // Start a new directory section if needed
            if (dir !== currentDir) {
                if (currentDir !== '') {
                    lines.push('</details>\n');
                }
                if (dir !== '.') {
                    lines.push(`<details open><summary>📁 ${dir}/</summary>\n`);
                }
                currentDir = dir;
            }
            
            const indent = dir === '.' ? '' : '  ';
            const fileName = path.basename(relativePath);
            const fileLink = `${indent}- [${fileName}](#${this.slugify(relativePath)})`;
            
            const metadata = [];
            if (file.analysis?.purpose) {
                metadata.push(file.analysis.purpose);
            }
            if (file.analysis?.frameworks?.length) {
                metadata.push(`Uses: ${file.analysis.frameworks.join(', ')}`);
            }
            
            lines.push(metadata.length ? `${fileLink} *(${metadata.join(' | ')})* ` : fileLink);
            
            if (this.options.enhancedSummaries && file.analysis) {
                if (file.analysis.aiSummary) {
                    lines.push(`${indent}  - ${file.analysis.aiSummary}`);
                }
                if (file.analysis.keyPoints?.length) {
                    lines.push(`${indent}  <details><summary>Key Points</summary>\n`);
                    file.analysis.keyPoints.forEach(point => {
                        lines.push(`${indent}    - ${point}`);
                    });
                    lines.push(`${indent}  </details>`);
                }
            }
        }
        
        // Close the last directory section if needed
        if (currentDir !== '.') {
            lines.push('</details>\n');
        }
        
        return lines.join('\n');
    }

    protected slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    protected generateFileHeader(metadata: FileMetadata): string {
        const relativePath = this.getRelativePath(metadata);
        const langInfo = this.getLanguageSpecificInfo(metadata);
        
        const lines = [
            `## ${relativePath}${metadata.chunkInfo || ''}`,
            ''
        ];

        // Add metadata in a collapsible section
        lines.push('<details><summary>File Metadata</summary>\n');
        lines.push('| Property | Value |');
        lines.push('|----------|--------|');
        lines.push(`| Language | ${metadata.languageId}${langInfo ? ` (${langInfo})` : ''} |`);
        lines.push(`| Size | ${metadata.size} bytes |`);
        lines.push(`| Last Modified | ${metadata.lastModified} |`);

        if (metadata.analysis) {
            if (metadata.analysis.purpose) {
                lines.push(`| Purpose | ${metadata.analysis.purpose} |`);
            }
            if (metadata.analysis.frameworks?.length) {
                lines.push(`| Frameworks | ${metadata.analysis.frameworks.join(', ')} |`);
            }
            if (metadata.analysis.dependencies?.length) {
                lines.push(`| Dependencies | ${metadata.analysis.dependencies.join(', ')} |`);
            }
            if (metadata.analysis.imports?.length) {
                lines.push(`| Imports | ${metadata.analysis.imports.join(', ')} |`);
            }
            if (metadata.analysis.exports?.length) {
                lines.push(`| Exports | ${metadata.analysis.exports.join(', ')} |`);
            }
        }
        lines.push('\n</details>\n');

        // Add AI summary and key points if available
        if (metadata.analysis?.aiSummary || metadata.analysis?.keyPoints?.length) {
            lines.push('<details><summary>AI Analysis</summary>\n');
            if (metadata.analysis.aiSummary) {
                lines.push(`**Summary**: ${metadata.analysis.aiSummary}\n`);
            }
            if (metadata.analysis.keyPoints?.length) {
                lines.push('**Key Points**:');
                metadata.analysis.keyPoints.forEach(point => {
                    lines.push(`- ${point}`);
                });
            }
            lines.push('\n</details>\n');
        }

        // Add code block header
        lines.push(`\`\`\`${metadata.languageId}`);
        
        return lines.join('\n');
    }

    protected generateFileFooter(_metadata: FileMetadata): string {
        return '```\n';
    }

    protected wrapContent(content: string, metadata: FileMetadata): string {
        if (!this.options.chunkSize || this.options.chunkSize <= 0) {
            return content;
        }

        const chunks = this.chunkContent(content);
        if (chunks.length <= 1) {
            return content;
        }

        // If content is chunked, wrap each chunk in a collapsible section
        const lines: string[] = [];
        chunks.forEach((chunk, index) => {
            const start = index * this.options.chunkSize + 1;
            const end = Math.min(start + chunk.split('\n').length - 1, metadata.content.split('\n').length);
            
            lines.push(`<details${index === 0 ? ' open' : ''}><summary>Chunk ${index + 1}: Lines ${start}-${end}</summary>\n`);
            lines.push(`\`\`\`${metadata.languageId}`);
            lines.push(chunk);
            lines.push('```\n</details>\n');
        });

        return lines.join('\n');
    }
}

export class HtmlFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): string {
        const lines = ['<h1>Table of Contents</h1>', '<ul>'];
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file);
            const langInfo = this.getLanguageSpecificInfo(file);
            lines.push(`<li><code>${relativePath}</code>${langInfo ? ` (${langInfo})` : ''}`);
            
            if (this.options.enhancedSummaries && file.analysis?.purpose) {
                lines.push('<ul>');
                lines.push(`<li>Purpose: ${file.analysis.purpose}</li>`);
                if (file.analysis.exports.length > 0) {
                    lines.push(`<li>Exports: ${file.analysis.exports.join(', ')}</li>`);
                }
                lines.push('</ul>');
            }
            
            lines.push('</li>');
        }
        
        lines.push('</ul>');
        return lines.join('\n') + '\n';
    }

    protected generateFileHeader(metadata: FileMetadata): string {
        const relativePath = this.getRelativePath(metadata);
        const langInfo = this.getLanguageSpecificInfo(metadata);
        
        return [
            `<h2>${relativePath}${metadata.chunkInfo || ''}</h2>`,
            '<table>',
            '<tr><th>Property</th><th>Value</th></tr>',
            `<tr><td>Language</td><td>${metadata.languageId}${langInfo ? ` (${langInfo})` : ''}</td></tr>`,
            `<tr><td>Size</td><td>${metadata.size} bytes</td></tr>`,
            `<tr><td>Last Modified</td><td>${metadata.lastModified}</td></tr>`,
            metadata.analysis?.purpose ? `<tr><td>Purpose</td><td>${metadata.analysis.purpose}</td></tr>` : '',
            '</table>\n'
        ].filter(Boolean).join('\n');
    }

    protected generateFileFooter(_metadata: FileMetadata): string {
        return '\n<hr>\n';
    }

    protected wrapContent(content: string, metadata: FileMetadata): string {
        return `<pre><code class="language-${metadata.languageId}">${this.escapeHtml(content)}</code></pre>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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