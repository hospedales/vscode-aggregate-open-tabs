import * as vscode from 'vscode';
import * as path from 'path';
import { analyzeFile } from './analyzer';
import { FileMetadata } from './utils';

export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly document: vscode.TextDocument,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly metadata?: FileMetadata,
        public readonly analysis?: any
    ) {
        super(path.basename(document.fileName), collapsibleState);

        this.tooltip = this.generateTooltip();
        this.description = document.languageId;
        this.contextValue = 'file';

        // Add file icon based on type
        this.iconPath = vscode.ThemeIcon.File;
        
        // Add drag and drop support
        this.command = {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [document.uri]
        };
    }

    private generateTooltip(): string {
        const parts = [this.document.fileName];
        
        if (this.analysis) {
            if (this.analysis.frameworks.length > 0) {
                parts.push(`Frameworks: ${this.analysis.frameworks.join(', ')}`);
            }
            parts.push(`Purpose: ${this.analysis.purpose}`);
            if (this.analysis.exports.length > 0) {
                parts.push(`Exports: ${this.analysis.exports.join(', ')}`);
            }
        }

        if (this.metadata?.analysis?.aiSummary) {
            parts.push(this.metadata.analysis.aiSummary);
        }

        return parts.join('\n');
    }
}

export class PreviewTreeItem extends vscode.TreeItem {
    constructor(
        public readonly content: string
    ) {
        super('Preview', vscode.TreeItemCollapsibleState.None);
        this.tooltip = 'File preview';
        this.description = this.getPreviewText();
    }

    private getPreviewText(): string {
        // Get first few non-empty lines
        const lines = this.content.split('\n')
            .filter(line => line.trim().length > 0)
            .slice(0, 3)
            .join('\n');
        return lines + (this.content.split('\n').length > 3 ? '\n...' : '');
    }
}

export class EnhancedTreeProvider implements 
    vscode.TreeDataProvider<FileTreeItem | PreviewTreeItem>,
    vscode.TreeDragAndDropController<FileTreeItem | PreviewTreeItem> {
    
    private _onDidChangeTreeData: vscode.EventEmitter<FileTreeItem | PreviewTreeItem | undefined | null | void> = new vscode.EventEmitter<FileTreeItem | PreviewTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileTreeItem | PreviewTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private fileOrder: string[] = [];

    // Implement drag and drop interface
    readonly dragMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];
    readonly dropMimeTypes = ['application/vnd.code.tree.aggregateOpenTabsView'];

    constructor() {
        // Set up drag and drop
        vscode.workspace.onDidChangeTextDocument(() => this.refresh());
    }

    // Handle drag
    public async handleDrag(source: readonly (FileTreeItem | PreviewTreeItem)[], dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
        if (source.length === 0 || !(source[0] instanceof FileTreeItem)) {
            return;
        }

        const fileItem = source[0] as FileTreeItem;
        dataTransfer.set('application/vnd.code.tree.aggregateOpenTabsView', new vscode.DataTransferItem(fileItem.document.fileName));
    }

    // Handle drop
    public async handleDrop(target: FileTreeItem | PreviewTreeItem | undefined, dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.aggregateOpenTabsView');
        if (!transferItem || !target || !(target instanceof FileTreeItem)) {
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

    getTreeItem(element: FileTreeItem | PreviewTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FileTreeItem | PreviewTreeItem): Promise<(FileTreeItem | PreviewTreeItem)[]> {
        if (element instanceof PreviewTreeItem) {
            return [];
        }

        if (element) {
            // Show preview for the file
            return [new PreviewTreeItem(element.document.getText())];
        }

        // Root: show all open files
        const openDocuments = vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            !doc.uri.scheme.startsWith('output') &&
            !doc.uri.scheme.startsWith('debug') &&
            doc.uri.scheme === 'file'
        );

        // Sort files based on stored order or default to alphabetical
        const sortedDocuments = this.fileOrder.length > 0
            ? openDocuments.sort((a, b) => {
                const indexA = this.fileOrder.indexOf(a.fileName);
                const indexB = this.fileOrder.indexOf(b.fileName);
                if (indexA === -1 && indexB === -1) return a.fileName.localeCompare(b.fileName);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            })
            : openDocuments.sort((a, b) => a.fileName.localeCompare(b.fileName));

        // Create tree items with analysis
        const items = await Promise.all(sortedDocuments.map(async doc => {
            const analysis = await analyzeFile(doc);
            return new FileTreeItem(
                doc,
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                analysis
            );
        }));

        return items;
    }
} 