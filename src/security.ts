import * as vscode from 'vscode';

interface SensitiveMatch {
    line: number;
    content: string;
    type: string;
}

const SENSITIVE_PATTERNS = {
    apiKey: /(?:api[_-]?key|api[_-]?token|app[_-]?key|app[_-]?token|auth[_-]?token|access[_-]?token)["\s]*[:=]\s*["']([^"']+)["']/i,
    password: /(?:password|passwd|pwd)["\s]*[:=]\s*["']([^"']+)["']/i,
    privateKey: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
    connectionString: /(?:mongodb(?:\+srv)?:|postgres:|mysql:|redis:)\/\/[^\s"']+/i,
    awsKey: /(?:AKIA|ASIA)[A-Z0-9]{16}/,
    ipAddress: /(?:^|\s)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\s|$)/,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
};

export function detectSensitiveData(content: string): SensitiveMatch[] {
    const lines = content.split('\n');
    const matches: SensitiveMatch[] = [];

    lines.forEach((line, index) => {
        for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
            if (pattern.test(line)) {
                matches.push({
                    line: index + 1,
                    content: line.trim(),
                    type
                });
            }
        }
    });

    return matches;
}

export function redactSensitiveData(content: string): string {
    let redactedContent = content;

    for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
        redactedContent = redactedContent.replace(pattern, (match) => {
            if (type === 'email' || type === 'ipAddress') {
                return '[REDACTED]';
            }
            // For API keys and tokens, keep a few characters visible
            if (match.length > 8) {
                return match.substring(0, 4) + '[REDACTED]' + match.substring(match.length - 4);
            }
            return '[REDACTED]';
        });
    }

    return redactedContent;
}

export async function checkForSensitiveData(document: vscode.TextDocument): Promise<boolean> {
    const content = document.getText();
    const matches = detectSensitiveData(content);

    if (matches.length > 0) {
        const message = `Found potentially sensitive data in ${document.fileName}:\n` +
            matches.map(m => `Line ${m.line}: ${m.type}`).join('\n');

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