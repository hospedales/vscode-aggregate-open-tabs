import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { FileMetadata } from './utils';

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
    private context: vscode.ExtensionContext;
    private snapshotsKey = 'aggregateOpenTabs.snapshots';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    private getSnapshots(): Snapshot[] {
        return this.context.globalState.get<Snapshot[]>(this.snapshotsKey, []);
    }

    private async saveSnapshots(snapshots: Snapshot[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const maxSnapshots = config.get<number>('maxSnapshots') || 10;

        // Keep only the most recent snapshots
        if (snapshots.length > maxSnapshots) {
            snapshots = snapshots.slice(-maxSnapshots);
        }

        await this.context.globalState.update(this.snapshotsKey, snapshots);
    }

    async saveSnapshot(content: string, files: string[], language: string): Promise<void> {
        const snapshots = this.getSnapshots();
        const newSnapshot: Snapshot = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            content,
            files,
            language
        };

        snapshots.push(newSnapshot);
        await this.saveSnapshots(snapshots);
    }

    async loadSnapshot(): Promise<Snapshot | undefined> {
        const snapshots = this.getSnapshots();
        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('No snapshots available.');
            return undefined;
        }

        const items = snapshots.map(s => ({
            label: new Date(s.timestamp).toLocaleString(),
            description: `${s.files.length} files`,
            detail: s.files.join(', '),
            snapshot: s
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a snapshot to load'
        });

        return selected?.snapshot;
    }

    async uploadToGist(content: string, description: string): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const token = config.get<string>('githubGistToken');

        if (!token) {
            const setToken = 'Set Token';
            const response = await vscode.window.showErrorMessage(
                'GitHub token not found. Please set your GitHub token in settings.',
                setToken
            );

            if (response === setToken) {
                await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'aggregateOpenTabs.githubGistToken'
                );
            }
            return undefined;
        }

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: description,
                    public: false,
                    files: {
                        'aggregated-code.md': {
                            content: content
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            }

            const data = await response.json() as GistResponse;
            return data.html_url;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create Gist: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return undefined;
        }
    }
} 