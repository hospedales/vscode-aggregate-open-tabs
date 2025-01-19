import * as vscode from 'vscode';
import { FileMetadata, FormatOptions, FileAnalysis } from './types';
import { analyzeFile } from './analyzer';
import { minimatch } from 'minimatch';
import { getActiveEditor, getActiveEditorLanguageId, getActiveEditorText } from './utils';

interface AggregationResult {
	[key: string]: number;
}

export async function aggregateWords(): Promise<AggregationResult | undefined> {
	const editor = getActiveEditor();
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found.');
		return;
	}

	const languageId = getActiveEditorLanguageId(editor);
	if (!languageId) {
		vscode.window.showErrorMessage('Could not determine language of active editor.');
		return;
	}

	const text = getActiveEditorText(editor);
	if (!text) {
		vscode.window.showErrorMessage('No text in active editor.');
		return;
	}

	const words = text.split(/\s+/).filter(Boolean);
	const wordCounts: AggregationResult = {};

	for (const word of words) {
		const normalizedWord = word.toLowerCase();
		wordCounts[normalizedWord] = (wordCounts[normalizedWord] || 0) + 1;
	}

	return wordCounts;
}

export class AggregationService {
	// Binary file extensions to ignore
	private readonly binaryExtensions = new Set([
		// Documents
		'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
		// Archives
		'zip', 'tar', 'gz', 'rar', '7z',
		// Executables
		'exe', 'dll', 'so', 'dylib',
		// Media
		'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico',
		'mp3', 'mp4', 'wav', 'avi', 'mov',
		// Database
		'db', 'sqlite', 'mdb'
	]);

	constructor() {}

	async aggregateFiles(documents: readonly vscode.TextDocument[], options: FormatOptions): Promise<string> {
		const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
		const includeTypes = config.get<string[]>('includeFileTypes', []);
		const excludeTypes = config.get<string[]>('excludeFileTypes', []);
		const excludePatterns = config.get<string[]>('excludePatterns', [
			'**/*.env',
			'**/*.lock',
			'**/node_modules/**',
			'**/out/**',
			'**/dist/**',
			'**/.vscode/**',
			'**/.git/**'
		]);

		// Filter documents based on configuration
		const filteredDocs = documents.filter(doc => {
			// Check if file type is included (if include list is not empty)
			// The '*' wildcard in includeTypes means include all file types
			if (includeTypes.length > 0) {
				const ext = doc.fileName.split('.').pop() || '';
				if (!includeTypes.includes(ext) && !includeTypes.includes('*')) {
					return false;
				}
			}

			// Check if file type is excluded
			if (excludeTypes.some(type => doc.fileName.endsWith(`.${type}`))) {
				return false;
			}

			// Check if file path matches any exclude patterns
			if (excludePatterns.some(pattern => minimatch(doc.fileName, pattern))) {
				return false;
			}

			// Check if the file is a binary file based on its extension
			const fileExtension = doc.fileName.split('.').pop()?.toLowerCase() || '';
			if (this.binaryExtensions.has(fileExtension)) {
				return false;
			}

			return true;
		});

		const files: FileMetadata[] = await Promise.all(
			filteredDocs.map(async doc => {
				const fileContent = doc.getText();
				const relativePath = vscode.workspace.asRelativePath(doc.uri);
				const fileExtension = doc.fileName.split('.').pop()?.toLowerCase() || '';
				const isBinary = this.binaryExtensions.has(fileExtension);

				let analysis: FileAnalysis | undefined;
				if (!isBinary) {
					analysis = await analyzeFile(doc);
				}

				return {
					fileName: doc.fileName.split('/').pop() || '',
					relativePath,
					uri: doc.uri,
					languageId: doc.languageId,
					content: fileContent,
					isBinary: isBinary,
					size: fileContent.length,
					lastModified: new Date().toISOString(),
					analysis: analysis
				};
			})
		);

		return this.formatAggregatedFiles(files, options);
	}

	private formatAggregatedFiles(files: FileMetadata[], options: FormatOptions): string {
		const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
		const enableChunking = config.get<boolean>('enableChunking', false);
		const maxChunkSize = config.get<number>('chunkSize', 2000);

		let output = '';

		// Sort files by relative path for consistent output
		files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

		// Add header with timestamp
		output += `# Aggregated Files Report - ${new Date().toLocaleString()}\n\n`;

		// Add table of contents
		output += `## Table of Contents\n\n`;
		files.forEach(file => {
			output += `- [${file.relativePath}](#${file.relativePath.replace(/ /g, '-').toLowerCase()})\n`;
		});
		output += '\n';

		// Add individual file sections
		files.forEach(file => {
			output += `\n## ${file.relativePath}\n`;

			// Add file metadata
			if (options.enhancedSummaries && file.analysis) {
				output += '```yaml\n';
				output += `language: ${file.languageId}\n`;
				output += `size: ${this.formatSize(file.size)}\n`;
				if (file.analysis.frameworks && file.analysis.frameworks.length > 0) {
					output += `frameworks: ${file.analysis.frameworks.join(', ')}\n`;
				}
				if (file.analysis.aiSummary) {
					output += `summary: ${file.analysis.aiSummary}\n`;
				}
				output += '```\n';
			}

			// Add file content with proper code fence
			const lang = options.codeFenceLanguageMap?.[file.languageId] || file.languageId;

			if (enableChunking && file.content.length > maxChunkSize) {
				// Split content into chunks
				const chunks = this.chunkContent(file.content, maxChunkSize);
				chunks.forEach((chunk, index) => {
					output += `\`\`\`${lang} (Chunk ${index + 1}/${chunks.length})\n`;
					output += chunk;
					output += '\n```';
					if (options.extraSpacing) {
						output += '\n';
					}
				});
			} else {
				// Add entire content as a single chunk
				output += `\`\`\`${lang}\n`;
				output += file.content;
				output += '\n```';
				if (options.extraSpacing) {
					output += '\n';
				}
			}
		});

		return output;
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

	private chunkContent(content: string, chunkSize: number): string[] {
		const lines = content.split('\n');
		const chunks: string[] = [];
		for (let i = 0; i < lines.length; i += chunkSize) {
			chunks.push(lines.slice(i, i + chunkSize).join('\n'));
		}
		return chunks;
	}
}