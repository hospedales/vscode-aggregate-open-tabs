import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { selectFilesToAggregate } from './selectiveAggregation';
import {
    FileMetadata,
    FileTypeCount,
    getFileMetadata,
    generateTableOfContents,
    generateFileHeader,
    generateFileFooter,
    chunkContent,
    openInNewWindow,
    shouldExcludeFile
} from './utils';

let lastAggregatedContent: string | undefined;

async function aggregateFiles(documents: vscode.TextDocument[]): Promise<string | undefined> {
    try {
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const autoSave = config.get<boolean>('autoSave');
        const autoSavePath = config.get<string>('autoSavePath');
        const chunkSize = config.get<number>('chunkSize') || 0;
        
        // Get metadata for all valid documents
        const filesMetadata = documents.map(doc => getFileMetadata(doc));

        // Generate table of contents
        let aggregatedContent = generateTableOfContents(filesMetadata);

        // Combine all contents with enhanced formatting
        for (const fileMetadata of filesMetadata) {
            aggregatedContent += generateFileHeader(fileMetadata);
            
            // Handle chunking if enabled
            if (chunkSize > 0) {
                const chunks = chunkContent(fileMetadata.content, chunkSize);
                chunks.forEach((chunk, index) => {
                    if (index > 0) {
                        aggregatedContent += `\n// Chunk ${index + 1}/${chunks.length}\n`;
                    }
                    aggregatedContent += chunk;
                });
            } else {
                aggregatedContent += fileMetadata.content;
            }
            
            aggregatedContent += generateFileFooter(fileMetadata);
        }

        // Store for copy command
        lastAggregatedContent = aggregatedContent;

        // Detect most common language for syntax highlighting
        const languageCounts: FileTypeCount = {};
        filesMetadata.forEach(file => {
            const lang = file.languageId;
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        });

        const mostCommonLanguage = Object.entries(languageCounts)
            .reduce((a, b) => (a[1] > b[1] ? a : b))[0];

        // Handle auto-save if enabled
        if (autoSave) {
            try {
                let savePath = autoSavePath;
                if (!savePath && vscode.workspace.workspaceFolders) {
                    savePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                }

                if (savePath) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const saveFilePath = path.join(savePath, `aggregated-${timestamp}.${mostCommonLanguage}`);
                    
                    fs.writeFileSync(saveFilePath, aggregatedContent);
                    vscode.window.showInformationMessage(`Aggregated file saved to: ${saveFilePath}`);
                } else {
                    vscode.window.showWarningMessage('Auto-save enabled but no valid save path found.');
                }
            } catch (saveError) {
                vscode.window.showErrorMessage(`Failed to auto-save: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
            }
        }

        return aggregatedContent;
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`Error aggregating files: ${error.message}`);
        } else {
            vscode.window.showErrorMessage('An unknown error occurred while aggregating files.');
        }
        return undefined;
    }
}

async function showAggregatedContent(content: string, language: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
    const openInNew = config.get<boolean>('openInNewWindow');

    if (openInNew) {
        await openInNewWindow(content, language);
    } else {
        const doc = await vscode.workspace.openTextDocument({
            content: content,
            language: language
        });

        await vscode.window.showTextDocument(doc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: false
        });
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Create and register the tree data provider
    const treeDataProvider = new AggregateTreeProvider();
    const treeView = vscode.window.createTreeView('aggregateOpenTabsView', {
        treeDataProvider: treeDataProvider
    });
    
    // Register the refresh command
    let refreshCommand = vscode.commands.registerCommand('extension.refreshAggregateView', () => {
        treeDataProvider.refresh();
    });

    // Register the selective aggregate command
    let selectiveCommand = vscode.commands.registerCommand('extension.selectiveAggregate', async () => {
        const selectedDocs = await selectFilesToAggregate();
        if (selectedDocs && selectedDocs.length > 0) {
            const content = await aggregateFiles(selectedDocs);
            if (content) {
                await showAggregatedContent(content, selectedDocs[0].languageId);
                vscode.window.showInformationMessage(
                    `Successfully aggregated content from ${selectedDocs.length} files!`
                );
            }
        }
    });

    // Register the copy content command
    let copyCommand = vscode.commands.registerCommand('extension.copyAggregatedContent', async () => {
        if (lastAggregatedContent) {
            await vscode.env.clipboard.writeText(lastAggregatedContent);
            vscode.window.showInformationMessage('Aggregated content copied to clipboard!');
        } else {
            vscode.window.showWarningMessage('No aggregated content available. Please aggregate files first.');
        }
    });

    // Register the open in new window command
    let newWindowCommand = vscode.commands.registerCommand('extension.openInNewWindow', async () => {
        if (lastAggregatedContent) {
            const doc = await vscode.workspace.openTextDocument({
                content: lastAggregatedContent,
                language: 'typescript' // Default to TypeScript, but you could store the last used language
            });
            await openInNewWindow(lastAggregatedContent, doc.languageId);
        } else {
            vscode.window.showWarningMessage('No aggregated content available. Please aggregate files first.');
        }
    });

    // Register the main command
    let aggregateCommand = vscode.commands.registerCommand('extension.aggregateOpenTabs', async () => {
        // Get all open text documents
        const openDocuments = vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            !doc.uri.scheme.startsWith('output') &&
            !doc.uri.scheme.startsWith('debug') &&
            doc.uri.scheme === 'file' &&
            !shouldExcludeFile(doc)
        );
        
        if (openDocuments.length === 0) {
            vscode.window.showInformationMessage('No matching documents found.');
            return;
        }

        const content = await aggregateFiles(openDocuments);
        if (content) {
            await showAggregatedContent(content, openDocuments[0].languageId);
            treeDataProvider.refresh();
            
            vscode.window.showInformationMessage(
                `Successfully aggregated content from ${openDocuments.length} files!`
            );
        }
    });

    // Register all disposables
    context.subscriptions.push(
        treeView,
        refreshCommand,
        selectiveCommand,
        copyCommand,
        newWindowCommand,
        aggregateCommand
    );
}

export function deactivate() {} 