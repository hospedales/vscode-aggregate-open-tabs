import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface FileMetadata {
    fileName: string;
    relativePath: string;
    languageId: string;
    workspace: string | undefined;
    size: number;
    lastModified: Date;
    content: string;
    summary?: string;
}

export interface FileTypeCount {
    [key: string]: number;
}

export function getFileMetadata(document: vscode.TextDocument): FileMetadata {
    const stats = fs.statSync(document.fileName);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    
    return {
        fileName: document.fileName,
        relativePath: workspaceFolder 
            ? path.relative(workspaceFolder.uri.fsPath, document.fileName)
            : path.basename(document.fileName),
        languageId: document.languageId,
        workspace: workspaceFolder?.name,
        size: stats.size,
        lastModified: stats.mtime,
        content: document.getText(),
        summary: generateFileSummary(document)
    };
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateTableOfContents(files: FileMetadata[]): string {
    let toc = '//=============================================================================\n';
    toc += '// TABLE OF CONTENTS\n';
    toc += '//=============================================================================\n\n';
    
    files.forEach((file, index) => {
        const workspace = file.workspace ? ` (${file.workspace})` : '';
        toc += `// ${index + 1}. ${file.relativePath}${workspace}\n`;
        toc += `//    Language: ${file.languageId}, Size: ${formatBytes(file.size)}\n`;
        if (file.summary) {
            toc += `//    Summary: ${file.summary}\n`;
        }
    });
    
    toc += '\n//=============================================================================\n\n';
    return toc;
}

export function generateFileHeader(file: FileMetadata): string {
    const workspace = file.workspace ? ` (${file.workspace})` : '';
    let header = '//=============================================================================\n';
    header += `// File: ${file.relativePath}${workspace}\n`;
    header += `// Language: ${file.languageId}\n`;
    header += `// Size: ${formatBytes(file.size)}\n`;
    header += `// Last Modified: ${file.lastModified.toLocaleString()}\n`;
    if (file.summary) {
        header += `// Summary: ${file.summary}\n`;
    }
    header += '//=============================================================================\n\n';
    
    // Add language-specific code fence
    if (file.languageId !== 'plaintext') {
        header += '```' + file.languageId + '\n';
    }
    
    return header;
}

export function generateFileFooter(file: FileMetadata): string {
    let footer = '';
    if (file.languageId !== 'plaintext') {
        footer = '\n```\n';
    }
    footer += '\n//=============================================================================\n\n';
    return footer;
}

export function generateFileSummary(document: vscode.TextDocument): string {
    const content = document.getText();
    const lines = content.split('\n');
    
    // Look for common patterns to generate a basic summary
    const patterns = {
        exports: /export\s+(default\s+)?(function|class|const|interface)\s+(\w+)/g,
        imports: /import\s+.*?from\s+['"].*?['"]/g,
        functions: /function\s+\w+\s*\(/g,
        classes: /class\s+\w+/g,
        components: /function\s+\w+\s*\(.*?\)\s*:\s*.*?React/g
    };

    const summary = [];
    
    // Count occurrences
    const exports = [...content.matchAll(patterns.exports)].length;
    const imports = [...content.matchAll(patterns.imports)].length;
    const functions = [...content.matchAll(patterns.functions)].length;
    const classes = [...content.matchAll(patterns.classes)].length;
    const components = [...content.matchAll(patterns.components)].length;

    if (exports > 0) summary.push(`${exports} exports`);
    if (imports > 0) summary.push(`${imports} imports`);
    if (functions > 0) summary.push(`${functions} functions`);
    if (classes > 0) summary.push(`${classes} classes`);
    if (components > 0) summary.push(`${components} React components`);

    // Add line count
    summary.push(`${lines.length} lines`);

    return summary.join(', ');
}

export function chunkContent(content: string, chunkSize: number): string[] {
    if (chunkSize <= 0) return [content];
    
    const lines = content.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        currentChunk.push(lines[i]);
        
        if (currentChunk.length >= chunkSize || i === lines.length - 1) {
            chunks.push(currentChunk.join('\n'));
            currentChunk = [];
        }
    }
    
    return chunks;
}

export async function openInNewWindow(content: string, language: string): Promise<void> {
    // Create a temporary file
    const tmpDir = path.join(vscode.workspace.rootPath || '', '.vscode', 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const tmpFile = path.join(tmpDir, `aggregated-${Date.now()}.${language}`);
    fs.writeFileSync(tmpFile, content);
    
    // Open new window with the file
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(tmpFile), true);
}

export function shouldExcludeFile(document: vscode.TextDocument): boolean {
    const config = vscode.workspace.getConfiguration('aggregateOpenTabs');
    const excludePatterns = config.get<string[]>('excludePatterns') || [];
    
    return excludePatterns.some(pattern => 
        new RegExp(pattern.replace(/\*/g, '.*')).test(document.fileName)
    );
} 