import * as vscode from 'vscode';
import * as assert from 'assert';
import { beforeEach, describe, it } from 'mocha';
import { TerminalHandler } from '../src/terminal-handler';

describe('TerminalHandler', () => {
    let terminalHandler: TerminalHandler;
    let mockTerminal: vscode.Terminal;

    beforeEach(() => {
        // Mock terminal setup with complete interface implementation
        mockTerminal = {
            name: 'Test Terminal',
            processId: Promise.resolve(123),
            creationOptions: {},
            exitStatus: undefined,
            state: { isInteractedWith: true },
            dispose: () => {},
            sendText: () => {},
            show: () => {},
            hide: () => {},
            shellIntegration: {
                status: 1, // Using numeric value instead of enum
                cwd: '',
                executeCommand: () => Promise.resolve()
            }
        } as unknown as vscode.Terminal; // Using type assertion after unknown

        // Mock VS Code window functions
        const mockWindow = {
            activeTerminal: mockTerminal,
            terminals: [mockTerminal],
            onDidChangeActiveTerminal: () => ({ dispose: () => {} }),
            onDidOpenTerminal: () => ({ dispose: () => {} }),
            onDidCloseTerminal: () => ({ dispose: () => {} }),
            showInformationMessage: () => Promise.resolve(),
            showErrorMessage: () => Promise.resolve(),
        };

        // Replace window methods for testing
        Object.assign(vscode.window, mockWindow);

        // Create handler instance
        terminalHandler = new TerminalHandler();
    });

    describe('getActiveTerminal', () => {
        it('should return active terminal when one exists', async () => {
            const terminal = await terminalHandler.getActiveTerminal();
            assert.strictEqual(terminal, mockTerminal);
        });

        it('should return undefined when no active terminal exists', async () => {
            // Override mock to simulate no active terminal
            Object.assign(vscode.window, { activeTerminal: undefined });
            const terminal = await terminalHandler.getActiveTerminal();
            assert.strictEqual(terminal, undefined);
        });
    });

    describe('captureTerminalOutput', () => {
        it('should capture output from active terminal', async () => {
            const result = await terminalHandler.captureTerminalOutput();
            assert.ok(result.success);
            assert.ok(result.output);
            assert.strictEqual(result.terminalName, 'Test Terminal');
        });

        it('should handle missing active terminal', async () => {
            // Override mock to simulate no active terminal
            Object.assign(vscode.window, { activeTerminal: undefined });
            const result = await terminalHandler.captureTerminalOutput();
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'No active terminal found');
        });
    });

    describe('formatTerminalOutput', () => {
        it('should format terminal output with metadata', () => {
            const rawOutput = 'test output';
            const formatted = terminalHandler.formatTerminalOutput(rawOutput, mockTerminal);
            
            assert.ok(formatted.includes('Terminal: Test Terminal'));
            assert.ok(formatted.includes('test output'));
        });

        it('should handle empty output', () => {
            const formatted = terminalHandler.formatTerminalOutput('', mockTerminal);
            assert.ok(formatted.includes('Terminal: Test Terminal'));
            assert.ok(formatted.includes('(No output)'));
        });
    });

    describe('configuration', () => {
        it('should respect includeTerminalOutput setting', async () => {
            // Mock configuration
            const mockConfig = {
                get: (key: string) => key === 'includeTerminalOutput' ? false : undefined
            };
            Object.assign(vscode.workspace, { getConfiguration: () => mockConfig });

            const result = await terminalHandler.captureTerminalOutput();
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Terminal output capture is disabled');
        });
    });
}); 