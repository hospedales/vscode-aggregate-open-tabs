import * as vscode from 'vscode';
import { AggregateTreeProvider } from './aggregateTreeProvider';
import { ConfigurationPanel } from './configurationUI';
import { TerminalHandler } from './terminal-handler';

export function activate(context: vscode.ExtensionContext) {
    const treeDataProvider = new AggregateTreeProvider();
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