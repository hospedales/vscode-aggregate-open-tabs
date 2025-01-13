import * as vscode from 'vscode';
import * as path from 'path';
import fetch from 'node-fetch';

interface Snapshot {
    id: string;
    timestamp: string;
    content: string;
    files: string[];
    language: string;
}

interface GistResponse {
    html_url: string;
    [key: string]: any;
}

export class StorageManager {
    private readonly snapshotsKey = 'aggregateOpenTabs.snapshots';
    private readonly maxSnapshots: number;

    constructor(private context: vscode.ExtensionContext) {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        this.maxSnapshots = config.get<number>('maxSnapshots', 10);
    }

    async saveSnapshot(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor to save snapshot from.');
            return;
        }

        const content = editor.document.getText();
        const snapshot: Snapshot = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            content,
            files: vscode.workspace.textDocuments
                .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
                .map(doc => doc.fileName),
            language: editor.document.languageId
        };

        const snapshots: Snapshot[] = this.context.globalState.get<Snapshot[]>(this.snapshotsKey, []);
        snapshots.unshift(snapshot);

        // Keep only the most recent snapshots
        if (snapshots.length > this.maxSnapshots) {
            snapshots.length = this.maxSnapshots;
        }

        await this.context.globalState.update(this.snapshotsKey, snapshots);
        vscode.window.showInformationMessage('Snapshot saved successfully!');
    }

    async loadSnapshot(): Promise<void> {
        const snapshots = this.context.globalState.get<Snapshot[]>(this.snapshotsKey, []);
        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('No snapshots available.');
            return;
        }

        const items = snapshots.map(snapshot => ({
            label: new Date(snapshot.timestamp).toLocaleString(),
            description: `${snapshot.files.length} files`,
            snapshot
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a snapshot to load'
        });

        if (selected) {
            const document = await vscode.workspace.openTextDocument({
                content: selected.snapshot.content,
                language: selected.snapshot.language
            });
            await vscode.window.showTextDocument(document);
        }
    }

    async uploadToGist(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor to upload from.');
            return;
        }

        const token = vscode.workspace.getConfiguration('aggregateOpenTabs').get<string>('githubGistToken');
        if (!token) {
            vscode.window.showErrorMessage('GitHub token not configured. Please set aggregateOpenTabs.githubGistToken in settings.');
            return;
        }

        try {
            const content = editor.document.getText();
            const fileName = path.basename(editor.document.fileName);
            
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: 'Aggregated files from VS Code',
                    public: false,
                    files: {
                        [fileName]: {
                            content
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as GistResponse;
            vscode.window.showInformationMessage(`Gist created successfully! ${data.html_url}`);
            
            // Open in browser
            vscode.env.openExternal(vscode.Uri.parse(data.html_url));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create Gist: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async openInNewWindow(content: string): Promise<void> {
        try {
            const tmpFilePath = path.join(this.context.globalStorageUri.fsPath, 'temp.txt');
            
            // Create a temporary file
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(tmpFilePath),
                Buffer.from(content)
            );

            // Open new window with the file
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(path.dirname(tmpFilePath)));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open in new window: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
} 