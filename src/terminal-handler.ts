import * as vscode from 'vscode';

/**
 * Interface for terminal output capture results
 */
interface TerminalOutputResult {
    success: boolean;
    output?: string;
    terminalName?: string;
    error?: string;
}

/**
 * Custom write emitter for capturing terminal output
 */
class OutputEmitter implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<number>();
    onDidClose: vscode.Event<number> = this.closeEmitter.event;
    private buffer: string[] = [];

    open(): void {
        // Terminal is ready
    }

    close(): void {
        this.closeEmitter.fire(0);
    }

    handleInput(data: string): void {
        this.buffer.push(data);
        this.writeEmitter.fire(data);
    }

    getBuffer(): string {
        return this.buffer.join('');
    }

    clear(): void {
        this.buffer = [];
    }
}

/**
 * Handles terminal-related operations for the extension
 */
export class TerminalHandler {
    private outputEmitter: OutputEmitter | undefined;
    private captureTerminal: vscode.Terminal | undefined;

    /**
     * Gets the currently active terminal or creates a new one if none exists
     * @returns The active terminal or a newly created terminal
     */
    async getActiveTerminal(): Promise<vscode.Terminal> {
        let terminal = vscode.window.activeTerminal;
        if (!terminal) {
            terminal = vscode.window.createTerminal('Aggregate Terminal');
            terminal.show();
        }
        return terminal;
    }

    /**
     * Creates or gets the capture terminal
     * @returns The capture terminal instance
     */
    private async ensureCaptureTerminal(): Promise<vscode.Terminal> {
        if (!this.outputEmitter) {
            this.outputEmitter = new OutputEmitter();
        }

        if (!this.captureTerminal) {
            this.captureTerminal = vscode.window.createTerminal({
                name: 'Output Capture',
                pty: this.outputEmitter
            });
        }

        return this.captureTerminal;
    }

    /**
     * Captures output from the active terminal
     * @returns A promise resolving to the capture result
     */
    async captureTerminalOutput(): Promise<TerminalOutputResult> {
        // Check if terminal output capture is enabled in settings
        const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
        if (!config.get('includeTerminalOutput')) {
            return {
                success: false,
                error: 'Terminal output capture is disabled'
            };
        }

        const terminal = await this.getActiveTerminal();
        if (!terminal) {
            return {
                success: false,
                error: 'No active terminal found'
            };
        }

        try {
            // First attempt: Try to use terminal selection
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.selection) {
                const selectedText = editor.document.getText(editor.selection);
                if (selectedText) {
                    return {
                        success: true,
                        output: selectedText,
                        terminalName: terminal.name
                    };
                }
            }

            // Second attempt: Try to capture recent output
            const captureTerminal = await this.ensureCaptureTerminal();
            if (this.outputEmitter) {
                this.outputEmitter.clear();
                
                // Show the capture terminal but keep it in background
                captureTerminal.show(true);
                
                // Send a command to print last few lines (platform specific)
                if (process.platform === 'win32') {
                    terminal.sendText('doskey /h');
                } else {
                    // For Unix-like systems, try to get last commands from history
                    terminal.sendText('history | tail -n 20');
                }

                // Wait a bit for the output
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const output = this.outputEmitter.getBuffer();
                if (output) {
                    return {
                        success: true,
                        output,
                        terminalName: terminal.name
                    };
                }
            }

            // Final attempt: Guide user to manually select text
            const selection = await vscode.window.showInformationMessage(
                'Please select the text you want to capture in the terminal, then try again.',
                'Select Text'
            );

            if (selection === 'Select Text') {
                return {
                    success: false,
                    error: 'Waiting for manual text selection',
                    terminalName: terminal.name
                };
            }

            return {
                success: false,
                error: 'Could not capture terminal output'
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Formats terminal output with metadata
     * @param output The raw terminal output
     * @param terminal The terminal instance
     * @returns Formatted output string
     */
    formatTerminalOutput(output: string, terminal: vscode.Terminal): string {
        const timestamp = new Date().toISOString();
        const shellInfo = terminal.creationOptions && 'shellPath' in terminal.creationOptions 
            ? terminal.creationOptions.shellPath 
            : 'default';

        const formattedOutput = [
            `Terminal: ${terminal.name}`,
            `Timestamp: ${timestamp}`,
            `Shell: ${shellInfo}`,
            '---',
            output || '(No output)',
            '---'
        ].join('\n');

        return formattedOutput;
    }

    /**
     * Disposes of the terminal handler resources
     */
    dispose(): void {
        if (this.captureTerminal) {
            this.captureTerminal.dispose();
            this.captureTerminal = undefined;
        }
        if (this.outputEmitter) {
            this.outputEmitter = undefined;
        }
    }
} 