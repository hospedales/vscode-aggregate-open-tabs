import * as vscode from 'vscode';
import { FileMetadata, getFileMetadata, shouldExcludeFile } from './utils';

interface QuickPickFileItem extends vscode.QuickPickItem {
    document: vscode.TextDocument;
}

export async function selectFilesToAggregate(): Promise<vscode.TextDocument[] | undefined> {
    const openDocuments = vscode.workspace.textDocuments.filter(doc => 
        !doc.isUntitled && 
        !doc.uri.scheme.startsWith('output') &&
        !doc.uri.scheme.startsWith('debug') &&
        doc.uri.scheme === 'file' &&
        !shouldExcludeFile(doc)
    );

    if (openDocuments.length === 0) {
        vscode.window.showInformationMessage('No valid documents found to aggregate.');
        return undefined;
    }

    // Create QuickPick items for each document
    const items: QuickPickFileItem[] = await Promise.all(
        openDocuments.map(async (doc) => {
            const metadata = getFileMetadata(doc);
            return {
                label: metadata.relativePath,
                description: `${metadata.languageId} | ${metadata.workspace || 'External'}`,
                detail: metadata.summary,
                picked: true, // All items selected by default
                document: doc
            };
        })
    );

    // Create and show QuickPick
    const quickPick = vscode.window.createQuickPick<QuickPickFileItem>();
    quickPick.items = items;
    quickPick.selectedItems = items; // All items selected by default
    quickPick.canSelectMany = true;
    quickPick.title = 'Select Files to Aggregate';
    quickPick.placeholder = 'All files are selected by default. Uncheck files to exclude them.';

    return new Promise<vscode.TextDocument[] | undefined>((resolve) => {
        quickPick.onDidAccept(() => {
            const selectedDocs = quickPick.selectedItems.map(item => item.document);
            quickPick.dispose();
            resolve(selectedDocs);
        });

        quickPick.onDidHide(() => {
            quickPick.dispose();
            resolve(undefined);
        });

        quickPick.show();
    });
} 