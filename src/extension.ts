import * as vscode from 'vscode';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { ConfigurationPanel } from './configurationUI';
import { TerminalHandler } from './terminal-handler';
import { AggregationService } from './aggregationService';
import { selectFilesToAggregate } from './selectiveAggregation';

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new AggregateTreeProvider();
    const aggregationService = new AggregationService();
    vscode.window.createTreeView('aggregateOpenTabsView', { treeDataProvider });
    const terminalHandler = new TerminalHandler();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.refreshAggregateView', () => {
            treeDataProvider.refresh();
        }),
        vscode.commands.registerCommand('extension.openConfiguration', () => {
            ConfigurationPanel.createOrShow(context.extensionUri);
        }),
        vscode.commands.registerCommand('aggregateOpenTabs.getActiveTerminal', () => {
            return terminalHandler.getActiveTerminal();
        }),
        // Add new aggregation commands
        vscode.commands.registerCommand('extension.aggregateOpenTabs', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const output = await aggregationService.aggregateFiles(documents, options);
            
            // Create new document with aggregated content
            const doc = await vscode.workspace.openTextDocument({
                content: output,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        }),
        vscode.commands.registerCommand('extension.selectiveAggregate', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const selectedDocs = await selectFilesToAggregate(documents);
            
            if (selectedDocs) {
                const output = await aggregationService.aggregateFiles(selectedDocs, options);
                treeDataProvider.setSelectedFiles(selectedDocs, true);
                
                // Create new document with aggregated content
                const doc = await vscode.workspace.openTextDocument({
                    content: output,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
            }
        }),
        vscode.commands.registerCommand('extension.copyAggregatedContent', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const output = await aggregationService.aggregateFiles(documents, options);
            await vscode.env.clipboard.writeText(output);
            vscode.window.showInformationMessage('Aggregated content copied to clipboard');
        })
    );

    // Register event handlers
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            treeDataProvider.refresh();
        }),
        vscode.workspace.onDidChangeTextDocument(() => {
            treeDataProvider.refresh();
        }),
        vscode.window.onDidChangeTerminalState(() => {
            treeDataProvider.refresh();
        })
    );

    return {
        treeDataProvider,
        terminalHandler
    };
}

export function deactivate() {} 