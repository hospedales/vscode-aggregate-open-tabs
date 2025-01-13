import * as vscode from 'vscode';

export class AggregateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        if (command) {
            this.command = command;
        }
    }
}

interface FileStats {
    totalFiles: number;
    languageCounts: { [key: string]: number };
    workspaceCounts: { [key: string]: number };
    totalSize: number;
}

export class AggregateTreeProvider implements vscode.TreeDataProvider<AggregateTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AggregateTreeItem | undefined | null | void> = new vscode.EventEmitter<AggregateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AggregateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AggregateTreeItem): vscode.TreeItem {
        return element;
    }

    private getFileStats(): FileStats {
        const docs = vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            !doc.uri.scheme.startsWith('output') &&
            !doc.uri.scheme.startsWith('debug') &&
            doc.uri.scheme === 'file'
        );

        const stats: FileStats = {
            totalFiles: docs.length,
            languageCounts: {},
            workspaceCounts: {},
            totalSize: 0
        };

        docs.forEach(doc => {
            // Count languages
            const lang = doc.languageId;
            stats.languageCounts[lang] = (stats.languageCounts[lang] || 0) + 1;

            // Count workspaces
            const workspace = vscode.workspace.getWorkspaceFolder(doc.uri)?.name || 'External';
            stats.workspaceCounts[workspace] = (stats.workspaceCounts[workspace] || 0) + 1;

            // Calculate total size
            try {
                const size = doc.getText().length;
                stats.totalSize += size;
            } catch (e) {
                // Ignore errors when getting file size
            }
        });

        return stats;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async getChildren(element?: AggregateTreeItem): Promise<AggregateTreeItem[]> {
        if (element) {
            return [];
        }

        const items: AggregateTreeItem[] = [];
        const stats = this.getFileStats();

        // Add main aggregate command with file count
        items.push(new AggregateTreeItem(
            `Aggregate ${stats.totalFiles} Open Files`,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'extension.aggregateOpenTabs',
                title: 'Aggregate Open Tabs',
                tooltip: 'Combine all open tabs into one file'
            }
        ));

        // Add file statistics section
        const statsItem = new AggregateTreeItem(
            "File Statistics",
            vscode.TreeItemCollapsibleState.Expanded
        );
        statsItem.tooltip = "Current file statistics";
        items.push(statsItem);

        // Add total size
        items.push(new AggregateTreeItem(
            `Total Size: ${this.formatBytes(stats.totalSize)}`,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add language distribution
        const languages = Object.entries(stats.languageCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([lang, count]) => 
                new AggregateTreeItem(
                    `${lang}: ${count} files`,
                    vscode.TreeItemCollapsibleState.None
                )
            );

        if (languages.length > 0) {
            const languagesItem = new AggregateTreeItem(
                "Languages",
                vscode.TreeItemCollapsibleState.Collapsed
            );
            items.push(languagesItem);
            items.push(...languages);
        }

        // Add workspace distribution
        const workspaces = Object.entries(stats.workspaceCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([workspace, count]) =>
                new AggregateTreeItem(
                    `${workspace}: ${count} files`,
                    vscode.TreeItemCollapsibleState.None
                )
            );

        if (workspaces.length > 0) {
            const workspacesItem = new AggregateTreeItem(
                "Workspaces",
                vscode.TreeItemCollapsibleState.Collapsed
            );
            items.push(workspacesItem);
            items.push(...workspaces);
        }

        // Add current configuration section
        const configItem = new AggregateTreeItem(
            "Configuration",
            vscode.TreeItemCollapsibleState.Collapsed
        );
        configItem.tooltip = "Current extension settings";
        items.push(configItem);

        // Add configuration info items
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const autoSave = config.get<boolean>('autoSave');
        const fileTypes = config.get<string[]>('includeFileTypes');
        const fileTypesDisplay = fileTypes && fileTypes.length > 0 ? fileTypes.join(', ') : 'All Files';

        items.push(new AggregateTreeItem(
            `Auto-save: ${autoSave ? 'Enabled' : 'Disabled'}`,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'workbench.action.openSettings',
                title: 'Open Settings',
                arguments: ['aggregateOpenTabs']
            }
        ));

        items.push(new AggregateTreeItem(
            `File Types: ${fileTypesDisplay}`,
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'workbench.action.openSettings',
                title: 'Open Settings',
                arguments: ['aggregateOpenTabs.includeFileTypes']
            }
        ));

        return items;
    }
} 