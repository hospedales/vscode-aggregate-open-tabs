import * as vscode from 'vscode';

interface PreviewMessage {
    command: 'requestSource' | 'search' | 'update' | 'updateSource' | 'searchResults' | 'toggleSplitView' | 'toggleSearch' | 'toggleCollapsible';
    text?: string;
    content?: string;
    matches?: { line: number; text: string }[];
}

export class PreviewPanel {
    public static currentPanel: PreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private readonly _extensionUri: vscode.Uri;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._panel.webview.html = this._getWebviewContent(this._panel.webview);

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message: PreviewMessage) => {
                await this._handleMessage(message);
            },
            null,
            this._disposables
        );

        // Listen for text document changes
        vscode.workspace.onDidChangeTextDocument(
            async (e) => {
                if (vscode.workspace.getConfiguration('aggregateOpenTabs').get('preview.autoRefresh')) {
                    await this._onDidChangeTextDocument(e);
                }
            },
            null,
            this._disposables
        );
    }

    public static async createOrShow(extensionUri: vscode.Uri): Promise<PreviewPanel> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel._panel.reveal(column);
            return PreviewPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'aggregateOpenTabsPreview',
            'Aggregate Open Tabs Preview',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri);
        return PreviewPanel.currentPanel;
    }

    public async updateContent(content: string): Promise<void> {
        await this._panel.webview.postMessage({ command: 'update', content });
    }

    public async toggleSplitView(): Promise<void> {
        await this._panel.webview.postMessage({ command: 'toggleSplitView' });
    }

    public async toggleSearch(): Promise<void> {
        await this._panel.webview.postMessage({ command: 'toggleSearch' });
    }

    public async toggleCollapsible(): Promise<void> {
        await this._panel.webview.postMessage({ command: 'toggleCollapsible' });
    }

    private async _handleMessage(message: PreviewMessage): Promise<void> {
        let editor: vscode.TextEditor | undefined;
        
        switch (message.command) {
            case 'requestSource':
                editor = vscode.window.activeTextEditor;
                if (editor) {
                    await this._panel.webview.postMessage({
                        command: 'updateSource',
                        content: editor.document.getText()
                    });
                }
                break;
            case 'search':
                if (typeof message.text === 'string') {
                    const matches = this._findMatches(message.text);
                    await this._panel.webview.postMessage({
                        command: 'searchResults',
                        matches
                    });
                }
                break;
        }
    }

    private _findMatches(query: string): { line: number; text: string }[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !query) {
            return [];
        }

        const text = editor.document.getText();
        const lines = text.split('\n');
        const matches: { line: number; text: string }[] = [];

        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
                matches.push({ line: index + 1, text: line.trim() });
            }
        });

        return matches;
    }

    private async _onDidChangeTextDocument(e: vscode.TextDocumentChangeEvent): Promise<void> {
        await this.updateContent(e.document.getText());
    }

    private _getWebviewContent(webview: vscode.Webview): string {
        // Get paths to resource files
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.css')
        );
        const highlightJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'highlight.min.js')
        );
        const highlightCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'github.min.css')
        );
        const splitJsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'split.min.js')
        );

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <link href="${highlightCssUri}" rel="stylesheet">
                <script src="${highlightJsUri}"></script>
                <script src="${splitJsUri}"></script>
                <title>Aggregate Open Tabs Preview</title>
            </head>
            <body>
                <div class="toolbar">
                    <button onclick="toggleSplitView()">
                        <span class="codicon codicon-split-horizontal"></span>
                        Split View
                    </button>
                    <button onclick="toggleSearch()">
                        <span class="codicon codicon-search"></span>
                        Search
                    </button>
                    <button onclick="toggleCollapsible()">
                        <span class="codicon codicon-fold"></span>
                        Toggle Sections
                    </button>
                </div>
                
                <div class="search-bar" style="display: none;">
                    <input type="text" class="search-input" placeholder="Search...">
                    <span class="search-count"></span>
                </div>

                <div class="split-view">
                    <div class="source-view" style="display: none;"></div>
                    <div class="gutter" style="display: none;"></div>
                    <div class="preview-view"></div>
                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    public dispose() {
        PreviewPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
} 