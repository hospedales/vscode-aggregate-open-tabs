import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('PreviewPanel Integration Tests', () => {
    let disposables: vscode.Disposable[] = [];
    let testFileUri: vscode.Uri;

    setup(async () => {
        // Create a test file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'No workspace folder found');
        
        const testFilePath = path.join(workspaceFolder.uri.fsPath, 'test.ts');
        testFileUri = vscode.Uri.file(testFilePath);
        
        const testContent = `
            import { test } from './test-utils';
            
            export function add(a: number, b: number): number {
                return a + b;
            }
            
            export class Calculator {
                multiply(x: number, y: number): number {
                    return x * y;
                }
            }
        `;
        
        await vscode.workspace.fs.writeFile(testFileUri, Buffer.from(testContent));
        
        // Open the test file
        await vscode.window.showTextDocument(testFileUri);
        
        // Reset preview settings to defaults
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('showSourceView', false);
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('syntaxHighlighting', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('collapsibleSections', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('searchEnabled', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('autoRefresh', true);
    });

    teardown(async () => {
        // Close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        
        // Delete test file
        try {
            await vscode.workspace.fs.delete(testFileUri);
        } catch (error) {
            console.error('Error deleting test file:', error);
        }
        
        // Dispose of resources
        disposables.forEach(d => d.dispose());
        disposables = [];
    });

    test('preview panel shows content of open file', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for preview to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify file content is shown
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        const content = editor.document.getText();
        assert.ok(content.includes('export function add'));
        assert.ok(content.includes('export class Calculator'));
    });

    test('preview updates when file changes', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Make changes to the file
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        
        await editor.edit(editBuilder => {
            const position = new vscode.Position(4, 0);
            editBuilder.insert(position, '// Added comment\n');
        });
        
        // Wait for preview to update
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify changes are reflected
        const content = editor.document.getText();
        assert.ok(content.includes('// Added comment'));
    });

    test('split view functionality', async () => {
        // Enable split view
        await vscode.workspace.getConfiguration('aggregateOpenTabs.preview').update('showSourceView', true);
        
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for panel to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify split view is active
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs.preview');
        assert.strictEqual(config.get('showSourceView'), true);
    });

    test('syntax highlighting', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for panel to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify syntax highlighting is enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs.preview');
        assert.strictEqual(config.get('syntaxHighlighting'), true);
    });

    test('collapsible sections', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for panel to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify collapsible sections are enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs.preview');
        assert.strictEqual(config.get('collapsibleSections'), true);
    });

    test('search functionality', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for panel to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify search is enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs.preview');
        assert.strictEqual(config.get('searchEnabled'), true);
    });

    test('auto refresh', async () => {
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        // Wait for panel to update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify auto refresh is enabled
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs.preview');
        assert.strictEqual(config.get('autoRefresh'), true);
        
        // Make changes to the file
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        
        await editor.edit(editBuilder => {
            const position = new vscode.Position(4, 0);
            editBuilder.insert(position, '// Auto refresh test\n');
        });
        
        // Wait for auto refresh
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify changes are reflected
        const content = editor.document.getText();
        assert.ok(content.includes('// Auto refresh test'));
    });
}); 