import * as vscode from 'vscode';
import * as path from 'path';
import { FileMetadata, getFileMetadata, shouldIgnoreFile } from './utils';
import { createFormatter } from './formatters';
import { selectFilesToAggregate } from './selectiveAggregation';
import { analyzeFile } from './analyzer';
import { StorageManager } from './storage';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { detectSensitiveData, redactSensitiveData } from './security';
import { ConfigurationPanel } from './configurationUI';

let treeDataProvider: AggregateTreeProvider;
let storageManager: StorageManager;
let previewPanel: PreviewPanel | undefined;

interface PreviewMessage {
    command: 'refresh' | 'requestSource';
}

interface PreviewResponse {
    command: 'updateSource';
    content: string;
}

type AISummaryStyle = 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive';

class PreviewPanel {
    private static readonly viewType = 'aggregatePreview';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _extensionUri: vscode.Uri;
    private _updateTimeout: NodeJS.Timeout | undefined;
    private _lastProcessedFiles: Set<string> = new Set();
    private _cachedMetadata: Map<string, any> = new Map();
    private _processingQueue: Promise<void> = Promise.resolve();
    private _currentSourceContent: string = '';

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        this._panel = vscode.window.createWebviewPanel(
            PreviewPanel.viewType,
            'Aggregation Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media')
                ]
            }
        );

        // Initial content
        this._panel.webview.html = this._getWebviewContent('');

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Force refresh when the panel becomes visible
        this._panel.onDidChangeViewState(event => {
            if (event.webviewPanel.visible) {
                this.debouncedUpdate();
            }
        });

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message: PreviewMessage) => {
                switch (message.command) {
                    case 'refresh':
                        this.debouncedUpdate();
                        return;
                    case 'requestSource':
                        this.updateSourceContent();
                        return;
                }
            },
            null,
            this._disposables
        );

        // Listen for text document changes
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                this.debouncedUpdate();
            }
        }, null, this._disposables);

        // Listen for active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.debouncedUpdate();
        }, null, this._disposables);
    }

    private async updateSourceContent(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this._currentSourceContent = editor.document.getText();
            const response: PreviewResponse = {
                command: 'updateSource',
                content: this._currentSourceContent
            };
            await this._panel.webview.postMessage(response);
        }
    }

    private async debouncedUpdate(forceRefresh: boolean = false): Promise<void> {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        this._updateTimeout = setTimeout(() => {
            this._updateTimeout = undefined;
            this._processingQueue = this._processingQueue
                .then(() => this.updateContent(forceRefresh))
                .catch((error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Error updating preview: ${errorMessage}`);
                });
        }, 500);
    }

    public static createOrShow(extensionUri: vscode.Uri): void {
        if (previewPanel) {
            previewPanel._panel.reveal(vscode.ViewColumn.Beside);
        } else {
            previewPanel = new PreviewPanel(extensionUri);
        }
    }

    public dispose(): void {
        if (this._updateTimeout) {
            clearTimeout(this._updateTimeout);
        }
        previewPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public async updateContent(forceRefresh: boolean = false): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            let openFiles = vscode.window.visibleTextEditors
                .map(editor => editor.document)
                .filter(doc => 
                    !doc.isUntitled && 
                    doc.uri.scheme === 'file' &&
                    !shouldIgnoreFile(doc.fileName)
                );

            // Early exit if no files
            if (openFiles.length === 0) {
                this._panel.webview.html = this._getWebviewContent('No editor tabs found to aggregate. Please make sure you have files open in editor tabs.');
                return;
            }

            // Clear cache if force refresh
            if (forceRefresh) {
                this._lastProcessedFiles.clear();
                this._cachedMetadata.clear();
            }

            // Check which files need processing
            const currentFiles = new Set(openFiles.map(doc => doc.fileName));
            const filesToProcess = openFiles.filter(doc => 
                forceRefresh ||
                !this._lastProcessedFiles.has(doc.fileName) || 
                !this._cachedMetadata.has(doc.fileName) ||
                doc.isDirty
            );

            // Remove cached data for files that are no longer open
            for (const fileName of this._lastProcessedFiles) {
                if (!currentFiles.has(fileName)) {
                    this._lastProcessedFiles.delete(fileName);
                    this._cachedMetadata.delete(fileName);
                }
            }

            // Process only new or modified files
            if (filesToProcess.length > 0) {
                const newMetadata = (await Promise.all(
                    filesToProcess.map(async doc => {
                        try {
                            const metadata = getFileMetadata(doc.fileName, doc.getText(), doc.languageId);
                            
                            // Add enhanced analysis if enabled
                            if (config.get<boolean>('enhancedSummaries', true)) {
                                const analysis = await analyzeFile(doc, {
                                    tailored: config.get<boolean>('tailoredSummaries', true),
                                    includeKeyPoints: config.get<boolean>('includeKeyPoints', true),
                                    includeImports: config.get<boolean>('includeImports', true),
                                    includeExports: config.get<boolean>('includeExports', true),
                                    includeDependencies: config.get<boolean>('includeDependencies', true),
                                    aiSummaryStyle: config.get<AISummaryStyle>('aiSummaryStyle', 'standard'),
                                    languageMap: config.get<Record<string, string>>('codeFenceLanguageMap', {})
                                });
                                metadata.analysis = analysis;
                            }

                            return { fileName: doc.fileName, metadata };
                        } catch (error) {
                            console.error(`Error processing ${doc.fileName}:`, error);
                            return null;
                        }
                    })
                )).filter((result): result is { fileName: string; metadata: FileMetadata } => result !== null);

                // Update cache with new metadata
                for (const { fileName, metadata } of newMetadata) {
                    this._cachedMetadata.set(fileName, metadata);
                }

                // Update processed files set
                this._lastProcessedFiles = currentFiles;
            }

            // Get all metadata (including cached)
            const fileMetadata = Array.from(currentFiles)
                .map(fileName => this._cachedMetadata.get(fileName))
                .filter((file): file is FileMetadata => file !== null);

            // Create formatter with current settings
            const formatter = createFormatter(
                config.get<string>('outputFormat', 'markdown'),
                { 
                    extraSpacing: config.get<boolean>('extraSpacing', true),
                    enhancedSummaries: config.get<boolean>('enhancedSummaries', true),
                    chunkSize: config.get<number>('chunkSize', 2000),
                    chunkSeparatorStyle: config.get<'double' | 'single' | 'minimal'>('chunkSeparatorStyle', 'double'),
                    codeFenceLanguageMap: config.get<Record<string, string>>('codeFenceLanguageMap', {}),
                    tailoredSummaries: config.get<boolean>('tailoredSummaries', true),
                    includeKeyPoints: config.get<boolean>('includeKeyPoints', true),
                    includeImports: config.get<boolean>('includeImports', true),
                    includeExports: config.get<boolean>('includeExports', true),
                    includeDependencies: config.get<boolean>('includeDependencies', true),
                    aiSummaryStyle: config.get<AISummaryStyle>('aiSummaryStyle', 'standard'),
                    useCodeFences: config.get<boolean>('useCodeFences', true)
                }
            );

            const content = await formatter.format(fileMetadata);
            this._panel.webview.html = this._getWebviewContent(content);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._panel.webview.html = this._getWebviewContent(
                `Error generating preview: ${errorMessage}`
            );
        }
    }

    private _getWebviewContent(content: string = ''): string {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const outputFormat = config.get<string>('outputFormat', 'markdown');
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js')
        );
        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.css')
        );
        const highlightJsUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'highlight.min.js')
        );
        const highlightCssUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'vs2015.min.css')
        );
        const splitJsUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'split.min.js')
        );
        
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src ${this._panel.webview.cspSource} 'nonce-${nonce}'; img-src ${this._panel.webview.cspSource} https:;">
            <title>Aggregation Preview</title>
            <link href="${styleUri}" rel="stylesheet">
            <link href="${highlightCssUri}" rel="stylesheet">
        </head>
        <body>
            <div class="toolbar">
                <span class="format-indicator">${outputFormat.toUpperCase()}</span>
                <button onclick="toggleSplitView()">
                    <span>⚡</span>
                    Toggle Split View
                </button>
                <button onclick="toggleSearch()">
                    <span>🔍</span>
                    Toggle Search
                </button>
                <button onclick="toggleCollapsible()">
                    <span>▼</span>
                    Toggle Sections
                </button>
                <button onclick="refresh()">
                    <span>⟳</span>
                    Refresh
                </button>
            </div>
            <div class="search-bar" style="display: none;">
                <input type="text" class="search-input" placeholder="Search content..." onkeyup="searchContent(this.value)">
                <span class="search-count"></span>
            </div>
            <div class="split-view">
                <div class="source-view" style="display: none;"></div>
                <div class="gutter" style="display: none;"></div>
                <div class="preview-view">
                    ${content}
                </div>
            </div>
            <script nonce="${nonce}" src="${splitJsUri}"></script>
            <script nonce="${nonce}" src="${highlightJsUri}"></script>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export async function activate(context: vscode.ExtensionContext) {
    storageManager = new StorageManager(context);
    treeDataProvider = new AggregateTreeProvider();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.aggregateOpenTabs', () => aggregateFiles(false)),
        vscode.commands.registerCommand('extension.selectiveAggregate', () => aggregateFiles(true)),
        vscode.commands.registerCommand('extension.togglePreview', () => PreviewPanel.createOrShow(context.extensionUri)),
        vscode.commands.registerCommand('extension.copyAggregatedContent', copyAggregatedContent),
        vscode.commands.registerCommand('extension.openConfiguration', () => ConfigurationPanel.createOrShow(context.extensionUri)),
        vscode.commands.registerCommand('extension.refreshAggregateView', () => treeDataProvider.refresh())
    );

    // Register tree view
    const treeView = vscode.window.createTreeView('aggregateOpenTabsView', {
        treeDataProvider,
        dragAndDropController: treeDataProvider
    });

    context.subscriptions.push(treeView);

    // Show preview panel on startup if configured
    if (vscode.workspace.getConfiguration('aggregateOpenTabs').get('showPreviewOnStartup')) {
        PreviewPanel.createOrShow(context.extensionUri);
    }
}

async function aggregateFiles(selective: boolean = false): Promise<void> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        
        // Get all configuration options individually
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
        const aiSummaryStyle = config.get<AISummaryStyle>('aiSummaryStyle', 'standard');
        const chunkSeparatorStyle = config.get<'double' | 'single' | 'minimal'>('chunkSeparatorStyle', 'double');
        const codeFenceLanguageMap = config.get<Record<string, string>>('codeFenceLanguageMap', {});

        // Clear any previous selection state
        treeDataProvider.clearSelectedFiles();

        // Get ALL open text editors, not just visible ones
        let openFiles = await vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            doc.uri.scheme === 'file' &&
            !shouldIgnoreFile(doc.fileName)
        );

        // Log the number of files found for debugging
        console.log(`Found ${openFiles.length} open files before filtering`);
        openFiles.forEach(doc => {
            console.log(`  - ${doc.fileName} (${doc.languageId})`);
        });

        if (openFiles.length === 0) {
            vscode.window.showInformationMessage('No files found to aggregate. Please open some files first.');
            return;
        }

        // Apply selective aggregation if requested
        if (selective) {
            const selectedDocs = await selectFilesToAggregate(openFiles);
            if (!selectedDocs) {
                return;
            }
            openFiles = selectedDocs;
            // Update tree provider with selected files
            treeDataProvider.setSelectedFiles(selectedDocs, true);
        }

        // Process all documents in parallel
        console.log('Processing files...');
        const fileMetadata = (await Promise.all(
            openFiles.map(async doc => {
                try {
                    console.log(`Processing ${doc.fileName}...`);
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
                    
                    console.log(`Successfully processed ${doc.fileName}`);
                    return metadata;
                } catch (error) {
                    console.error(`Error processing ${doc.fileName}:`, error);
                    return null;
                }
            })
        )).filter((file): file is FileMetadata => file !== null);

        console.log(`Successfully processed ${fileMetadata.length} files`);

        if (fileMetadata.length === 0) {
            vscode.window.showInformationMessage('No files to aggregate after processing.');
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
            includeKeyPoints,
            includeImports,
            includeExports,
            includeDependencies,
            aiSummaryStyle,
            useCodeFences: config.get<boolean>('useCodeFences', true)
        });

        // Format all files at once
        console.log('Formatting content...');
        const content = await formatter.format(fileMetadata);
        console.log('Content formatted successfully');

        // Show the aggregated content
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
        console.error('Error in aggregateFiles:', error);
        vscode.window.showErrorMessage(`Error aggregating files: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        // Always clear selection state after aggregation
        treeDataProvider.clearSelectedFiles();
    }
}

async function showAggregatedContent(content: string, format: string): Promise<void> {
    try {
        // Create a unique title for the document
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const title = `Aggregated-${timestamp}`;

        // Create an untitled document with our custom title
        const uri = vscode.Uri.parse(`untitled:${title}.${format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'txt'}`);
        const document = await vscode.workspace.openTextDocument(uri);
        
        // Set the content and language
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, new vscode.Position(0, 0), content);
        await vscode.workspace.applyEdit(edit);
        await vscode.languages.setTextDocumentLanguage(document, format === 'markdown' ? 'markdown' : format === 'html' ? 'html' : 'plaintext');

        if (vscode.workspace.getConfiguration('aggregateOpenTabs').get<boolean>('openInNewWindow', false)) {
            await openInNewWindow(document);
            return;
        }

        // Show in current window with a unique view column
        const editor = await vscode.window.showTextDocument(document, {
            preview: false, // Prevent the editor from reusing the same tab
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: false // Give focus to the aggregated content
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
                const decorationType = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    backgroundColor: new vscode.ThemeColor('editor.foldBackground')
                });
                
                editor.setDecorations(decorationType, foldingRanges.map(range => new vscode.Range(
                    range.start, 0,
                    range.end || content.split('\n').length - 1, 0
                )));
            }
        }

        // Log success for debugging
        console.log(`Successfully created aggregated document "${title}" with ${content.split('\n').length} lines`);
        
    } catch (error) {
        vscode.window.showErrorMessage(`Error showing aggregated content: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function copyAggregatedContent(): Promise<void> {
    try {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const openFiles = vscode.window.visibleTextEditors
            .map(editor => editor.document)
            .filter(doc => 
                !doc.isUntitled && 
                doc.uri.scheme === 'file' &&
                !shouldIgnoreFile(doc.fileName)
            );

        if (openFiles.length === 0) {
            vscode.window.showInformationMessage('No editor tabs found to aggregate.');
            return;
        }

        const fileMetadata = (await Promise.all(
            openFiles.map(async doc => {
                try {
                    return getFileMetadata(doc.fileName, doc.getText(), doc.languageId);
                } catch (error) {
                    console.error(`Error processing ${doc.fileName}:`, error);
                    return null;
                }
            })
        )).filter((file): file is FileMetadata => file !== null);

        const formatter = createFormatter(
            config.get<string>('outputFormat', 'markdown'),
            { 
                extraSpacing: config.get<boolean>('extraSpacing', true),
                enhancedSummaries: config.get<boolean>('enhancedSummaries', true),
                chunkSize: config.get<number>('chunkSize', 2000),
                chunkSeparatorStyle: config.get<'double' | 'single' | 'minimal'>('chunkSeparatorStyle', 'double'),
                codeFenceLanguageMap: config.get<Record<string, string>>('codeFenceLanguageMap', {}),
                tailoredSummaries: config.get<boolean>('tailoredSummaries', true),
                includeKeyPoints: config.get<boolean>('includeKeyPoints', true),
                includeImports: config.get<boolean>('includeImports', true),
                includeExports: config.get<boolean>('includeExports', true),
                includeDependencies: config.get<boolean>('includeDependencies', true),
                aiSummaryStyle: config.get<AISummaryStyle>('aiSummaryStyle', 'standard'),
                useCodeFences: config.get<boolean>('useCodeFences', true)
            }
        );
        const content = await formatter.format(fileMetadata);
        
        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage('Aggregated content copied to clipboard!');
    } catch (error) {
        vscode.window.showErrorMessage(`Error copying content: ${error instanceof Error ? error.message : String(error)}`);
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