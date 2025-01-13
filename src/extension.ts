import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface FileTypeCount {
    [key: string]: number;
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.aggregateOpenTabs', async () => {
        try {
            const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
            const fileSeparatorFormat = config.get<string>('fileSeparatorFormat');
            const autoSave = config.get<boolean>('autoSave');
            const autoSavePath = config.get<string>('autoSavePath');
            const includeFileTypes = config.get<string[]>('includeFileTypes');

            // Get all open text documents
            const openDocuments = vscode.workspace.textDocuments;
            
            // Filter documents based on configuration and validity
            const validDocuments = openDocuments.filter(doc => {
                const isValidDoc = !doc.isUntitled && 
                    !doc.uri.scheme.startsWith('output') &&
                    !doc.uri.scheme.startsWith('debug') &&
                    doc.uri.scheme === 'file';

                if (!isValidDoc) return false;

                // Include all files if includeFileTypes is empty or contains "*"
                if (!includeFileTypes || 
                    includeFileTypes.length === 0 || 
                    includeFileTypes.includes('*')) {
                    return true;
                }

                // Check file extension if specific types are specified
                const fileExt = path.extname(doc.fileName).toLowerCase();
                return includeFileTypes.includes(fileExt);
            });
            
            if (validDocuments.length === 0) {
                vscode.window.showInformationMessage('No matching documents found.');
                return;
            }

            // Detect most common language for syntax highlighting
            const languageCounts: FileTypeCount = {};
            validDocuments.forEach(doc => {
                const lang = doc.languageId;
                languageCounts[lang] = (languageCounts[lang] || 0) + 1;
            });

            const mostCommonLanguage = Object.entries(languageCounts)
                .reduce((a, b) => (a[1] > b[1] ? a : b))[0];

            // Combine all contents
            let aggregatedContent = '';
            for (const document of validDocuments) {
                const fileName = document.fileName;
                const fileContent = document.getText();
                
                // Add a formatted header for each file using the configured separator
                const separator = fileSeparatorFormat!.replace('{fileName}', fileName);
                aggregatedContent += `${separator}\n\n`;
                aggregatedContent += `${fileContent}\n\n`;
            }

            // Create a new document with the aggregated content
            const doc = await vscode.workspace.openTextDocument({
                content: aggregatedContent,
                language: mostCommonLanguage
            });

            // Show the document in a new editor group
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: false
            });

            // Handle auto-save if enabled
            if (autoSave) {
                try {
                    let savePath = autoSavePath;
                    if (!savePath && vscode.workspace.workspaceFolders) {
                        savePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    }

                    if (savePath) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const saveFilePath = path.join(savePath, `aggregated-${timestamp}.${mostCommonLanguage}`);
                        
                        fs.writeFileSync(saveFilePath, aggregatedContent);
                        vscode.window.showInformationMessage(`Aggregated file saved to: ${saveFilePath}`);
                    } else {
                        vscode.window.showWarningMessage('Auto-save enabled but no valid save path found.');
                    }
                } catch (saveError) {
                    vscode.window.showErrorMessage(`Failed to auto-save: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
                }
            }
            
            vscode.window.showInformationMessage(
                `Successfully aggregated content from ${validDocuments.length} files!`
            );
        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error aggregating tabs: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred while aggregating tabs.');
            }
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {} 