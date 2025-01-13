import * as vscode from 'vscode';

interface ConfigurationPanelMessage {
    command: string;
    value?: any;
}

export class ConfigurationPanel {
    public static currentPanel: ConfigurationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;

        // Set the webview's initial html content
        this._panel.webview.html = this._getWebviewContent();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message: ConfigurationPanelMessage) => {
                switch (message.command) {
                    case 'updateSetting':
                        if (message.value && 'key' in message.value && 'value' in message.value) {
                            await vscode.workspace.getConfiguration('aggregateOpenTabs').update(
                                message.value.key,
                                message.value.value,
                                vscode.ConfigurationTarget.Global
                            );
                        }
                        break;
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
                retainContextWhenHidden: true
            }
        );

        ConfigurationPanel.currentPanel = new ConfigurationPanel(panel, extensionUri);
    }

    private async _updateWebview() {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const settings = {
            chunkSize: config.get('chunkSize'),
            excludePatterns: config.get('excludePatterns'),
            addSummaries: config.get('addSummaries'),
            openInNewWindow: config.get('openInNewWindow'),
            sensitiveDataHandling: config.get('sensitiveDataHandling'),
            customRedactionPatterns: config.get('customRedactionPatterns'),
            outputFormat: config.get('outputFormat'),
            enhancedSummaries: config.get('enhancedSummaries'),
            extraSpacing: config.get('extraSpacing'),
            useCodeFences: config.get('useCodeFences'),
            includeImports: config.get('includeImports'),
            showPreviewOnStartup: config.get('showPreviewOnStartup')
        };

        await this._panel.webview.postMessage({ command: 'updateSettings', settings });
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Configuration</title>
            <style>
                body {
                    padding: 20px;
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                }
                .section {
                    margin-bottom: 24px;
                    padding: 16px;
                    border-radius: 6px;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-widget-border);
                }
                .section h2 {
                    margin-top: 0;
                    color: var(--vscode-editor-foreground);
                }
                .setting-group {
                    margin-bottom: 16px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                }
                input[type="number"],
                input[type="text"],
                select {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                input[type="checkbox"] {
                    margin-right: 8px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .pattern-list {
                    margin-bottom: 8px;
                }
                .pattern-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .pattern-item button {
                    margin-left: 8px;
                }
            </style>
        </head>
        <body>
            <div class="section">
                <h2>Chunking Settings</h2>
                <div class="setting-group">
                    <label>
                        Chunk Size (lines):
                        <input type="number" id="chunkSize" min="0" step="100">
                    </label>
                </div>
            </div>

            <div class="section">
                <h2>File Exclusions</h2>
                <div class="setting-group">
                    <div id="excludePatterns" class="pattern-list"></div>
                    <button onclick="addExcludePattern()">Add Pattern</button>
                </div>
            </div>

            <div class="section">
                <h2>Output Settings</h2>
                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="addSummaries">
                        Add file summaries
                    </label>
                    <label>
                        <input type="checkbox" id="enhancedSummaries">
                        Enhanced summaries
                    </label>
                    <label>
                        <input type="checkbox" id="extraSpacing">
                        Extra spacing
                    </label>
                    <label>
                        <input type="checkbox" id="useCodeFences">
                        Use code fences
                    </label>
                    <label>
                        <input type="checkbox" id="includeImports">
                        Include imports
                    </label>
                </div>
                <div class="setting-group">
                    <label>
                        Output Format:
                        <select id="outputFormat">
                            <option value="plaintext">Plain Text</option>
                            <option value="markdown">Markdown</option>
                            <option value="html">HTML</option>
                        </select>
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
                    <button onclick="addRedactionPattern()">Add Redaction Pattern</button>
                </div>
            </div>

            <div class="section">
                <h2>Behavior Settings</h2>
                <div class="setting-group">
                    <label>
                        <input type="checkbox" id="openInNewWindow">
                        Open in new window
                    </label>
                    <label>
                        <input type="checkbox" id="showPreviewOnStartup">
                        Show preview on startup
                    </label>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let settings = {};

                // Handle messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'updateSettings':
                            settings = message.settings;
                            updateUI();
                            break;
                    }
                });

                function updateUI() {
                    // Update all input fields with current settings
                    Object.entries(settings).forEach(([key, value]) => {
                        const element = document.getElementById(key);
                        if (element) {
                            if (element.type === 'checkbox') {
                                element.checked = value;
                            } else {
                                element.value = value;
                            }
                        }
                    });

                    // Update pattern lists
                    updatePatternList('excludePatterns', settings.excludePatterns || []);
                    updatePatternList('redactionPatterns', settings.customRedactionPatterns || []);
                }

                function updatePatternList(id, patterns) {
                    const container = document.getElementById(id);
                    container.innerHTML = '';
                    patterns.forEach((pattern, index) => {
                        const div = document.createElement('div');
                        div.className = 'pattern-item';
                        div.innerHTML = \`
                            <input type="text" value="\${pattern}" 
                                   onchange="updatePattern('\${id}', \${index}, this.value)">
                            <button onclick="removePattern('\${id}', \${index})">Remove</button>
                        \`;
                        container.appendChild(div);
                    });
                }

                function addExcludePattern() {
                    const patterns = settings.excludePatterns || [];
                    patterns.push('**/*.example');
                    updateSetting('excludePatterns', patterns);
                }

                function addRedactionPattern() {
                    const patterns = settings.customRedactionPatterns || [];
                    patterns.push('pattern');
                    updateSetting('customRedactionPatterns', patterns);
                }

                function updatePattern(listId, index, value) {
                    const key = listId === 'redactionPatterns' ? 'customRedactionPatterns' : listId;
                    const patterns = [...(settings[key] || [])];
                    patterns[index] = value;
                    updateSetting(key, patterns);
                }

                function removePattern(listId, index) {
                    const key = listId === 'redactionPatterns' ? 'customRedactionPatterns' : listId;
                    const patterns = [...(settings[key] || [])];
                    patterns.splice(index, 1);
                    updateSetting(key, patterns);
                }

                // Add change listeners to all inputs
                document.querySelectorAll('input, select').forEach(input => {
                    input.addEventListener('change', () => {
                        const value = input.type === 'checkbox' ? input.checked : input.value;
                        if (input.type === 'number') {
                            updateSetting(input.id, parseInt(value, 10));
                        } else {
                            updateSetting(input.id, value);
                        }
                    });
                });

                function updateSetting(key, value) {
                    settings[key] = value;
                    vscode.postMessage({
                        command: 'updateSetting',
                        value: { key, value }
                    });
                }
            </script>
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