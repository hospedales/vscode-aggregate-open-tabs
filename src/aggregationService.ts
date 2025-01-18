import * as vscode from 'vscode';
import { FileMetadata, FormatOptions } from './utils';

export class AggregationService {
    constructor() {}

    async aggregateFiles(documents: readonly vscode.TextDocument[], options: FormatOptions): Promise<string> {
        const metadata: FileMetadata[] = [];

        for (const doc of documents) {
            if (doc.uri.scheme === 'file') {
                const content = doc.getText();
                metadata.push({
                    fileName: doc.fileName,
                    relativePath: vscode.workspace.asRelativePath(doc.uri),
                    content,
                    size: Buffer.from(content).length,
                    lastModified: new Date().toISOString(),
                    languageId: doc.languageId
                });
            }
        }

        return this.formatOutput(metadata, options);
    }

    private formatOutput(files: FileMetadata[], options: FormatOptions): string {
        const output: string[] = ['# Aggregated Files\n'];

        for (const file of files) {
            // Add file header
            output.push(`## ${file.relativePath || file.fileName}\n`);
            
            // Add metadata
            output.push('### Metadata');
            output.push('```yaml');
            output.push(`path: ${file.relativePath || file.fileName}`);
            output.push(`language: ${file.languageId}`);
            output.push(`size: ${file.size} bytes`);
            output.push(`last_modified: ${file.lastModified}`);
            output.push('```\n');

            // Add file content with proper code fence
            const lang = options.codeFenceLanguageMap?.[file.languageId] || file.languageId;
            output.push('### Content');
            output.push(`\`\`\`${lang}`);
            output.push(file.content);
            output.push('```\n');

            if (options.extraSpacing) {
                output.push(''); // Extra line for readability
            }
        }

        return output.join('\n');
    }
} 