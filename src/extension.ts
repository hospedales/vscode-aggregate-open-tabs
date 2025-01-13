import * as vscode from 'vscode';
import * as path from 'path';
import { FileMetadata, getFileMetadata } from './utils';
import { createFormatter } from './formatters';
import { selectFilesToAggregate } from './selectiveAggregation';
import { detectSensitiveData, redactSensitiveData } from './security';
import { StorageManager } from './storage';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { analyzeFile } from './analyzer';

let treeDataProvider: AggregateTreeProvider;
let storageManager: StorageManager;

export async function activate(context: vscode.ExtensionContext) {
    // Initialize providers and managers
    treeDataProvider = new AggregateTreeProvider();
    storageManager = new StorageManager(context);

    // Register tree view
    const treeView = vscode.window.createTreeView('aggregateOpenTabsView', {
        treeDataProvider,
        dragAndDropController: treeDataProvider
    });

    // Register commands
    const commands = [
        vscode.commands.registerCommand('extension.aggregateOpenTabs', () => aggregateFiles()),
        vscode.commands.registerCommand('extension.selectiveAggregate', () => aggregateFiles(true)),
        vscode.commands.registerCommand('extension.refreshAggregateView', () => treeDataProvider.refresh()),
        vscode.commands.registerCommand('extension.copyAggregatedContent', copyAggregatedContent),
        vscode.commands.registerCommand('extension.openInNewWindow', () => openInNewWindow()),
        vscode.commands.registerCommand('extension.uploadToGist', () => storageManager.uploadToGist()),
        vscode.commands.registerCommand('extension.saveSnapshot', () => storageManager.saveSnapshot()),
        vscode.commands.registerCommand('extension.loadSnapshot', () => storageManager.loadSnapshot())
    ];

    context.subscriptions.push(treeView, ...commands);
}

async function aggregateFiles(selective: boolean = false): Promise<void> {
    try {
        // Get configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const chunkSize = config.get<number>('chunkSize', 2000);
        const sensitiveDataHandling = config.get<string>('sensitiveDataHandling', 'warn');
        const outputFormat = config.get<string>('outputFormat', 'plaintext');
        const extraSpacing = config.get<boolean>('extraSpacing', true);
        const enhancedSummaries = config.get<boolean>('enhancedSummaries', true);

        // Get open documents
        let documents = vscode.workspace.textDocuments.filter(doc => 
            !doc.isUntitled && 
            !doc.uri.scheme.startsWith('output') &&
            !doc.uri.scheme.startsWith('debug') &&
            doc.uri.scheme === 'file'
        );

        // Apply selective aggregation if requested
        if (selective) {
            const selectedDocs = await selectFilesToAggregate(documents);
            if (!selectedDocs) {
                return;
            }
            documents = selectedDocs;
        }

        // Process each document
        const fileMetadata = (await Promise.all(
            documents.map(async doc => {
                try {
                    const metadata = await getFileMetadata(doc);
                    
                    // Check for sensitive data
                    if (sensitiveDataHandling !== 'ignore') {
                        const content = doc.getText();
                        const sensitiveMatches = await detectSensitiveData(content);
                        if (sensitiveMatches.length > 0) {
                            switch (sensitiveDataHandling) {
                                case 'warn':
                                    const message = `Sensitive data detected in ${path.basename(doc.fileName)}. Proceed?`;
                                    const proceed = await vscode.window.showWarningMessage(
                                        message,
                                        { modal: true },
                                        'Yes',
                                        'No'
                                    );
                                    if (proceed !== 'Yes') {
                                        return null;
                                    }
                                    break;
                                case 'redact':
                                    metadata.content = await redactSensitiveData(content, sensitiveMatches);
                                    break;
                                case 'skip':
                                    return null;
                            }
                        }
                    }

                    // Analyze file for enhanced summaries
                    if (enhancedSummaries) {
                        metadata.analysis = await analyzeFile(doc);
                    }

                    return metadata;
                } catch (error) {
                    vscode.window.showErrorMessage(`Error processing ${doc.fileName}: ${error instanceof Error ? error.message : String(error)}`);
                    return null;
                }
            })
        )).filter((file): file is FileMetadata => file !== null);

        if (fileMetadata.length === 0) {
            vscode.window.showInformationMessage('No files to aggregate.');
            return;
        }

        // Create formatter and generate content
        const formatter = createFormatter(outputFormat, { extraSpacing, enhancedSummaries, chunkSize });
        const content = await formatter.format(fileMetadata);

        // Show aggregated content
        await showAggregatedContent(content, outputFormat);

        // Refresh tree view
        treeDataProvider.refresh();

        // Auto-save if configured
        if (config.get<boolean>('autoSave', false)) {
            const autoSavePath = config.get<string>('autoSavePath', '');
            await saveAggregatedContent(content, autoSavePath);
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error aggregating files: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function showAggregatedContent(content: string, format: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument({
        content,
        language: format === 'markdown' ? 'markdown' : format === 'html' ? 'html' : 'plaintext'
    });

    if (vscode.workspace.getConfiguration('aggregateOpenTabs').get<boolean>('openInNewWindow', false)) {
        await openInNewWindow(document);
    } else {
        await vscode.window.showTextDocument(document, { preview: false });
    }
}

async function copyAggregatedContent(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await vscode.env.clipboard.writeText(editor.document.getText());
        vscode.window.showInformationMessage('Content copied to clipboard!');
    }
}

async function openInNewWindow(document?: vscode.TextDocument): Promise<void> {
    if (!document) {
        document = vscode.window.activeTextEditor?.document;
    }
    if (document) {
        await storageManager.openInNewWindow(document.getText());
    }
}

async function saveAggregatedContent(content: string, autoSavePath: string): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `aggregated-${timestamp}.txt`;
        const filePath = path.join(autoSavePath || vscode.workspace.rootPath || '', fileName);
        
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
        
        vscode.window.showInformationMessage(`Saved to: ${filePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error saving file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {} 