import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('End-to-End Workflow Tests', () => {
    let disposables: vscode.Disposable[] = [];
    let testFiles: vscode.Uri[] = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    setup(async () => {
        assert.ok(workspaceFolder, 'No workspace folder found');
        
        // Create test files
        const files = [
            {
                name: 'math.ts',
                content: `
                    export function add(a: number, b: number): number {
                        return a + b;
                    }
                    export function multiply(x: number, y: number): number {
                        return x * y;
                    }
                `
            },
            {
                name: 'utils.ts',
                content: `
                    import { add, multiply } from './math';
                    export function calculate(a: number, b: number): number {
                        return add(a, multiply(b, 2));
                    }
                `
            }
        ];

        for (const file of files) {
            const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, file.name));
            await vscode.workspace.fs.writeFile(uri, Buffer.from(file.content));
            testFiles.push(uri);
        }

        // Reset configuration to defaults
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('aiSummaryStyle', 'standard');
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeImports', true);
        await vscode.workspace.getConfiguration('aggregateOpenTabs').update('includeCrossReferences', true);
    });

    teardown(async () => {
        // Close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        
        // Delete test files
        for (const uri of testFiles) {
            try {
                await vscode.workspace.fs.delete(uri);
            } catch (error) {
                console.error(`Error deleting test file ${uri.fsPath}:`, error);
            }
        }
        
        disposables.forEach(d => d.dispose());
        disposables = [];
        testFiles = [];
    });

    test('complete file aggregation workflow', async () => {
        // Open test files
        for (const uri of testFiles) {
            await vscode.window.showTextDocument(uri);
        }
        
        // Show preview panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify files are shown in preview
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        const content = editor.document.getText();
        assert.ok(content.includes('math.ts'));
        assert.ok(content.includes('utils.ts'));
        assert.ok(content.includes('export function add'));
        assert.ok(content.includes('export function calculate'));
    });

    test('snapshot creation and comparison workflow', async () => {
        // Create initial snapshot
        await vscode.commands.executeCommand('aggregateOpenTabs.createSnapshot');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Modify a file
        const mathFileUri = testFiles.find(uri => uri.fsPath.endsWith('math.ts'));
        assert.ok(mathFileUri, 'math.ts not found');
        const doc = await vscode.workspace.openTextDocument(mathFileUri);
        const editor = await vscode.window.showTextDocument(doc);
        
        await editor.edit(editBuilder => {
            const position = new vscode.Position(2, 0);
            editBuilder.insert(position, '// Added comment\n');
        });
        
        // Create second snapshot
        await vscode.commands.executeCommand('aggregateOpenTabs.createSnapshot');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Compare snapshots
        await vscode.commands.executeCommand('aggregateOpenTabs.compareSnapshots');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify comparison shows the changes
        const activeEditor = vscode.window.activeTextEditor;
        assert.ok(activeEditor, 'No active editor found');
        const content = activeEditor.document.getText();
        assert.ok(content.includes('Added comment'));
    });

    test('tag management workflow', async () => {
        // Create and apply tags
        await vscode.commands.executeCommand('aggregateOpenTabs.createTag', {
            name: 'Core',
            color: '#ff0000',
            description: 'Core functionality'
        });
        
        await vscode.commands.executeCommand('aggregateOpenTabs.applyTag', {
            tagName: 'Core',
            filePath: testFiles[0].fsPath
        });
        
        // Show preview to verify tags
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify tag is shown in preview
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        const content = editor.document.getText();
        assert.ok(content.includes('Core'));
    });

    test('configuration changes workflow', async () => {
        // Show configuration panel
        await vscode.commands.executeCommand('aggregateOpenTabs.showConfiguration');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Apply development preset
        await vscode.commands.executeCommand('aggregateOpenTabs.applyPreset', 'development');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify configuration changes
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        assert.strictEqual(config.get('aiSummaryStyle'), 'detailed');
        assert.strictEqual(config.get('includeImports'), true);
        assert.strictEqual(config.get('includeCrossReferences'), true);
        assert.strictEqual(config.get('preview.showSourceView'), true);
        
        // Show preview to verify changes are reflected
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify preview shows detailed information
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'No active editor found');
        const content = editor.document.getText();
        assert.ok(content.includes('Imports:'));
        assert.ok(content.includes('Cross-references:'));
    });
}); 