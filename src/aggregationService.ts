import * as vscode from 'vscode';
import { FileMetadata, FormatOptions, FileAnalysis } from './types';
import { analyzeFile } from './analyzer';

export class AggregationService {
    constructor() {}

    async aggregateFiles(documents: readonly vscode.TextDocument[], options: FormatOptions): Promise<string> {
        const metadata: FileMetadata[] = [];
        const analyses: Map<string, FileAnalysis> = new Map();

        // First pass: collect metadata and analyze files
        for (const doc of documents) {
            if (doc.uri.scheme === 'file') {
                const content = doc.getText();
                const analysis = await analyzeFile(doc);
                analyses.set(doc.fileName, analysis);

                metadata.push({
                    fileName: doc.fileName,
                    relativePath: vscode.workspace.asRelativePath(doc.uri),
                    content,
                    size: Buffer.from(content).length,
                    lastModified: new Date().toISOString(),
                    languageId: doc.languageId,
                    analysis
                });
            }
        }

        // Second pass: update cross-references and enhance analysis
        for (const file of metadata) {
            if (file.analysis?.crossReferences) {
                const refs = file.analysis.crossReferences;
                refs.references = refs.references.filter(ref => 
                    metadata.some(m => m.fileName === ref.file || m.relativePath === ref.file)
                );
                refs.referencedBy = refs.referencedBy.filter(ref => 
                    metadata.some(m => m.fileName === ref.file || m.relativePath === ref.file)
                );

                // Add enhanced analysis
                if (file.analysis?.frameworks && file.analysis.frameworks.length > 0) {
                    file.analysis.frameworkDetails = await this.analyzeFrameworks(file.analysis.frameworks, file.content);
                }
                
                if (options.enhancedSummaries) {
                    file.analysis.aiSummary = await this.generateAISummary(file.content, file.languageId);
                }
            }
        }

        return this.formatOutput(metadata, options);
    }

    private async analyzeFrameworks(frameworks: string[], content: string): Promise<Record<string, unknown>> {
        const details: Record<string, unknown> = {};
        for (const framework of frameworks) {
            switch (framework.toLowerCase()) {
                case 'react':
                    details.react = {
                        hooks: this.detectReactHooks(content),
                        components: this.detectReactComponents(content)
                    };
                    break;
                case 'next.js':
                    details.nextjs = {
                        isServerComponent: !content.includes('use client'),
                        routes: this.detectNextRoutes(content)
                    };
                    break;
                // Add more framework-specific analysis as needed
            }
        }
        return details;
    }

    private detectReactHooks(content: string): string[] {
        const hookPattern = /use[A-Z]\w+/g;
        return [...new Set(content.match(hookPattern) || [])];
    }

    private detectReactComponents(content: string): string[] {
        const componentPattern = /(?:export\s+(?:default\s+)?)?(?:function|const)\s+([A-Z]\w+)/g;
        const components: string[] = [];
        let match;
        while ((match = componentPattern.exec(content)) !== null) {
            components.push(match[1]);
        }
        return components;
    }

    private detectNextRoutes(content: string): string[] {
        const routePattern = /(?:page|layout|loading|error|not-found)\.(?:tsx?|jsx?)$/;
        if (routePattern.test(content)) {
            return [content.split('/').pop() || ''];
        }
        return [];
    }

    private async generateAISummary(content: string, languageId: string): Promise<string> {
        // This would integrate with an AI service in production
        // For now, return a basic summary based on content analysis
        const lines = content.split('\n').length;
        const imports = (content.match(/import\s+.*?from/g) || []).length;
        const exports = (content.match(/export\s+/g) || []).length;
        
        return `${languageId.toUpperCase()} file with ${lines} lines, ${imports} imports, and ${exports} exports.`;
    }

    private formatOutput(files: FileMetadata[], options: FormatOptions): string {
        const output: string[] = ['# Aggregated Files\n'];

        // Add summary section
        output.push('## Summary\n');
        output.push('```yaml');
        output.push(`total_files: ${files.length}`);
        output.push(`total_size: ${this.formatSize(files.reduce((sum, f) => sum + f.size, 0))}`);
        output.push(`languages: ${Array.from(new Set(files.map(f => f.languageId))).join(', ')}`);

        // Add framework summary if available
        const frameworks = new Set<string>();
        files.forEach(f => {
            if (f.analysis?.frameworks) {
                f.analysis.frameworks.forEach(fw => frameworks.add(fw));
            }
        });
        if (frameworks.size > 0) {
            output.push(`frameworks: ${Array.from(frameworks).join(', ')}`);
        }
        output.push('```\n');

        // Add cross-reference section if enabled
        if (options.enhancedSummaries) {
            output.push('\n## Cross References\n');
            files.forEach(file => {
                const refs = file.analysis?.crossReferences;
                if (refs && (refs.references.length > 0 || refs.referencedBy.length > 0)) {
                    output.push(`### ${file.relativePath}\n`);
                    if (refs.references.length > 0) {
                        output.push('**References:**\n');
                        refs.references.forEach(ref => output.push(`- ${ref.file} (${ref.type})`));
                    }
                    if (refs.referencedBy.length > 0) {
                        output.push('\n**Referenced By:**\n');
                        refs.referencedBy.forEach(ref => output.push(`- ${ref.file} (${ref.type})`));
                    }
                    output.push('\n');
                }
            });
        }

        // Add individual file sections
        files.forEach(file => {
            output.push(`\n## ${file.relativePath}\n`);
            
            // Add file metadata
            if (options.enhancedSummaries && file.analysis) {
                output.push('```yaml');
                output.push(`language: ${file.languageId}`);
                output.push(`size: ${this.formatSize(file.size)}`);
                if (file.analysis.frameworks && file.analysis.frameworks.length > 0) {
                    output.push(`frameworks: ${file.analysis.frameworks.join(', ')}`);
                }
                if (file.analysis.aiSummary) {
                    output.push(`summary: ${file.analysis.aiSummary}`);
                }
                output.push('```\n');
            }

            // Add file content with proper code fence
            const lang = options.codeFenceLanguageMap?.[file.languageId] || file.languageId;
            output.push(`\`\`\`${lang}`);
            output.push(file.content);
            output.push('```');

            if (options.extraSpacing) {
                output.push('\n');
            }
        });

        return output.join('\n');
    }

    private formatSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}