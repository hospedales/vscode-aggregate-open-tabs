import * as vscode from 'vscode';

export interface SensitiveMatch {
    pattern: string;
    value: string;
    start: number;
    end: number;
}

const SENSITIVE_PATTERNS = [
    {
        name: 'API Key',
        pattern: /(['"]?(?:api[_-]?key|api[_-]?token|access[_-]?token|auth[_-]?token)['"]?\s*[:=]\s*['"]([^'"]+)['"])/gi,
        group: 2
    },
    {
        name: 'Password',
        pattern: /(['"]?(?:password|passwd|pwd)['"]?\s*[:=]\s*['"]([^'"]+)['"])/gi,
        group: 2
    },
    {
        name: 'Email',
        pattern: /(['"]?(?:email|e-mail)['"]?\s*[:=]\s*['"]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['"])/gi,
        group: 2
    },
    {
        name: 'Private Key',
        pattern: /(-----BEGIN [^\n]+?PRIVATE KEY-----[^-]+?-----END [^\n]+?PRIVATE KEY-----)/gs,
        group: 1
    }
];

export async function detectSensitiveData(content: string, customPatterns: string[] = []): Promise<SensitiveMatch[]> {
    try {
        const matches: SensitiveMatch[] = [];
        
        // Check built-in patterns
        for (const { pattern, group } of SENSITIVE_PATTERNS) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                matches.push({
                    pattern: match[0],
                    value: match[group],
                    start: match.index,
                    end: match.index + match[0].length
                });
            }
        }
        
        // Check custom patterns
        for (const customPattern of customPatterns) {
            try {
                const regex = new RegExp(customPattern, 'gi');
                let match;
                while ((match = regex.exec(content)) !== null) {
                    matches.push({
                        pattern: match[0],
                        value: match[0],
                        start: match.index,
                        end: match.index + match[0].length
                    });
                }
            } catch (error) {
                vscode.window.showWarningMessage(`Invalid custom pattern: ${customPattern}`);
            }
        }
        
        return matches;
    } catch (error) {
        vscode.window.showErrorMessage(`Error detecting sensitive data: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

export async function redactSensitiveData(content: string, matches: SensitiveMatch[]): Promise<string> {
    // Sort matches by start position in reverse order to avoid offset issues
    const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
    
    let redactedContent = content;
    for (const match of sortedMatches) {
        const redactionLength = match.value.length;
        const redactionString = '*'.repeat(redactionLength);
        redactedContent = redactedContent.substring(0, match.start) + 
            redactedContent.substring(0, match.start).replace(match.value, redactionString) +
            redactedContent.substring(match.end);
    }
    
    return redactedContent;
}

export async function checkForSensitiveData(document: vscode.TextDocument): Promise<boolean> {
    const content = document.getText();
    const matches = await detectSensitiveData(content);

    if (matches.length > 0) {
        const message = `Found potentially sensitive data in ${document.fileName}:\n` +
            matches.map(m => `Pattern: ${m.pattern}`).join('\n');

        const choice = await vscode.window.showWarningMessage(
            message,
            'Redact Data',
            'Skip File',
            'Include Anyway'
        );

        switch (choice) {
            case 'Redact Data':
                return true; // Will redact the data
            case 'Skip File':
                throw new Error(`Skipped ${document.fileName} due to sensitive data`);
            case 'Include Anyway':
                return false; // Will include without redaction
            default:
                throw new Error(`Skipped ${document.fileName} due to sensitive data`);
        }
    }

    return false;
} 