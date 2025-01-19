import * as vscode from 'vscode';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { ConfigurationPanel } from './configurationUI';
import { TerminalHandler } from './terminal-handler';
import { AggregationService } from './aggregationService';
import { selectFilesToAggregate } from './selectiveAggregation';
import { PreviewPanel } from './previewPanel';

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new AggregateTreeProvider();
    const aggregationService = new AggregationService();
    
    vscode.window.createTreeView('aggregateOpenTabsView', { 
        treeDataProvider
    });
    const terminalHandler = new TerminalHandler();

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.refreshAggregateView', () => {
            treeDataProvider.refresh();
        }),

        vscode.commands.registerCommand('extension.openConfiguration', () => {
            ConfigurationPanel.createOrShow(context.extensionUri);
        }),

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
            
            // Show in preview panel
            const panel = PreviewPanel.createOrShow(context.extensionUri);
            panel.updateContent(output);
        }),

        vscode.commands.registerCommand('extension.selectiveAggregate', async () => {
            const documents = vscode.workspace.textDocuments;
            const selectedDocs = await selectFilesToAggregate(documents);
            
            if (selectedDocs) {
                const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
                const options = {
                    extraSpacing: config.get('extraSpacing', true),
                    enhancedSummaries: config.get('enhancedSummaries', true),
                    chunkSize: config.get('chunkSize', 2000),
                    codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
                };

                const output = await aggregationService.aggregateFiles(selectedDocs, options);
                
                // Show in preview panel
                const panel = PreviewPanel.createOrShow(context.extensionUri);
                panel.updateContent(output);
            }
        }),

        vscode.commands.registerCommand('extension.togglePreview', () => {
            PreviewPanel.createOrShow(context.extensionUri);
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
            vscode.window.showInformationMessage('Content copied to clipboard');
        }),

        vscode.commands.registerCommand('aggregateOpenTabs.getActiveTerminal', () => {
            return terminalHandler.getActiveTerminal();
        })
    );

    // Register webview message handlers
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('aggregatePreview', {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
                webviewPanel.webview.options = {
                    enableScripts: true,
                    localResourceRoots: [context.extensionUri]
                };
                PreviewPanel.createOrShow(context.extensionUri, webviewPanel);
            }
        })
    );
}

export function deactivate() {} 