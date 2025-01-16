import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { performance } from 'perf_hooks';

suite('Performance Benchmarks', () => {
    let disposables: vscode.Disposable[] = [];
    let testFiles: vscode.Uri[] = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    // Benchmark configuration
    const ITERATIONS = 5;
    const LARGE_FILE_SIZE = 1000; // Number of functions to generate
    const NUM_FILES = 10;

    async function measureOperation(operation: () => Promise<void>, name: string): Promise<number> {
        const times: number[] = [];
        
        // Warm-up iteration
        await operation();
        
        // Measured iterations
        for (let i = 0; i < ITERATIONS; i++) {
            const start = performance.now();
            await operation();
            const end = performance.now();
            times.push(end - start);
        }
        
        // Calculate average (excluding min and max)
        times.sort((a, b) => a - b);
        const avgTime = times.slice(1, -1).reduce((a, b) => a + b, 0) / (times.length - 2);
        console.log(`${name}: ${avgTime.toFixed(2)}ms (avg of ${ITERATIONS} runs, excluding min/max)`);
        return avgTime;
    }

    setup(async () => {
        assert.ok(workspaceFolder, 'No workspace folder found');
        
        // Generate test files with varying sizes
        for (let i = 0; i < NUM_FILES; i++) {
            const functions = Array.from({ length: LARGE_FILE_SIZE }, (_, index) => `
                export function function${i}_${index}(a: number, b: number): number {
                    return a + b + ${index};
                }
            `).join('\n');
            
            const content = `
                import { helper } from './helper';
                ${functions}
                export const result = function${i}_0(1, 2);
            `;
            
            const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, `test${i}.ts`));
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
            testFiles.push(uri);
        }

        // Create helper file with imports
        const helperUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'helper.ts'));
        await vscode.workspace.fs.writeFile(helperUri, Buffer.from(`
            export function helper(x: number): number {
                return x * 2;
            }
        `));
        testFiles.push(helperUri);
    });

    teardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        
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

    test('file analysis performance', async () => {
        const avgTime = await measureOperation(async () => {
            for (const uri of testFiles) {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            }
        }, 'File Analysis');
        
        assert.ok(avgTime < 1000, 'File analysis took longer than 1000ms');
    });

    test('caching performance', async () => {
        // First run - cold cache
        const coldTime = await measureOperation(async () => {
            for (const uri of testFiles) {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            }
        }, 'Cold Cache Analysis');

        // Second run - warm cache
        const warmTime = await measureOperation(async () => {
            for (const uri of testFiles) {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            }
        }, 'Warm Cache Analysis');

        assert.ok(warmTime < coldTime * 0.5, 'Warm cache not significantly faster than cold cache');
    });

    test('aggregation performance', async () => {
        // Open all files first
        for (const uri of testFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        }

        const avgTime = await measureOperation(async () => {
            await vscode.commands.executeCommand('aggregateOpenTabs.aggregate');
        }, 'File Aggregation');

        assert.ok(avgTime < 2000, 'Aggregation took longer than 2000ms');
    });

    test('preview panel performance', async () => {
        // Open all files first
        for (const uri of testFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        }

        const avgTime = await measureOperation(async () => {
            await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for preview to load
        }, 'Preview Panel Load');

        assert.ok(avgTime < 1500, 'Preview panel load took longer than 1500ms');
    });

    test('configuration panel performance', async () => {
        const avgTime = await measureOperation(async () => {
            await vscode.commands.executeCommand('aggregateOpenTabs.showConfiguration');
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for panel to load
        }, 'Configuration Panel Load');

        assert.ok(avgTime < 1000, 'Configuration panel load took longer than 1000ms');
    });

    test('memory usage under load', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        
        // Perform memory-intensive operations
        for (const uri of testFiles) {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        
        await vscode.commands.executeCommand('aggregateOpenTabs.aggregate');
        await vscode.commands.executeCommand('aggregateOpenTabs.showPreview');
        
        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
        
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
        assert.ok(memoryIncrease < 100, 'Memory usage increased by more than 100MB');
    });
}); 