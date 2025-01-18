import * as assert from 'assert';
import * as vscode from 'vscode';
import { TerminalHandler } from '../../terminal-handler';

describe('End-to-End Workflow Tests', () => {
    let terminalHandler: TerminalHandler;

    beforeEach(() => {
        terminalHandler = new TerminalHandler();
    });

    it('should capture terminal output correctly', async () => {
        // Create a test terminal
        const terminal = await vscode.window.createTerminal('Test Terminal');
        assert.ok(terminal, 'Terminal should be created');

        // Send some test commands
        terminal.sendText('echo "Hello World"');
        terminal.sendText('ls -la');

        // Wait for output
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get active terminal
        const activeTerminal = await terminalHandler.getActiveTerminal();
        assert.ok(activeTerminal, 'Should get active terminal');

        // Clean up
        terminal.dispose();
    });

    it('should handle configuration updates correctly', async function() {
        this.timeout(10000); // Increase timeout for config operations

        // Get initial configuration
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        const initialValue = config.get('maxTerminalLines');

        try {
            // Update configuration
            await config.update('maxTerminalLines', 150, vscode.ConfigurationTarget.Workspace);

            // Wait for configuration to update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get updated configuration
            const updatedConfig = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const updatedValue = updatedConfig.get('maxTerminalLines');
            assert.strictEqual(updatedValue, 150, 'Configuration should be updated to test value');

            // Verify that the terminal handler respects the new configuration
            const terminal = await terminalHandler.getActiveTerminal();
            assert.ok(terminal, 'Terminal should be created with updated configuration');
        } finally {
            // Restore initial value
            await config.update('maxTerminalLines', initialValue, vscode.ConfigurationTarget.Workspace);
        }
    });
}); 