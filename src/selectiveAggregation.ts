import * as vscode from 'vscode';

export async function selectFilesToAggregate(documents: vscode.TextDocument[]): Promise<vscode.TextDocument[] | undefined> {
    // Create QuickPick items for each document
    const items = documents.map(doc => ({
        label: doc.fileName,
        description: doc.languageId,
        picked: true,
        document: doc
    }));

    // Show QuickPick with all items selected by default
    const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select files to aggregate (all selected by default)',
        title: 'Select Files to Aggregate'
    });

    if (!selected) {
        return undefined;
    }

    return selected.map(item => item.document);
} 