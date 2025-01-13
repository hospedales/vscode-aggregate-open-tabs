import * as vscode from 'vscode';
import * as path from 'path';

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

export class AggregateTreeProvider implements vscode.TreeDataProvider<AggregateTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AggregateTreeItem | undefined | null | void> = new vscode.EventEmitter<AggregateTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AggregateTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AggregateTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AggregateTreeItem): Promise<AggregateTreeItem[]> {
        if (element) {
            return [];
        }

        const items: AggregateTreeItem[] = [];

        // Add main aggregate command
        items.push(new AggregateTreeItem(
            "Aggregate Open Tabs",
            vscode.TreeItemCollapsibleState.None,
            {
                command: 'extension.aggregateOpenTabs',
                title: 'Aggregate Open Tabs',
                tooltip: 'Combine all open tabs into one file'
            }
        ));

        // Add current configuration section
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const configItem = new AggregateTreeItem(
            "Current Configuration",
            vscode.TreeItemCollapsibleState.Expanded
        );
        configItem.tooltip = "Current extension settings";
        items.push(configItem);

        // Add configuration info items
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