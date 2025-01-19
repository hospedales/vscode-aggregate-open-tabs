import * as vscode from 'vscode';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { ConfigurationPanel } from './configurationUI';
import { TerminalHandler } from './terminal-handler';
import { AggregationService } from './aggregationService';
import { selectFilesToAggregate } from './selectiveAggregation';
import { PreviewPanel } from './previewPanel';
import { GistUploader } from './gistUploader';
import { SnapshotManager } from './snapshotManager';

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new AggregateTreeProvider();
    const aggregationService = new AggregationService();
    const gistUploader = new GistUploader();
    const snapshotManager = new SnapshotManager(context.globalState);
    
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
        }),

        vscode.commands.registerCommand('extension.uploadToGist', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const output = await aggregationService.aggregateFiles(documents, options);
            
            const gistUrl = await gistUploader.uploadToGist(output);
            if (gistUrl) {
                const action = await vscode.window.showInformationMessage(
                    `Content uploaded to Gist: ${gistUrl}`,
                    'Open in Browser'
                );
                if (action === 'Open in Browser') {
                    vscode.env.openExternal(vscode.Uri.parse(gistUrl));
                }
            }
        }),

        vscode.commands.registerCommand('extension.saveSnapshot', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const output = await aggregationService.aggregateFiles(documents, options);
            
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this snapshot',
                placeHolder: 'e.g., feature-implementation'
            });

            if (name) {
                await snapshotManager.saveSnapshot([{
                    fileName: name,
                    relativePath: name,
                    content: output,
                    size: output.length,
                    lastModified: new Date().toISOString(),
                    languageId: 'markdown'
                }]);
                vscode.window.showInformationMessage(`Snapshot '${name}' saved successfully`);
            }
        }),

        vscode.commands.registerCommand('extension.loadSnapshot', async () => {
            const snapshots = await snapshotManager.getSnapshots();
            if (snapshots.length === 0) {
                vscode.window.showInformationMessage('No snapshots available');
                return;
            }

            const selected = await vscode.window.showQuickPick(
                snapshots.map(s => s.timestamp),
                { placeHolder: 'Select a snapshot to load' }
            );

            if (selected) {
                const snapshot = snapshots.find(s => s.timestamp === selected);
                if (snapshot) {
                    const panel = PreviewPanel.createOrShow(context.extensionUri);
                    panel.updateContent(snapshot.files[0].content);
                }
            }
        }),

        vscode.commands.registerCommand('extension.openInNewWindow', async () => {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const options = {
                extraSpacing: config.get('extraSpacing', true),
                enhancedSummaries: config.get('enhancedSummaries', true),
                chunkSize: config.get('chunkSize', 2000),
                codeFenceLanguageMap: config.get('codeFenceLanguageMap', {})
            };

            const documents = vscode.workspace.textDocuments;
            const output = await aggregationService.aggregateFiles(documents, options);
            
            // Create a temporary file
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(`${vscode.workspace.rootPath}/.vscode/temp-aggregate.md`),
                Buffer.from(output)
            );

            // Open in new window
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(`${vscode.workspace.rootPath}/.vscode`), {
                forceNewWindow: true
            });
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