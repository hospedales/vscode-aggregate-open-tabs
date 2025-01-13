import * as vscode from 'vscode';
import { analyzeFile } from './analyzer';

export class AggregateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly document?: vscode.TextDocument,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        if (command) {
            this.command = command;
        }
        if (document) {
            this.description = document.languageId;
            this.tooltip = document.fileName;
            this.iconPath = vscode.ThemeIcon.File;
            this.contextValue = 'file';
        }
    }
}

interface FileStats {
    totalFiles: number;
    languageCounts: { [key: string]: number };
    workspaceCounts: { [key: string]: number };
    totalSize: number;
}

export class AggregateTreeProvider implements 
    vscode.TreeDataProvider<AggregateTreeItem>,
    vscode.TreeDragAndDropController<AggregateTreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<AggregateTreeItem | undefined | null | void> = new vscode.EventEmitter<AggregateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AggregateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private fileOrder: string[] = [];

    // Implement drag and drop interface
    readonly dragMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];
    readonly dropMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];

    constructor() {
        // Set up drag and drop
        vscode.workspace.onDidChangeTextDocument(() => this.refresh());
    }

    // Handle drag
    public async handleDrag(source: readonly AggregateTreeItem[], dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
        if (source.length === 0 || !source[0].document) {
            return;
        }

        dataTransfer.set('application/vnd.code.tree.aggregateOpenTabsView', new vscode.DataTransferItem(source[0].document.fileName));
    }

    // Handle drop
    public async handleDrop(target: AggregateTreeItem | undefined, dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.aggregateOpenTabsView');
        if (!transferItem || !target || !target.document) {
            return;
        }

        const sourceFileName = transferItem.value;
        const targetFileName = target.document.fileName;

        const sourceIndex = this.fileOrder.indexOf(sourceFileName);
        const targetIndex = this.fileOrder.indexOf(targetFileName);

        if (sourceIndex === -1) {
            // Source is new, insert it at target position
            this.fileOrder.splice(targetIndex, 0, sourceFileName);
        } else {
            // Reorder existing items
            this.fileOrder.splice(sourceIndex, 1);
            const newTargetIndex = this.fileOrder.indexOf(targetFileName);
            this.fileOrder.splice(newTargetIndex, 0, sourceFileName);
        }

        this.refresh();
    }

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
        if (element?.document) {
            // Show file analysis
            const analysis = await analyzeFile(element.document);
            const items: AggregateTreeItem[] = [];

            if (analysis.frameworks.length > 0) {
                items.push(new AggregateTreeItem(
                    `Frameworks: ${analysis.frameworks.join(', ')}`,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            items.push(new AggregateTreeItem(
                `Purpose: ${analysis.purpose}`,
                vscode.TreeItemCollapsibleState.None
            ));

            if (analysis.exports.length > 0) {
                items.push(new AggregateTreeItem(
                    `Exports: ${analysis.exports.join(', ')}`,
                    vscode.TreeItemCollapsibleState.None
                ));
            }

            return items;
        }

        if (element) {
            return [];
        }

        const items: AggregateTreeItem[] = [];
        const stats = this.getFileStats();

        // Add preview toggle button
        const previewItem = new AggregateTreeItem(
            "Toggle Preview",
            vscode.TreeItemCollapsibleState.None,
            undefined,
            {
                command: 'extension.togglePreview',
                title: 'Toggle Preview',
                tooltip: 'Toggle the preview panel'
            }
        );
        previewItem.iconPath = new vscode.ThemeIcon('preview');
        items.push(previewItem);

        // Add main aggregate command with file count
        items.push(new AggregateTreeItem(
            `Aggregate ${stats.totalFiles} Open Files`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            {
                command: 'extension.aggregateOpenTabs',
                title: 'Aggregate Open Tabs',
                tooltip: 'Combine all open tabs into one file'
            }
        ));

        // Add open files section
        const openDocs = vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            !doc.uri.scheme.startsWith('output') &&
            !doc.uri.scheme.startsWith('debug') &&
            doc.uri.scheme === 'file'
        );

        // Sort files based on stored order or default to alphabetical
        const sortedDocs = this.fileOrder.length > 0
            ? openDocs.sort((a, b) => {
                const indexA = this.fileOrder.indexOf(a.fileName);
                const indexB = this.fileOrder.indexOf(b.fileName);
                if (indexA === -1 && indexB === -1) return a.fileName.localeCompare(b.fileName);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            })
            : openDocs.sort((a, b) => a.fileName.localeCompare(b.fileName));

        if (sortedDocs.length > 0) {
            const filesItem = new AggregateTreeItem(
                "Open Files",
                vscode.TreeItemCollapsibleState.Expanded
            );
            items.push(filesItem);

            for (const doc of sortedDocs) {
                items.push(new AggregateTreeItem(
                    doc.fileName,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    doc,
                    {
                        command: 'vscode.open',
                        title: 'Open File',
                        arguments: [doc.uri]
                    }
                ));
            }
        }

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
            undefined,
            {
                command: 'workbench.action.openSettings',
                title: 'Open Settings',
                arguments: ['aggregateOpenTabs']
            }
        ));

        items.push(new AggregateTreeItem(
            `File Types: ${fileTypesDisplay}`,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            {
                command: 'workbench.action.openSettings',
                title: 'Open Settings',
                arguments: ['aggregateOpenTabs.includeFileTypes']
            }
        ));

        return items;
    }
} 