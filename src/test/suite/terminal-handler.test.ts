import * as vscode from 'vscode';
import * as assert from 'assert';
import { beforeEach, describe, it } from 'mocha';
import { TerminalHandler } from '../../terminal-handler';

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
            hide: () => {}
        } as unknown as vscode.Terminal; // Using type assertion after unknown

        // Create handler instance
        terminalHandler = new TerminalHandler();

        // Mock VS Code window functions
        Object.defineProperty(vscode.window, 'activeTerminal', {
            get: () => mockTerminal,
            configurable: true
        });
        Object.defineProperty(vscode.window, 'terminals', {
            get: () => [mockTerminal],
            configurable: true
        });
    });

    describe('getActiveTerminal', () => {
        it('should return active terminal when one exists', async () => {
            const terminal = await terminalHandler.getActiveTerminal();
            assert.deepStrictEqual(terminal, mockTerminal);
        });

        it('should create new terminal when none exists', async () => {
            // Mock no active terminal
            Object.defineProperty(vscode.window, 'activeTerminal', {
                get: () => undefined,
                configurable: true
            });

            // Mock terminal creation
            const mockCreateTerminal = (name: string) => {
                const newTerminal = { ...mockTerminal, name };
                Object.defineProperty(vscode.window, 'activeTerminal', {
                    get: () => newTerminal,
                    configurable: true
                });
                return newTerminal;
            };

            // @ts-expect-error Mocking createTerminal
            vscode.window.createTerminal = mockCreateTerminal;

            const terminal = await terminalHandler.getActiveTerminal();
            assert.ok(terminal);
            assert.strictEqual(terminal.name, 'Aggregate Terminal');
        });
    });
}); 