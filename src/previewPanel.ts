import * as vscode from 'vscode';
import { FileMetadata } from './types';

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getInitialHtml(extensionUri);
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
                localResourceRoots: [extensionUri]
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);
        return PreviewPanel.currentPanel;
    }

    public updateContent(content: string, metadata?: FileMetadata[]): void {
        this._panel.webview.postMessage({
            type: 'update',
            content,
            metadata
        });
    }

    private _getInitialHtml(extensionUri: vscode.Uri): string {
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'media', 'preview.ts')
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
                <button id="copyBtn" title="Copy to Clipboard">
                    <i class="codicon codicon-copy"></i>
                    Copy
                </button>
                <button id="refreshBtn" title="Refresh Content">
                    <i class="codicon codicon-refresh"></i>
                    Refresh
                </button>
                <div id="searchContainer">
                    <input type="text" id="searchInput" placeholder="Search...">
                    <span id="searchCount"></span>
                    <button id="prevMatch" title="Previous Match">
                        <i class="codicon codicon-arrow-up"></i>
                    </button>
                    <button id="nextMatch" title="Next Match">
                        <i class="codicon codicon-arrow-down"></i>
                    </button>
                </div>
            </div>
            <div id="content"></div>
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