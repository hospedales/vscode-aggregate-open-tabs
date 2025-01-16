import * as path from 'path';
import { FileMetadata } from './utils';

export interface FormatOptions {
    extraSpacing?: boolean;
    enhancedSummaries?: boolean;
    chunkSize?: number;
    chunkSeparatorStyle?: 'double' | 'single' | 'minimal';
    codeFenceLanguageMap?: Record<string, string>;
    tailoredSummaries?: boolean;
    includeKeyPoints?: boolean;
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    includeCrossReferences?: boolean;
    includeTags?: boolean;
    aiSummaryStyle?: 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive';
    useCodeFences?: boolean;
}

interface FormatterOptions {
    extraSpacing?: boolean;
    enhancedSummaries?: boolean;
    chunkSize?: number;
    chunkSeparatorStyle?: 'double' | 'single' | 'minimal';
    codeFenceLanguageMap?: Record<string, string>;
    tailoredSummaries?: boolean;
    includeKeyPoints?: boolean;
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    includeCrossReferences?: boolean;
    includeTags?: boolean;
    aiSummaryStyle?: 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive';
    useCodeFences?: boolean;
}

export abstract class BaseFormatter {
    protected options: FormatterOptions;
    private memoizedChunks: Map<string, string[]> = new Map();
    private static CHUNK_WORKERS = 4;

    constructor(options: FormatOptions = {}) {
        this.options = {
            extraSpacing: options.extraSpacing ?? true,
            enhancedSummaries: options.enhancedSummaries ?? true,
            chunkSize: options.chunkSize ?? 2000,
            chunkSeparatorStyle: options.chunkSeparatorStyle ?? 'double',
            codeFenceLanguageMap: options.codeFenceLanguageMap ?? {},
            tailoredSummaries: options.tailoredSummaries ?? true,
            includeKeyPoints: options.includeKeyPoints ?? true,
            includeImports: options.includeImports ?? true,
            includeExports: options.includeExports ?? true,
            includeDependencies: options.includeDependencies ?? true,
            includeCrossReferences: options.includeCrossReferences ?? true,
            includeTags: options.includeTags ?? true,
            aiSummaryStyle: options.aiSummaryStyle ?? 'standard',
            useCodeFences: options.useCodeFences ?? true
        };
    }

    protected abstract generateTableOfContents(files: FileMetadata[]): Promise<string>;
    protected abstract generateFileHeader(metadata: FileMetadata): Promise<string>;
    protected abstract generateFileFooter(metadata: FileMetadata): Promise<string>;
    protected abstract wrapContent(content: string, metadata: FileMetadata): Promise<string>;

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

    protected async chunkContent(content: string, fileName: string): Promise<string[]> {
        // Return memoized chunks if available
        const cacheKey = `${fileName}-${content.length}-${this.options.chunkSize}`;
        if (this.memoizedChunks.has(cacheKey)) {
            return this.memoizedChunks.get(cacheKey)!;
        }

        if (!this.options.chunkSize || content.length < this.options.chunkSize) {
            const chunks = [content];
            this.memoizedChunks.set(cacheKey, chunks);
            return chunks;
        }

        // Process chunks in parallel for large files
        const lines = content.split('\n');
        const chunkCount = Math.ceil(lines.length / this.options.chunkSize);
        const workerCount = Math.min(BaseFormatter.CHUNK_WORKERS, chunkCount);
        const chunksPerWorker = Math.ceil(chunkCount / workerCount);

        const chunkPromises = Array.from({ length: workerCount }, async (_, workerIndex) => {
            const start = workerIndex * chunksPerWorker * this.options.chunkSize!;
            const end = Math.min(start + chunksPerWorker * this.options.chunkSize!, lines.length);
            const workerChunks: string[] = [];

            for (let i = start; i < end; i += this.options.chunkSize!) {
                const chunkEnd = Math.min(i + this.options.chunkSize!, end);
                const chunk = lines.slice(i, chunkEnd).join('\n');
                if (chunk.trim()) {
                    workerChunks.push(chunk);
                }
            }

            return workerChunks;
        });

        const chunks = (await Promise.all(chunkPromises)).flat();
        this.memoizedChunks.set(cacheKey, chunks);
        return chunks;
    }

    protected getSeparator(style: 'double' | 'single' | 'minimal' = 'double'): string {
        switch (style) {
            case 'double':
                return '=============================================================================';
            case 'single':
                return '-----------------------------------------------------------------------------';
            case 'minimal':
                return '------------------';
            default:
                return '=============================================================================';
        }
    }

    protected getChunkSeparator(style: 'double' | 'single' | 'minimal' = 'double'): string {
        switch (style) {
            case 'double':
                return '-----------------------------------------------------------------------------';
            case 'single':
                return '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -';
            case 'minimal':
                return '------------------';
            default:
                return '-----------------------------------------------------------------------------';
        }
    }

    protected getLanguageIdentifier(languageId: string): string {
        if (this.options.codeFenceLanguageMap && languageId in this.options.codeFenceLanguageMap) {
            return this.options.codeFenceLanguageMap[languageId];
        }

        // Default mappings if no custom map is provided
        const defaultMap: Record<string, string> = {
            'typescriptreact': 'tsx',
            'javascriptreact': 'jsx',
            'typescript': 'ts',
            'javascript': 'js',
            'markdown': 'md',
            'mdx': 'mdx',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'html': 'html',
            'json': 'json',
            'yaml': 'yaml',
            'python': 'python',
            'rust': 'rust',
            'go': 'go',
            'plaintext': 'text'
        };

        return defaultMap[languageId] || languageId;
    }

    async format(files: FileMetadata[]): Promise<string> {
        const toc = await this.generateTableOfContents(files);
        const sections: string[] = [];

        for (const file of files) {
            const fileChunks = await this.chunkContent(file.content, file.fileName);
            
            for (let i = 0; i < fileChunks.length; i++) {
                const isChunked = fileChunks.length > 1;
                const chunkMeta = { 
                    ...file,
                    content: fileChunks[i],
                    chunkInfo: isChunked ? ` (Chunk ${i + 1}/${fileChunks.length})` : ''
                };

                const section = [
                    this.options.extraSpacing ? '\n\n' : '\n',
                    await this.generateFileHeader(chunkMeta),
                    this.options.extraSpacing ? '\n\n' : '\n',
                    await this.wrapContent(fileChunks[i], chunkMeta),
                    this.options.extraSpacing ? '\n\n' : '\n',
                    await this.generateFileFooter(chunkMeta),
                    this.options.extraSpacing ? '\n\n' : '\n'
                ].join('');

                sections.push(section);
            }
        }

        return [toc, ...sections].join('\n');
    }

    protected clearCache() {
        this.memoizedChunks.clear();
    }
}

export class PlainTextFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): Promise<string> {
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
        
        return Promise.resolve(lines.join('\n') + '\n');
    }

    protected generateFileHeader(metadata: FileMetadata): Promise<string> {
        const lines: string[] = [];
        const relativePath = this.getRelativePath(metadata);

        // File header with path and language
        lines.push(
            `File: ${relativePath}`,
            `Language: ${metadata.languageId}`,
            ''
        );

        // Add metadata if available
        if (metadata.analysis) {
            if (metadata.analysis.purpose) {
                lines.push(`Purpose: ${metadata.analysis.purpose}`);
            }

            // Add frameworks based on summary depth
            if (metadata.analysis.frameworks?.length && this.options.aiSummaryStyle !== 'minimal') {
                lines.push(`Frameworks: ${metadata.analysis.frameworks.join(', ')}`);
            }

            // Add dependencies based on summary depth
            if (this.options.includeDependencies && metadata.analysis.dependencies?.length && 
                this.options.aiSummaryStyle !== 'minimal' && this.options.aiSummaryStyle !== 'basic') {
                lines.push(`Dependencies: ${metadata.analysis.dependencies.join(', ')}`);
            }

            // Add imports based on summary depth
            if (this.options.includeImports && metadata.analysis.imports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`Imports: ${metadata.analysis.imports.join(', ')}`);
            }

            // Add exports based on summary depth
            if (this.options.includeExports && metadata.analysis.exports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`Exports: ${metadata.analysis.exports.join(', ')}`);
            }

            // Add AI summary and key points with depth-based formatting
            if (metadata.analysis.aiSummary || metadata.analysis.keyPoints?.length) {
                lines.push('',
                    'AI Analysis',
                    '-----------');
                
                if (metadata.analysis.aiSummary) {
                    lines.push(`Summary: ${metadata.analysis.aiSummary}`);
                }

                if (metadata.analysis.keyPoints?.length && this.options.aiSummaryStyle !== 'minimal') {
                    lines.push('Key Points:');
                    
                    // Format key points based on depth
                    const keyPoints = metadata.analysis.keyPoints;
                    const maxPoints = this.options.aiSummaryStyle === 'basic' ? 2 :
                                    this.options.aiSummaryStyle === 'standard' ? 5 :
                                    this.options.aiSummaryStyle === 'detailed' ? 10 :
                                    keyPoints.length; // comprehensive shows all

                    keyPoints.slice(0, maxPoints).forEach(point => {
                        if (this.options.aiSummaryStyle === 'comprehensive') {
                            // Add extra detail level for comprehensive
                            const subPoints = point.split(' - ');
                            lines.push(`  • ${subPoints[0]}`);
                            if (subPoints.length > 1) {
                                subPoints.slice(1).forEach(sub => {
                                    lines.push(`    - ${sub}`);
                                });
                            }
                        } else {
                            lines.push(`  • ${point}`);
                        }
                    });
                }
            }

            // Add cross-references if available and requested
            if (this.options.includeCrossReferences && metadata.analysis.crossReferences &&
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                const { references, referencedBy } = metadata.analysis.crossReferences;
                
                if (references.length > 0 || referencedBy.length > 0) {
                    lines.push('',
                        'Cross References',
                        '---------------');
                    
                    if (references.length > 0) {
                        lines.push('References:');
                        references.forEach(ref => {
                            const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                            lines.push(`  → ${ref.targetFile}${symbol} - Line ${ref.location.line + 1}`);
                            if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                                lines.push(`    Context: ${ref.context}`);
                            }
                        });
                    }
                    
                    if (referencedBy.length > 0) {
                        if (references.length > 0) lines.push('');
                        lines.push('Referenced By:');
                        referencedBy.forEach(ref => {
                            const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                            lines.push(`  ← ${ref.sourceFile}${symbol} - Line ${ref.location.line + 1}`);
                            if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                                lines.push(`    Context: ${ref.context}`);
                            }
                        });
                    }
                }
            }
        }

        // Add extra spacing if enabled
        if (this.options.extraSpacing) {
            lines.push('');
        }

        return Promise.resolve(lines.join('\n'));
    }

    protected generateFileFooter(_metadata: FileMetadata): Promise<string> {
        const separator = this.getSeparator(this.options.chunkSeparatorStyle);
        return Promise.resolve(`\n//${separator}\n\n`);
    }

    protected wrapContent(content: string, metadata: FileMetadata): Promise<string> {
        if (!this.options.chunkSize || this.options.chunkSize <= 0) {
            if (this.options.useCodeFences) {
                const langId = this.getLanguageIdentifier(metadata.languageId);
                return Promise.resolve(`${this.options.extraSpacing ? '\n' : ''}\`\`\`${langId}\n${content}\n\`\`\`${this.options.extraSpacing ? '\n' : ''}`);
            }
            return Promise.resolve(content);
        }

        // Process chunks asynchronously but handle the promise synchronously
        const processChunks = async () => {
            const chunks = await this.chunkContent(content, metadata.fileName);
            if (chunks.length <= 1) {
                if (this.options.useCodeFences) {
                    const langId = this.getLanguageIdentifier(metadata.languageId);
                    return `${this.options.extraSpacing ? '\n' : ''}\`\`\`${langId}\n${content}\n\`\`\`${this.options.extraSpacing ? '\n' : ''}`;
                }
                return content;
            }

            // If content is chunked, add chunk headers with improved spacing
            const lines: string[] = [];
            const chunkSeparator = this.getChunkSeparator(this.options.chunkSeparatorStyle);
            const langId = this.options.useCodeFences ? this.getLanguageIdentifier(metadata.languageId) : null;
            
            for (let index = 0; index < chunks.length; index++) {
                const chunk = chunks[index];
                const start = index * this.options.chunkSize! + 1;
                const end = Math.min(start + chunk.split('\n').length - 1, metadata.content.split('\n').length);
                
                if (index > 0 && this.options.extraSpacing) {
                    lines.push('');
                }
                
                lines.push(`//${chunkSeparator}`,
                    `// Chunk ${index + 1}: Lines ${start}-${end}`,
                    `//${chunkSeparator}`);
                
                if (this.options.extraSpacing) {
                    lines.push('');
                }
                
                if (this.options.useCodeFences) {
                    lines.push(`\`\`\`${langId}`);
                }
                lines.push(chunk);
                if (this.options.useCodeFences) {
                    lines.push('```');
                }
                if (index < chunks.length - 1) {
                    lines.push(this.options.extraSpacing ? '\n\n' : '\n');
                }
            }

            return lines.join('\n');
        };

        // Execute the async function synchronously
        let result = '';
        processChunks().then(processed => {
            result = processed;
        }).catch(error => {
            console.error('Error processing chunks:', error);
            result = content; // Fallback to original content on error
        });

        return Promise.resolve(result || content); // Return original content if async processing hasn't completed
    }
}

export class MarkdownFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): Promise<string> {
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
                    // Add directory tags if any
                    const dirTags = file.analysis?.tags?.filter(t => t.scope === 'directory');
                    const tagStr = dirTags?.length 
                        ? ` *(${dirTags.map(t => t.name).join(', ')})*`
                        : '';
                    lines.push(`<details open><summary>📁 ${dir}/${tagStr}</summary>\n`);
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
            if (this.options.includeTags && file.analysis?.tags?.length) {
                const fileTags = file.analysis.tags.filter(t => t.scope !== 'directory');
                if (fileTags.length) {
                    metadata.push(`Tags: ${fileTags.map(t => t.name).join(', ')}`);
                }
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
        
        return Promise.resolve(lines.join('\n'));
    }

    protected slugify(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    protected generateFileHeader(metadata: FileMetadata): Promise<string> {
        const lines: string[] = [];
        const relativePath = this.getRelativePath(metadata);

        // File header with path and language
        lines.push(
            `## ${path.basename(relativePath)} {${path.dirname(relativePath)}}`,
            '',
            '<details>',
            '<summary>File Metadata</summary>',
            '',
            '| Property | Value |',
            '|----------|--------|',
            `| Path | \`${relativePath}\` |`,
            `| Language | ${metadata.languageId} |`,
            `| Size | ${metadata.size} bytes |`,
            `| Last Modified | ${metadata.lastModified} |`
        );

        // Add metadata if available
        if (metadata.analysis) {
            if (metadata.analysis.purpose) {
                lines.push(`| Purpose | ${metadata.analysis.purpose} |`);
            }

            // Add frameworks based on summary depth
            if (metadata.analysis.frameworks?.length && this.options.aiSummaryStyle !== 'minimal') {
                lines.push(`| Frameworks | ${metadata.analysis.frameworks.join(', ')} |`);
            }

            // Add dependencies based on summary depth
            if (this.options.includeDependencies && metadata.analysis.dependencies?.length && 
                this.options.aiSummaryStyle !== 'minimal' && this.options.aiSummaryStyle !== 'basic') {
                lines.push(`| Dependencies | ${metadata.analysis.dependencies.join(', ')} |`);
            }

            // Add imports based on summary depth
            if (this.options.includeImports && metadata.analysis.imports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`| Imports | ${metadata.analysis.imports.join(', ')} |`);
            }

            // Add exports based on summary depth
            if (this.options.includeExports && metadata.analysis.exports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`| Exports | ${metadata.analysis.exports.join(', ')} |`);
            }
        }
        lines.push('\n</details>');

        // Add extra spacing after metadata section if enabled
        if (this.options.extraSpacing) {
            lines.push('');
        }

        // Add AI summary and key points with depth-based formatting
        if (metadata.analysis?.aiSummary || metadata.analysis?.keyPoints?.length) {
            lines.push('<details><summary>AI Analysis</summary>\n');
            
            if (metadata.analysis.aiSummary) {
                lines.push(`**Summary**: ${metadata.analysis.aiSummary}\n`);
            }

            if (metadata.analysis.keyPoints?.length && this.options.aiSummaryStyle !== 'minimal') {
                lines.push('**Key Points**:');
                
                // Format key points based on depth
                const keyPoints = metadata.analysis.keyPoints;
                const maxPoints = this.options.aiSummaryStyle === 'basic' ? 2 :
                                this.options.aiSummaryStyle === 'standard' ? 5 :
                                this.options.aiSummaryStyle === 'detailed' ? 10 :
                                keyPoints.length; // comprehensive shows all

                keyPoints.slice(0, maxPoints).forEach(point => {
                    if (this.options.aiSummaryStyle === 'comprehensive') {
                        // Add extra detail level for comprehensive
                        const subPoints = point.split(' - ');
                        lines.push(`- ${subPoints[0]}`);
                        if (subPoints.length > 1) {
                            subPoints.slice(1).forEach(sub => {
                                lines.push(`  - ${sub}`);
                            });
                        }
                    } else {
                        lines.push(`- ${point}`);
                    }
                });
            }
            lines.push('\n</details>');

            // Add extra spacing after AI analysis if enabled
            if (this.options.extraSpacing) {
                lines.push('');
            }
        }

        // Add cross-references if available and requested
        if (this.options.includeCrossReferences && metadata.analysis?.crossReferences &&
            (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
            const { references, referencedBy } = metadata.analysis.crossReferences;
            
            if (references.length > 0 || referencedBy.length > 0) {
                lines.push('<details><summary>Cross References</summary>\n');
                
                if (references.length > 0) {
                    lines.push('**References:**');
                    references.forEach(ref => {
                        const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                        lines.push(`- → \`${ref.targetFile}\`${symbol} - Line ${ref.location.line + 1}`);
                        if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                            lines.push(`  - Context: ${ref.context}`);
                        }
                    });
                }
                
                if (referencedBy.length > 0) {
                    if (references.length > 0) lines.push('');
                    lines.push('**Referenced By:**');
                    referencedBy.forEach(ref => {
                        const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                        lines.push(`- ← \`${ref.sourceFile}\`${symbol} - Line ${ref.location.line + 1}`);
                        if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                            lines.push(`  - Context: ${ref.context}`);
                        }
                    });
                }
                lines.push('\n</details>');

                // Add extra spacing after cross references if enabled
                if (this.options.extraSpacing) {
                    lines.push('');
                }
            }
        }

        // Add code block header with proper language identifier
        const langId = this.getLanguageIdentifier(metadata.languageId);
        lines.push(`\`\`\`${langId}`);
        
        return Promise.resolve(lines.join('\n'));
    }

    protected generateFileFooter(_metadata: FileMetadata): Promise<string> {
        return Promise.resolve('```\n');
    }

    protected wrapContent(content: string, metadata: FileMetadata): Promise<string> {
        if (!this.options.chunkSize || this.options.chunkSize <= 0) {
            return Promise.resolve(content);
        }

        // Process chunks asynchronously but handle the promise synchronously
        const processChunks = async () => {
            const chunks = await this.chunkContent(content, metadata.fileName);
            if (chunks.length <= 1) {
                return content;
            }

            // If content is chunked, wrap each chunk in a collapsible section with proper code fencing
            const lines: string[] = [];
            for (let index = 0; index < chunks.length; index++) {
                const chunk = chunks[index];
                const start = index * this.options.chunkSize! + 1;
                const end = Math.min(start + chunk.split('\n').length - 1, metadata.content.split('\n').length);
                
                if (index > 0 && this.options.extraSpacing) {
                    lines.push('');  // Add extra spacing between chunks
                }
                
                lines.push(`<details${index === 0 ? ' open' : ''}><summary>Chunk ${index + 1}: Lines ${start}-${end}</summary>`);
                
                if (this.options.extraSpacing) {
                    lines.push('');  // Add extra spacing before code block
                }
                
                const langId = this.getLanguageIdentifier(metadata.languageId);
                lines.push(`\`\`\`${langId}`);
                lines.push(chunk);
                lines.push('```');
                
                if (this.options.extraSpacing) {
                    lines.push('');  // Add extra spacing before closing details
                }
                
                lines.push('</details>');
                
                if (index < chunks.length - 1) {
                    lines.push(this.options.extraSpacing ? '\n' : '');  // Add extra spacing between chunks
                }
            }

            return lines.join('\n');
        };

        // Execute the async function synchronously
        let result = '';
        processChunks().then(processed => {
            result = processed;
        }).catch(error => {
            console.error('Error processing chunks:', error);
            result = content; // Fallback to original content on error
        });

        return Promise.resolve(result || content); // Return original content if async processing hasn't completed
    }
}

export class HtmlFormatter extends BaseFormatter {
    protected generateTableOfContents(files: FileMetadata[]): Promise<string> {
        const lines = ['<h1>Table of Contents</h1>', '<div class="toc">'];
        let currentDir = '';
        
        for (const file of files) {
            const relativePath = this.getRelativePath(file);
            const dir = path.dirname(relativePath);
            
            // Start a new directory section if needed
            if (dir !== currentDir) {
                if (currentDir !== '') {
                    lines.push('</div>'); // Close previous directory
                }
                if (dir !== '.') {
                    lines.push(`<div class="directory"><h3>📁 ${dir}/</h3>`);
                }
                currentDir = dir;
            }
            
            const fileName = path.basename(relativePath);
            const langInfo = this.getLanguageSpecificInfo(file);
            
            lines.push('<div class="file-entry">');
            lines.push(`<code>${fileName}</code>${langInfo ? ` <span class="lang-info">(${langInfo})</span>` : ''}`);
            
            if (this.options.enhancedSummaries && file.analysis) {
                if (file.analysis.purpose || file.analysis.frameworks?.length) {
                    lines.push('<div class="file-meta">');
                    if (file.analysis.purpose) {
                        lines.push(`<div class="purpose">${file.analysis.purpose}</div>`);
                    }
                    if (file.analysis.frameworks?.length) {
                        lines.push(`<div class="frameworks">Uses: ${file.analysis.frameworks.join(', ')}</div>`);
                    }
                    lines.push('</div>');
                }
                
                if (file.analysis.aiSummary) {
                    lines.push(`<div class="ai-summary">${file.analysis.aiSummary}</div>`);
                }
                
                if (file.analysis.keyPoints?.length) {
                    lines.push('<details class="key-points">');
                    lines.push('<summary>Key Points</summary>');
                    lines.push('<ul>');
                    file.analysis.keyPoints.forEach(point => {
                        lines.push(`<li>${point}</li>`);
                    });
                    lines.push('</ul>');
                    lines.push('</details>');
                }
            }
            
            lines.push('</div>');
        }
        
        // Close any open directory
        if (currentDir !== '.') {
            lines.push('</div>');
        }
        
        lines.push('</div>'); // Close toc
        
        // Add CSS styles
        lines.push('<style>');
        lines.push('.toc { margin: 1em 0; }');
        lines.push('.directory { margin: 1em 0; padding-left: 1em; }');
        lines.push('.file-entry { margin: 0.5em 0; padding-left: 1em; }');
        lines.push('.lang-info { color: #666; font-size: 0.9em; }');
        lines.push('.file-meta { margin: 0.3em 0; color: #444; font-size: 0.9em; }');
        lines.push('.purpose { font-style: italic; }');
        lines.push('.frameworks { color: #0066cc; }');
        lines.push('.ai-summary { margin: 0.3em 0; color: #555; }');
        lines.push('.key-points { margin: 0.5em 0; }');
        lines.push('.key-points summary { cursor: pointer; color: #333; }');
        lines.push('.key-points ul { margin: 0.5em 0; padding-left: 2em; }');
        lines.push('</style>');
        
        return Promise.resolve(lines.join('\n') + '\n');
    }

    protected generateFileHeader(metadata: FileMetadata): Promise<string> {
        const lines: string[] = [];
        const relativePath = this.getRelativePath(metadata);

        // File header with path and language
        lines.push(
            `<div class="file-section${this.options.extraSpacing ? ' extra-spacing' : ''}">`,
            `<h2>${path.basename(relativePath)} <span class="file-path">${path.dirname(relativePath)}</span></h2>`,
            '<div class="file-metadata">',
            '<details>',
            '<summary>File Metadata</summary>',
            '<table>',
            '<tr><th>Property</th><th>Value</th></tr>',
            `<tr><td>Path</td><td><code>${relativePath}</code></td></tr>`,
            `<tr><td>Language</td><td>${metadata.languageId}</td></tr>`,
            `<tr><td>Size</td><td>${metadata.size} bytes</td></tr>`,
            `<tr><td>Last Modified</td><td>${metadata.lastModified}</td></tr>`
        );

        // Add metadata if available
        if (metadata.analysis) {
            if (metadata.analysis.purpose) {
                lines.push(`<tr><td>Purpose</td><td>${metadata.analysis.purpose}</td></tr>`);
            }

            // Add frameworks based on summary depth
            if (metadata.analysis.frameworks?.length && this.options.aiSummaryStyle !== 'minimal') {
                lines.push(`<tr><td>Frameworks</td><td>${metadata.analysis.frameworks.join(', ')}</td></tr>`);
            }

            // Add dependencies based on summary depth
            if (this.options.includeDependencies && metadata.analysis.dependencies?.length && 
                this.options.aiSummaryStyle !== 'minimal' && this.options.aiSummaryStyle !== 'basic') {
                lines.push(`<tr><td>Dependencies</td><td>${metadata.analysis.dependencies.join(', ')}</td></tr>`);
            }

            // Add imports based on summary depth
            if (this.options.includeImports && metadata.analysis.imports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`<tr><td>Imports</td><td>${metadata.analysis.imports.join(', ')}</td></tr>`);
            }

            // Add exports based on summary depth
            if (this.options.includeExports && metadata.analysis.exports?.length && 
                (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
                lines.push(`<tr><td>Exports</td><td>${metadata.analysis.exports.join(', ')}</td></tr>`);
            }
        }
        lines.push('</table>');
        lines.push('</details>');
        lines.push('</div>'); // Close file-metadata

        // Add AI summary and key points with depth-based formatting
        if (metadata.analysis?.aiSummary || metadata.analysis?.keyPoints?.length) {
            lines.push('<details class="ai-analysis">');
            lines.push('<summary>AI Analysis</summary>');
            lines.push('<div class="analysis-content">');
            
            if (metadata.analysis.aiSummary) {
                lines.push(`<div class="ai-summary"><strong>Summary:</strong> ${metadata.analysis.aiSummary}</div>`);
            }

            if (metadata.analysis.keyPoints?.length && this.options.aiSummaryStyle !== 'minimal') {
                lines.push('<div class="key-points">');
                lines.push('<strong>Key Points:</strong>');
                lines.push('<ul>');
                
                // Format key points based on depth
                const keyPoints = metadata.analysis.keyPoints;
                const maxPoints = this.options.aiSummaryStyle === 'basic' ? 2 :
                                this.options.aiSummaryStyle === 'standard' ? 5 :
                                this.options.aiSummaryStyle === 'detailed' ? 10 :
                                keyPoints.length; // comprehensive shows all

                keyPoints.slice(0, maxPoints).forEach(point => {
                    if (this.options.aiSummaryStyle === 'comprehensive') {
                        // Add extra detail level for comprehensive
                        const subPoints = point.split(' - ');
                        lines.push(`<li>${subPoints[0]}`);
                        if (subPoints.length > 1) {
                            lines.push('<ul>');
                            subPoints.slice(1).forEach(sub => {
                                lines.push(`<li>${sub}</li>`);
                            });
                            lines.push('</ul>');
                        }
                        lines.push('</li>');
                    } else {
                        lines.push(`<li>${point}</li>`);
                    }
                });
                lines.push('</ul>');
                lines.push('</div>'); // Close key-points
            }
            
            lines.push('</div>'); // Close analysis-content
            lines.push('</details>');
        }

        // Add cross-references if available and requested
        if (this.options.includeCrossReferences && metadata.analysis?.crossReferences &&
            (this.options.aiSummaryStyle === 'detailed' || this.options.aiSummaryStyle === 'comprehensive')) {
            const { references, referencedBy } = metadata.analysis.crossReferences;
            
            if (references.length > 0 || referencedBy.length > 0) {
                lines.push('<details class="cross-references">');
                lines.push('<summary>Cross References</summary>');
                lines.push('<div class="references-content">');
                
                if (references.length > 0) {
                    lines.push('<div class="references-out">');
                    lines.push('<strong>References:</strong>');
                    lines.push('<ul>');
                    references.forEach(ref => {
                        const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                        lines.push(`<li class="reference">→ <code>${ref.targetFile}</code>${symbol} - Line ${ref.location.line + 1}`);
                        if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                            lines.push(`<div class="context">Context: ${ref.context}</div>`);
                        }
                        lines.push('</li>');
                    });
                    lines.push('</ul>');
                    lines.push('</div>'); // Close references-out
                }
                
                if (referencedBy.length > 0) {
                    lines.push('<div class="references-in">');
                    lines.push('<strong>Referenced By:</strong>');
                    lines.push('<ul>');
                    referencedBy.forEach(ref => {
                        const symbol = ref.symbol ? ` (${ref.symbol})` : '';
                        lines.push(`<li class="reference">← <code>${ref.sourceFile}</code>${symbol} - Line ${ref.location.line + 1}`);
                        if (this.options.aiSummaryStyle === 'comprehensive' && ref.context) {
                            lines.push(`<div class="context">Context: ${ref.context}</div>`);
                        }
                        lines.push('</li>');
                    });
                    lines.push('</ul>');
                    lines.push('</div>'); // Close references-in
                }
                
                lines.push('</div>'); // Close references-content
                lines.push('</details>');
            }
        }

        // Add CSS styles
        lines.push('<style>');
        lines.push('.file-section { margin: 2em 0; }');
        lines.push('.file-section.extra-spacing { margin: 3em 0; }');
        lines.push('.file-path { color: #666; font-size: 0.9em; }');
        lines.push('.file-metadata table { border-collapse: collapse; width: 100%; }');
        lines.push('.file-metadata th, .file-metadata td { padding: 0.5em; text-align: left; border: 1px solid #ddd; }');
        lines.push('.file-metadata th { background-color: #f5f5f5; }');
        lines.push('.ai-analysis, .cross-references { margin: 1em 0; }');
        lines.push('.analysis-content, .references-content { padding: 1em; }');
        lines.push('.ai-summary { margin-bottom: 1em; }');
        lines.push('.key-points ul { margin: 0.5em 0; padding-left: 2em; }');
        lines.push('.key-points li { margin: 0.3em 0; }');
        lines.push('.reference { margin: 0.5em 0; }');
        lines.push('.context { margin-left: 2em; color: #666; font-style: italic; }');
        lines.push('</style>');

        // Add code block
        lines.push(`<pre><code class="language-${this.getLanguageIdentifier(metadata.languageId)}">`);
        
        return Promise.resolve(lines.join('\n'));
    }

    protected generateFileFooter(_metadata: FileMetadata): Promise<string> {
        return Promise.resolve('</div>\n<hr>\n');
    }

    protected wrapContent(content: string, metadata: FileMetadata): Promise<string> {
        const languageClass = metadata.languageId ? ` class="language-${metadata.languageId}"` : '';
        const extraSpacingClass = this.options.extraSpacing ? ' extra-spacing' : '';
        return Promise.resolve(`<div class="code-block${extraSpacingClass}"><pre><code${languageClass}>${this.escapeHtml(content)}</code></pre></div>`);
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

export function createFormatter(format: string, options: FormatOptions = {}): BaseFormatter {
    switch (format.toLowerCase()) {
        case 'markdown':
            return new MarkdownFormatter(options);
        case 'html':
            return new HtmlFormatter(options);
        default:
            return new PlainTextFormatter(options);
    }
} 