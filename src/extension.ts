import * as vscode from 'vscode';
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

	vscode.commands.registerCommand('extension.refreshAggregateView', () => {
		treeDataProvider.refresh();
	});

	vscode.commands.registerCommand('extension.openConfiguration', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', 'aggregateOpenTabs');
	});

	const terminalHandler = new TerminalHandler();

	context.subscriptions.push(
		vscode.commands.registerCommand('extension.aggregateOpenTabs', async () => {
			const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
			const options = {
				extraSpacing: config.get('extraSpacing', true),
				enhancedSummaries: config.get('enhancedSummaries', true),
				chunkSize: config.get('chunkSize', 2000),
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);
			const panel = PreviewPanel.createOrShow(context.extensionUri);
			panel.updateContent(output);
		}),

		vscode.commands.registerCommand('extension.selectiveAggregate', async () => {
			const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
			const options = {
				extraSpacing: config.get('extraSpacing', true),
				enhancedSummaries: config.get('enhancedSummaries', true),
				chunkSize: config.get('chunkSize', 2000),
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const selectedFiles = await selectFilesToAggregate(documents);
			if (selectedFiles && selectedFiles.length > 0) {
				const output = await aggregationService.aggregateFiles(selectedFiles, options);
				const panel = PreviewPanel.createOrShow(context.extensionUri);
				panel.updateContent(output);
			}
		}),

		vscode.commands.registerCommand('extension.refreshPreview', async () => {
			const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
			const options = {
				extraSpacing: config.get('extraSpacing', true),
				enhancedSummaries: config.get('enhancedSummaries', true),
				chunkSize: config.get('chunkSize', 2000),
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);

			if (PreviewPanel.currentPanel) {
				PreviewPanel.currentPanel.updateContent(output);
			}
		}),

		vscode.commands.registerCommand('extension.copyAggregatedContent', async () => {
			const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
			const options = {
				extraSpacing: config.get('extraSpacing', true),
				enhancedSummaries: config.get('enhancedSummaries', true),
				chunkSize: config.get('chunkSize', 2000),
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);
			await vscode.env.clipboard.writeText(output);
			vscode.window.showInformationMessage('Aggregated content copied to clipboard');
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
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);
			
			const gistUrl = await gistUploader.upload(output);
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
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);
			
			const name = await vscode.window.showInputBox({
				prompt: 'Enter a name for this snapshot',
				placeHolder: 'e.g., feature-implementation'
			});

			if (name) {
				await snapshotManager.saveSnapshot(name, output);
				vscode.window.showInformationMessage(`Snapshot '${name}' saved successfully`);
			}
		}),

		vscode.commands.registerCommand('extension.loadSnapshot', async () => {
			const snapshots = await snapshotManager.listSnapshots();
			if (snapshots.length === 0) {
				vscode.window.showInformationMessage('No snapshots available');
				return;
			}

			const selected = await vscode.window.showQuickPick(snapshots, {
				placeHolder: 'Select a snapshot to load'
			});

			if (selected) {
				const content = await snapshotManager.loadSnapshot(selected);
				if (content) {
					const panel = PreviewPanel.createOrShow(context.extensionUri);
					panel.updateContent(content);
				}
			}
		}),

		vscode.commands.registerCommand('extension.deleteSnapshot', async () => {
			const snapshots = await snapshotManager.listSnapshots();
			if (snapshots.length === 0) {
				vscode.window.showInformationMessage('No snapshots available');
				return;
			}

			const selected = await vscode.window.showQuickPick(snapshots, {
				placeHolder: 'Select a snapshot to delete'
			});

			if (selected) {
				await snapshotManager.deleteSnapshot(selected);
				vscode.window.showInformationMessage(`Snapshot '${selected}' deleted successfully`);
			}
		}),

		vscode.commands.registerCommand('extension.openInNewWindow', async () => {
			const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
			const options = {
				extraSpacing: config.get('extraSpacing', true),
				enhancedSummaries: config.get('enhancedSummaries', true),
				chunkSize: config.get('chunkSize', 2000),
				codeFenceLanguageMap: config.get('codeFenceLanguageMap', {}),
				redactSensitiveData: config.get('redactSensitiveData', false)
			};

			const documents = vscode.workspace.textDocuments;
			const output = await aggregationService.aggregateFiles(documents, options);
			
			// Create a temporary file
			const tempFileUri = vscode.Uri.file(`${vscode.workspace.rootPath}/.vscode/temp-aggregate.md`);
			await vscode.workspace.fs.writeFile(tempFileUri, Buffer.from(output));

			// Open in new window
			await vscode.commands.executeCommand('vscode.open', tempFileUri, {
				forceNewWindow: true
			});

			// Delete the temporary file after a short delay
			setTimeout(async () => {
				await vscode.workspace.fs.delete(tempFileUri);
			}, 5000); // Adjust delay as needed
		})
	);
}

class AggregateTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			const aggregateItem = new vscode.TreeItem('Aggregate Open Tabs', vscode.TreeItemCollapsibleState.None);
			aggregateItem.command = {
				command: 'extension.aggregateOpenTabs',
				title: 'Aggregate Open Tabs'
			};
			aggregateItem.iconPath = new vscode.ThemeIcon('files');
			aggregateItem.contextValue = 'aggregatedFile';

			const selectiveAggregateItem = new vscode.TreeItem('Selectively Aggregate', vscode.TreeItemCollapsibleState.None);
			selectiveAggregateItem.command = {
				command: 'extension.selectiveAggregate',
				title: 'Selectively Aggregate Open Tabs'
			};
			selectiveAggregateItem.iconPath = new vscode.ThemeIcon('list-selection');

			return Promise.resolve([aggregateItem, selectiveAggregateItem]);
		}
	}
}

export function deactivate() {} 