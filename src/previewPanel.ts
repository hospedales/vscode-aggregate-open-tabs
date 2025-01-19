import * as vscode from 'vscode';
import { FileMetadata } from './types';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _content: string = '';
    private _metadata: FileMetadata[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(this._handleMessage.bind(this), null, this._disposables);
        this._panel.webview.html = this._getInitialHtml(extensionUri);

        // Set up auto-refresh if enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        if (config.get('preview.autoRefresh', true)) {
            vscode.workspace.onDidChangeTextDocument(this._onDidChangeTextDocument.bind(this), null, this._disposables);
        }
    }

    public static createOrShow(extensionUri: vscode.Uri, existingPanel?: vscode.WebviewPanel): PreviewPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel._panel.reveal(column);
            return PreviewPanel.currentPanel;
        }

        const panel = existingPanel || vscode.window.createWebviewPanel(
            'aggregatePreview',
            'Aggregate Preview',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);
        return PreviewPanel.currentPanel;
    }

    public updateContent(content: string, metadata?: FileMetadata[]): void {
        this._content = content;
        if (metadata) {
            this._metadata = metadata;
        }
        this._panel.webview.postMessage({
            type: 'update',
            content,
            metadata: this._metadata
        });
    }

    private async _handleMessage(message: { type: string; query?: string; filePath?: string; message?: string }): Promise<void> {
        switch (message.type) {
            case 'copy':
                await vscode.env.clipboard.writeText(this._content);
                vscode.window.showInformationMessage('Content copied to clipboard');
                break;

            case 'search':
                if (message.query) {
                    this._handleSearch(message.query);
                }
                break;

            case 'openFile':
                if (message.filePath) {
                    const uri = vscode.Uri.file(message.filePath);
                    await vscode.window.showTextDocument(uri);
                }
                break;

            case 'toggleSplitView':
                this._panel.webview.postMessage({ type: 'splitView' });
                break;

            case 'error':
                if (message.message) {
                    vscode.window.showErrorMessage(message.message);
                }
                break;
        }
    }

    private _handleSearch(query: string): void {
        const results = this._searchContent(query);
        this._panel.webview.postMessage({
            type: 'searchResults',
            results
        });
    }

    private _searchContent(query: string): { line: number; text: string }[] {
        const results: { line: number; text: string }[] = [];
        const lines = this._content.split('\n');
        const regex = new RegExp(query, 'gi');

        lines.forEach((line, index) => {
            if (regex.test(line)) {
                results.push({
                    line: index + 1,
                    text: line
                });
            }
        });

        return results;
    }

    private async _onDidChangeTextDocument(): Promise<void> {
        // Only refresh if auto-refresh is enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        if (!config.get('preview.autoRefresh', true)) {
            return;
        }

        // Get updated content and refresh
        await vscode.commands.executeCommand('extension.refreshPreview');
    }

    private _getInitialHtml(extensionUri: vscode.Uri): string {
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'media', 'preview.js')
        );
        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'media', 'preview.css')
        );
        const codiconsUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );
        const highlightJsUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'node_modules', 'highlight.js', 'styles', 'github.css')
        );
        const markedUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'node_modules', 'marked', 'marked.min.js')
        );
        const highlightJsMainUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'node_modules', 'highlight.js', 'highlight.min.js')
        );

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${codiconsUri}" rel="stylesheet" />
            <link href="${highlightJsUri}" rel="stylesheet">
            <link href="${styleUri}" rel="stylesheet">
            <script src="${markedUri}"></script>
            <script src="${highlightJsMainUri}"></script>
            <title>Aggregate Preview</title>
        </head>
        <body>
            <div id="toolbar">
                <div class="toolbar-group">
                    <button id="copyBtn" title="Copy to Clipboard">
                        <i class="codicon codicon-copy"></i>
                        Copy
                    </button>
                    <button id="refreshBtn" title="Refresh Content">
                        <i class="codicon codicon-refresh"></i>
                        Refresh
                    </button>
                    <button id="splitViewBtn" title="Toggle Split View">
                        <i class="codicon codicon-split-horizontal"></i>
                        Split View
                    </button>
                </div>
                <div id="searchContainer">
                    <div class="search-input-container">
                        <i class="codicon codicon-search"></i>
                        <input type="text" id="searchInput" placeholder="Search...">
                    </div>
                    <span id="searchCount"></span>
                    <button id="prevMatch" title="Previous Match">
                        <i class="codicon codicon-arrow-up"></i>
                    </button>
                    <button id="nextMatch" title="Next Match">
                        <i class="codicon codicon-arrow-down"></i>
                    </button>
                </div>
            </div>
            <div id="mainContainer">
                <div id="content"></div>
                <div id="splitContent" class="hidden"></div>
            </div>
            <script type="module" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
} 