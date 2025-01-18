import * as vscode from 'vscode';

export class AggregateTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly document?: vscode.TextDocument,
        public readonly terminalOutput?: string,
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
        if (terminalOutput) {
            this.description = 'Terminal Output';
            this.tooltip = 'Captured Terminal Output';
            this.iconPath = new vscode.ThemeIcon('terminal');
            this.contextValue = 'terminal';
        }
    }
}

interface FileStats {
    totalFiles: number;
    languageCounts: { [key: string]: number };
    workspaceCounts: { [key: string]: number };
    totalSize: number;
    hasTerminalOutput: boolean;
}

export class AggregateTreeProvider implements 
    vscode.TreeDataProvider<AggregateTreeItem>,
    vscode.TreeDragAndDropController<AggregateTreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<AggregateTreeItem | undefined | null | void> = new vscode.EventEmitter<AggregateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AggregateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private selectedFiles: Set<string> = new Set();
    private isSelective: boolean = false;
    private terminalOutputs: string[] = [];

    // Implement drag and drop interface
    readonly dragMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];
    readonly dropMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];

    constructor() {
        // Set up file change listener
        vscode.workspace.onDidChangeTextDocument(() => this.refresh());
    }

    /**
     * Adds terminal output to the tree view
     * @param output The formatted terminal output to add
     */
    public async addTerminalOutput(output: string): Promise<void> {
        this.terminalOutputs.push(output);
        this.refresh();
    }

    /**
     * Clears all terminal outputs
     */
    public clearTerminalOutputs(): void {
        this.terminalOutputs = [];
        this.refresh();
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

    /* eslint-disable @typescript-eslint/no-unused-vars */
    public async handleDrag(
        _source: readonly AggregateTreeItem[],
        _dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Implementation not needed for this feature
    }

    public async handleDrop(
        _target: AggregateTreeItem | undefined,
        _dataTransfer: vscode.DataTransfer,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Implementation not needed for this feature
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */

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
            workspaceCounts: {},
            totalSize: 0,
            hasTerminalOutput: this.terminalOutputs.length > 0
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
            `Files: ${stats.totalFiles}${stats.hasTerminalOutput ? ' + Terminal' : ''}`,
            vscode.TreeItemCollapsibleState.None
        ));

        // Add language breakdown
        if (Object.keys(stats.languageCounts).length > 0) {
            const langItem = new AggregateTreeItem(
                'Languages',
                vscode.TreeItemCollapsibleState.Collapsed
            );
            items.push(langItem);
        }

        // Add files
        const openFiles = this.isSelective
            ? Array.from(this.selectedFiles).map(uri => vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri))
            : vscode.workspace.textDocuments;

        for (const document of openFiles) {
            if (document && !document.isClosed && document.uri.scheme === 'file') {
                items.push(new AggregateTreeItem(
                    document.fileName.split('/').pop() || document.fileName,
                    vscode.TreeItemCollapsibleState.None,
                    document
                ));
            }
        }

        // Add terminal outputs
        for (let i = 0; i < this.terminalOutputs.length; i++) {
            items.push(new AggregateTreeItem(
                `Terminal Output ${i + 1}`,
                vscode.TreeItemCollapsibleState.None,
                undefined,
                this.terminalOutputs[i]
            ));
        }

        return items;
    }
} 