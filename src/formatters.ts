import * as vscode from 'vscode';
import * as path from 'path';
import { FileMetadata } from './utils';
import { analyzeFile } from './analyzer';

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

    protected getRelativePath(filePath: string): string {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return workspaceRoot ? path.relative(workspaceRoot, filePath) : filePath;
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
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file.fileName);
            const langInfo = this.getLanguageSpecificInfo(file);
            lines.push(`${relativePath}${langInfo ? ` (${langInfo})` : ''}`);
            
            if (this.options.enhancedSummaries && file.analysis?.purpose) {
                lines.push(`  Purpose: ${file.analysis.purpose}`);
                if (file.analysis.exports.length > 0) {
                    lines.push(`  Exports: ${file.analysis.exports.join(', ')}`);
                }
            }
        }

        return lines.join('\n') + '\n';
    }

    protected generateFileHeader(metadata: FileMetadata): string {
        const relativePath = this.getRelativePath(metadata.fileName);
        const langInfo = this.getLanguageSpecificInfo(metadata);
        
        return [
            '//=============================================================================',
            `// File: ${relativePath}${metadata.chunkInfo || ''}`,
            `// Language: ${metadata.languageId}${langInfo ? ` | ${langInfo}` : ''}`,
            `// Size: ${metadata.size} bytes | Last Modified: ${metadata.lastModified}`,
            metadata.analysis?.purpose ? `// Purpose: ${metadata.analysis.purpose}` : '',
            '//=============================================================================\n'
        ].filter(Boolean).join('\n');
    }

    protected generateFileFooter(metadata: FileMetadata): string {
        return '\n//=============================================================================\n';
    }

    protected wrapContent(content: string, metadata: FileMetadata): string {
        return content;
    }
}

export class MarkdownFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): string {
        const lines = ['# Table of Contents\n'];
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file.fileName);
            const langInfo = this.getLanguageSpecificInfo(file);
            lines.push(`- \`${relativePath}\`${langInfo ? ` (${langInfo})` : ''}`);
            
            if (this.options.enhancedSummaries && file.analysis?.purpose) {
                lines.push(`  - Purpose: ${file.analysis.purpose}`);
                if (file.analysis.exports.length > 0) {
                    lines.push(`  - Exports: ${file.analysis.exports.join(', ')}`);
                }
            }
        }

        return lines.join('\n') + '\n';
    }

    protected generateFileHeader(metadata: FileMetadata): string {
        const relativePath = this.getRelativePath(metadata.fileName);
        const langInfo = this.getLanguageSpecificInfo(metadata);
        
        return [
            `## ${relativePath}${metadata.chunkInfo || ''}`,
            '',
            '| Property | Value |',
            '|----------|--------|',
            `| Language | ${metadata.languageId}${langInfo ? ` (${langInfo})` : ''} |`,
            `| Size | ${metadata.size} bytes |`,
            `| Last Modified | ${metadata.lastModified} |`,
            metadata.analysis?.purpose ? `| Purpose | ${metadata.analysis.purpose} |` : '',
            '\n'
        ].filter(Boolean).join('\n');
    }

    protected generateFileFooter(metadata: FileMetadata): string {
        return '\n---\n';
    }

    protected wrapContent(content: string, metadata: FileMetadata): string {
        return `\`\`\`${metadata.languageId}\n${content}\n\`\`\``;
    }
}

export class HtmlFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): string {
        const lines = ['<h1>Table of Contents</h1>', '<ul>'];
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file.fileName);
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
        const relativePath = this.getRelativePath(metadata.fileName);
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

    protected generateFileFooter(metadata: FileMetadata): string {
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