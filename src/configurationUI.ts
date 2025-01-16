import * as vscode from 'vscode';

interface ConfigurationPanelMessage {
    command: string;
    value?: any;
}

export class ConfigurationPanel {
    public static currentPanel: ConfigurationPanel | undefined;
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
            async (message: ConfigurationPanelMessage) => {
                switch (message.command) {
                    case 'updateSetting':
                        if (message.value && 'key' in message.value && 'value' in message.value) {
                            try {
                                await vscode.workspace.getConfiguration('aggregateOpenTabs').update(
                                    message.value.key,
                                    message.value.value,
                                    vscode.ConfigurationTarget.Global
                                );
                            } catch (error) {
                                this._panel.webview.postMessage({
                                    command: 'showError',
                                    value: `Failed to update setting: ${error instanceof Error ? error.message : String(error)}`
                                });
                            }
                        }
                        break;
                    case 'showError':
                        if (message.value) {
                            vscode.window.showErrorMessage(message.value);
                        }
                        break;
                }
            },
            null,
            this._disposables
        );

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(
            async (e) => {
                if (e.affectsConfiguration('aggregateOpenTabs')) {
                    await this._updateWebview();
                }
            },
            null,
            this._disposables
        );

        // Initial update of the webview content
        this._updateWebview();
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ConfigurationPanel.currentPanel) {
            ConfigurationPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'aggregateOpenTabsConfig',
            'Aggregate Open Tabs Configuration',
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

        ConfigurationPanel.currentPanel = new ConfigurationPanel(panel, extensionUri);
    }

    private async _updateWebview() {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const settings = {
            // Summary settings
            aiSummaryStyle: config.get('aiSummaryStyle'),
            includeKeyPoints: config.get('includeKeyPoints'),
            includeImports: config.get('includeImports'),
            includeExports: config.get('includeExports'),
            includeDependencies: config.get('includeDependencies'),
            includeCrossReferences: config.get('includeCrossReferences'),

            // Chunking settings
            chunkSize: config.get('chunkSize'),
            chunkSeparatorStyle: config.get('chunkSeparatorStyle'),

            // File exclusions
            excludePatterns: config.get('excludePatterns'),

            // Output settings
            outputFormat: config.get('outputFormat'),
            extraSpacing: config.get('extraSpacing'),
            useCodeFences: config.get('useCodeFences'),

            // Security settings
            sensitiveDataHandling: config.get('sensitiveDataHandling'),
            customRedactionPatterns: config.get('customRedactionPatterns'),

            // Preview settings
            showPreviewOnStartup: config.get('showPreviewOnStartup'),
            preview: {
                showSourceView: config.get('preview.showSourceView'),
                syntaxHighlighting: config.get('preview.syntaxHighlighting'),
                collapsibleSections: config.get('preview.collapsibleSections'),
                searchEnabled: config.get('preview.searchEnabled'),
                autoRefresh: config.get('preview.autoRefresh')
            }
        };

        await this._panel.webview.postMessage({ command: 'updateSettings', settings });
    }

    private _getWebviewContent(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'configuration.js')
        );

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'configuration.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <title>Configuration</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div class="toolbar">
                <div class="preset-controls">
                    <select id="presetSelector">
                        <option value="">Select a Preset...</option>
                        <option value="minimal">Minimal</option>
                        <option value="standard">Standard</option>
                        <option value="detailed">Detailed</option>
                        <option value="development">Development</option>
                        <option value="documentation">Documentation</option>
                    </select>
                    <button id="applyPreset">Apply Preset</button>
                    <button id="saveAsPreset">Save Current as Preset</button>
                </div>
                <div class="import-export">
                    <button id="exportSettings">Export Settings</button>
                    <button id="importSettings">Import Settings</button>
                </div>
            </div>

            <div class="main-content">
                <div class="settings-panel">
                    <div class="section">
                        <h2>Summary Settings</h2>
                        <div class="setting-group">
                            <label>
                                Summary Depth:
                                <select id="aiSummaryStyle">
                                    <option value="minimal">Minimal</option>
                                    <option value="basic">Basic</option>
                                    <option value="standard">Standard</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </label>
                            <label>
                                <input type="checkbox" id="includeKeyPoints">
                                Include key points
                            </label>
                            <label>
                                <input type="checkbox" id="includeImports">
                                Include imports
                            </label>
                            <label>
                                <input type="checkbox" id="includeExports">
                                Include exports
                            </label>
                            <label>
                                <input type="checkbox" id="includeDependencies">
                                Include dependencies
                            </label>
                            <label>
                                <input type="checkbox" id="includeCrossReferences">
                                Include cross-references
                            </label>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Chunking Settings</h2>
                        <div class="setting-group">
                            <label>
                                Chunk Size (lines):
                                <input type="number" id="chunkSize" min="0" step="100">
                            </label>
                            <label>
                                Chunk Separator Style:
                                <select id="chunkSeparatorStyle">
                                    <option value="double">Double Line</option>
                                    <option value="single">Single Line</option>
                                    <option value="minimal">Minimal</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div class="section">
                        <h2>File Exclusions</h2>
                        <div class="setting-group">
                            <div class="pattern-list" id="excludePatterns"></div>
                            <div class="pattern-actions">
                                <input type="text" id="newExcludePattern" placeholder="Enter glob pattern (e.g., **/*.log)">
                                <button id="addExcludePatternBtn">Add</button>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Output Settings</h2>
                        <div class="setting-group">
                            <label>
                                Output Format:
                                <select id="outputFormat">
                                    <option value="plaintext">Plain Text</option>
                                    <option value="markdown">Markdown</option>
                                    <option value="html">HTML</option>
                                </select>
                            </label>
                            <label>
                                <input type="checkbox" id="extraSpacing">
                                Extra spacing
                            </label>
                            <label>
                                <input type="checkbox" id="useCodeFences">
                                Use code fences
                            </label>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Security Settings</h2>
                        <div class="setting-group">
                            <label>
                                Sensitive Data Handling:
                                <select id="sensitiveDataHandling">
                                    <option value="warn">Warn</option>
                                    <option value="redact">Redact</option>
                                    <option value="skip">Skip</option>
                                    <option value="ignore">Ignore</option>
                                </select>
                            </label>
                        </div>
                        <div class="setting-group">
                            <div id="redactionPatterns" class="pattern-list"></div>
                            <div class="pattern-actions">
                                <input type="text" id="newRedactionPattern" placeholder="Enter regex pattern">
                                <button id="addRedactionPatternBtn">Add</button>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Preview Settings</h2>
                        <div class="setting-group">
                            <label>
                                <input type="checkbox" id="showPreviewOnStartup">
                                Show preview on startup
                            </label>
                            <label>
                                <input type="checkbox" id="preview.showSourceView">
                                Show source view
                            </label>
                            <label>
                                <input type="checkbox" id="preview.syntaxHighlighting">
                                Enable syntax highlighting
                            </label>
                            <label>
                                <input type="checkbox" id="preview.collapsibleSections">
                                Enable collapsible sections
                            </label>
                            <label>
                                <input type="checkbox" id="preview.searchEnabled">
                                Enable search functionality
                            </label>
                            <label>
                                <input type="checkbox" id="preview.autoRefresh">
                                Auto-refresh preview
                            </label>
                        </div>
                    </div>
                </div>

                <div class="preview-panel">
                    <h2>Live Preview</h2>
                    <div id="settingsPreview"></div>
                </div>
            </div>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public dispose() {
        ConfigurationPanel.currentPanel = undefined;

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

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
} 