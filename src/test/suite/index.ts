import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'bdd',
        color: true,
        timeout: 10000 // Increase timeout for extension tests
    });

    const testsRoot = path.resolve(__dirname, '.');

    // Wait for extension to activate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Ensure workspace is set up
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new Error('Workspace not set up correctly');
    }

    // Ensure extension is activated
    const extension = vscode.extensions.all.find(ext => ext.id.toLowerCase().includes('aggregate-open-tabs'));
    if (!extension) {
        throw new Error('Extension not found');
    }

    if (!extension.isActive) {
        await extension.activate();
    }

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
            if (err) {
                return reject(err);
            }

            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    });
} 