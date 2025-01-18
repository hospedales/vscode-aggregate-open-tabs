import * as vscode from 'vscode';

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
            this.iconPath = new vscode.ThemeIcon('file');
            this.contextValue = 'file';
        }
    }
}

interface FileStats {
    totalFiles: number;
    languageCounts: { [key: string]: number };
    totalSize: number;
}

export class AggregateTreeProvider implements vscode.TreeDataProvider<AggregateTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AggregateTreeItem | undefined | null | void> = new vscode.EventEmitter<AggregateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AggregateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private selectedFiles: Set<string> = new Set();
    private isSelective: boolean = false;

    constructor() {
        // Set up file change listener
        vscode.workspace.onDidChangeTextDocument(() => this.refresh());
    }

    public setSelectedFiles(files: vscode.TextDocument[], isSelective: boolean) {
        this.selectedFiles = new Set(files.map(f => f.uri.toString()));
        this.isSelective = isSelective;
        this.refresh();
    }

    public clearSelectedFiles() {
        this.selectedFiles.clear();
        this.isSelective = false;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AggregateTreeItem): vscode.TreeItem {
        return element;
    }

    private getFileStats(): FileStats {
        const stats: FileStats = {
            totalFiles: 0,
            languageCounts: {},
            totalSize: 0
        };

        // Calculate stats from open files
        const openFiles = this.isSelective
            ? Array.from(this.selectedFiles).map(uri => vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri))
            : vscode.workspace.textDocuments;

        for (const document of openFiles) {
            if (document && !document.isClosed && document.uri.scheme === 'file') {
                stats.totalFiles++;
                stats.languageCounts[document.languageId] = (stats.languageCounts[document.languageId] || 0) + 1;
                stats.totalSize += Buffer.from(document.getText()).length;
            }
        }

        return stats;
    }

    async getChildren(element?: AggregateTreeItem): Promise<AggregateTreeItem[]> {
        if (element) {
            return [];
        }

        const items: AggregateTreeItem[] = [];
        const stats = this.getFileStats();

        // Add stats item
        items.push(new AggregateTreeItem(
            `Files: ${stats.totalFiles} (${this.formatSize(stats.totalSize)})`,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add language breakdown
        if (Object.keys(stats.languageCounts).length > 0) {
            const langItem = new AggregateTreeItem(
                'Languages',
                vscode.TreeItemCollapsibleState.Expanded
            );
            items.push(langItem);

            // Add language items
            for (const [lang, count] of Object.entries(stats.languageCounts)) {
                items.push(new AggregateTreeItem(
                    `${lang}: ${count} files`,
                    vscode.TreeItemCollapsibleState.None
                ));
            }
        }

        // Add files
        const filesItem = new AggregateTreeItem(
            'Open Files',
            vscode.TreeItemCollapsibleState.Expanded
        );
        items.push(filesItem);

        const openFiles = this.isSelective
            ? Array.from(this.selectedFiles).map(uri => vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri))
            : vscode.workspace.textDocuments;

        for (const document of openFiles) {
            if (document && !document.isClosed && document.uri.scheme === 'file') {
                items.push(new AggregateTreeItem(
                    document.fileName.split('/').pop() || document.fileName,
                    vscode.TreeItemCollapsibleState.None,
                    document,
                    {
                        command: 'vscode.open',
                        title: 'Open File',
                        arguments: [document.uri]
                    }
                ));
            }
        }

        return items;
    }

    private formatSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
} 