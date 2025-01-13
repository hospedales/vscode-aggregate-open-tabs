import * as vscode from 'vscode';
import * as path from 'path';
import { FileMetadata, getFileMetadata, shouldIgnoreFile } from './utils';
import { createFormatter } from './formatters';
import { selectFilesToAggregate } from './selectiveAggregation';
import { analyzeFile } from './analyzer';
import { StorageManager } from './storage';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { detectSensitiveData, redactSensitiveData } from './security';

let treeDataProvider: AggregateTreeProvider;
let storageManager: StorageManager;

export async function activate(context: vscode.ExtensionContext) {
    // Initialize providers and managers
    treeDataProvider = new AggregateTreeProvider();
    storageManager = new StorageManager(context);

    // Register tree view
    const treeView = vscode.window.createTreeView('aggregateOpenTabsView', {
        treeDataProvider,
        dragAndDropController: treeDataProvider
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('extension.aggregateOpenTabs', () => aggregateFiles()),
        vscode.commands.registerCommand('extension.selectiveAggregate', () => aggregateFiles(true)),
        vscode.commands.registerCommand('extension.refreshAggregateView', () => treeDataProvider.refresh()),
        vscode.commands.registerCommand('extension.copyAggregatedContent', copyAggregatedContent),
        vscode.commands.registerCommand('extension.openInNewWindow', () => openInNewWindow()),
        vscode.commands.registerCommand('extension.uploadToGist', () => storageManager.uploadToGist()),
        vscode.commands.registerCommand('extension.saveSnapshot', () => storageManager.saveSnapshot()),
        vscode.commands.registerCommand('extension.loadSnapshot', () => storageManager.loadSnapshot())
    ];

    context.subscriptions.push(treeView, ...commands);
}

async function aggregateFiles(selective: boolean = false): Promise<void> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const chunkSize = config.get<number>('chunkSize', 2000);
        const sensitiveDataHandling = config.get<string>('sensitiveDataHandling', 'warn');
        const customRedactionPatterns = config.get<string[]>('customRedactionPatterns', []);
        const outputFormat = config.get<string>('outputFormat', 'plaintext');
        const extraSpacing = config.get<boolean>('extraSpacing', true);
        const enhancedSummaries = config.get<boolean>('enhancedSummaries', true);
        const tailoredSummaries = config.get<boolean>('tailoredSummaries', true);
        const includeKeyPoints = config.get<boolean>('includeKeyPoints', true);
        const includeImports = config.get<boolean>('includeImports', true);
        const includeExports = config.get<boolean>('includeExports', true);
        const includeDependencies = config.get<boolean>('includeDependencies', true);
        const aiSummaryStyle = config.get<'concise' | 'detailed'>('aiSummaryStyle', 'concise');
        const chunkSeparatorStyle = config.get<'double' | 'single' | 'minimal'>('chunkSeparatorStyle', 'double');
        const codeFenceLanguageMap = config.get<Record<string, string>>('codeFenceLanguageMap', {
            'typescriptreact': 'tsx',
            'javascriptreact': 'jsx',
            'typescript': 'ts',
            'javascript': 'js',
            'markdown': 'md',
            'plaintext': 'text'
        });

        // Get open documents
        let openFiles = vscode.workspace.textDocuments
            .filter(doc => 
                !doc.isUntitled && 
                !doc.uri.scheme.startsWith('debug') &&
                doc.uri.scheme === 'file' &&
                !shouldIgnoreFile(doc.fileName)
            );

        // Apply selective aggregation if requested
        if (selective) {
            const selectedDocs = await selectFilesToAggregate(openFiles);
            if (!selectedDocs) {
                return;
            }
            openFiles = selectedDocs;
        }

        // Process each document with enhanced analysis
        const fileMetadata = (await Promise.all(
            openFiles.map(async doc => {
                try {
                    const metadata = getFileMetadata(doc.fileName, doc.getText(), doc.languageId);
                    
                    // Check for sensitive data
                    if (sensitiveDataHandling !== 'ignore') {
                        const content = doc.getText();
                        const sensitiveMatches = await detectSensitiveData(content, customRedactionPatterns);
                        if (sensitiveMatches.length > 0) {
                            switch (sensitiveDataHandling) {
                                case 'warn':
                                    const message = `Sensitive data detected in ${path.basename(doc.fileName)}. Proceed?`;
                                    const proceed = await vscode.window.showWarningMessage(
                                        message,
                                        { modal: true },
                                        'Yes',
                                        'No'
                                    );
                                    if (proceed !== 'Yes') {
                                        return null;
                                    }
                                    break;
                                case 'redact':
                                    metadata.content = await redactSensitiveData(content, sensitiveMatches);
                                    break;
                                case 'skip':
                                    return null;
                            }
                        }
                    }

                    // Enhanced file analysis with tailored summaries
                    if (enhancedSummaries) {
                        const analysis = await analyzeFile(doc, {
                            tailored: tailoredSummaries,
                            includeKeyPoints,
                            includeImports,
                            includeExports,
                            includeDependencies,
                            aiSummaryStyle,
                            languageMap: codeFenceLanguageMap
                        });
                        metadata.analysis = analysis;
                    }
                    
                    return metadata;
                } catch (error) {
                    console.error(`Error processing ${doc.fileName}:`, error);
                    return null;
                }
            })
        )).filter((file): file is FileMetadata => file !== null);

        if (fileMetadata.length === 0) {
            vscode.window.showInformationMessage('No files to aggregate.');
            return;
        }

        // Create formatter with enhanced options
        const formatter = createFormatter(outputFormat, { 
            extraSpacing, 
            enhancedSummaries,
            chunkSize,
            chunkSeparatorStyle,
            codeFenceLanguageMap,
            tailoredSummaries,
            includeKeyPoints
        });
        const content = await formatter.format(fileMetadata);

        // Show aggregated content
        await showAggregatedContent(content, outputFormat);

        // Refresh tree view
        treeDataProvider.refresh();

        // Auto-save if configured
        if (config.get<boolean>('autoSave', false)) {
            const autoSavePath = config.get<string>('autoSavePath', '');
            await saveAggregatedContent(content, autoSavePath);
        }

        // Save snapshot if enabled
        if (config.get<boolean>('keepSnapshots', true)) {
            await storageManager.saveSnapshot(content);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error aggregating files: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function showAggregatedContent(content: string, format: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
        content,
        language: format === 'markdown' ? 'markdown' : format === 'html' ? 'html' : 'plaintext'
    });

    if (vscode.workspace.getConfiguration('aggregateOpenTabs').get<boolean>('openInNewWindow', false)) {
        await openInNewWindow(document);
    } else {
        const editor = await vscode.window.showTextDocument(document, { 
            preview: false,
            viewColumn: vscode.ViewColumn.Beside 
        });

        // Add folding regions for better navigation
        if (format === 'plaintext') {
            const foldingRanges = content.split('\n').reduce((ranges, line, index) => {
                if (line.startsWith('//=============================================================================')) {
                    if (ranges.length > 0 && ranges[ranges.length - 1].start !== undefined) {
                        ranges[ranges.length - 1].end = index - 1;
                    }
                    ranges.push({ start: index });
                }
                return ranges;
            }, [] as { start: number; end?: number }[]);

            if (foldingRanges.length > 0) {
                editor.setDecorations(vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    backgroundColor: new vscode.ThemeColor('editor.foldBackground')
                }), foldingRanges.map(range => new vscode.Range(
                    range.start, 0,
                    range.end || content.split('\n').length - 1, 0
                )));
            }
        }
    }
}

async function copyAggregatedContent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await vscode.env.clipboard.writeText(editor.document.getText());
        vscode.window.showInformationMessage('Content copied to clipboard!');
    }
}

async function openInNewWindow(document?: vscode.TextDocument): Promise<void> {
    if (!document) {
        document = vscode.window.activeTextEditor?.document;
    }
    if (document) {
        await storageManager.openInNewWindow(document.getText());
    }
}

async function saveAggregatedContent(content: string, autoSavePath: string): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `aggregated-${timestamp}.txt`;
        const filePath = path.join(autoSavePath || vscode.workspace.rootPath || '', fileName);
        
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
        
        vscode.window.showInformationMessage(`Saved to: ${filePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error saving file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {} 