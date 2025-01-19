import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export interface CrossReference {
    sourceFile: string;
    targetFile: string;
    type: 'import' | 'export' | 'dependency';
    location: {
        line: number;
        character: number;
    };
    symbol?: string;
    context?: string;
}

export interface FileAnalysis {
    purpose?: string;
    frameworks?: string[];
    dependencies?: string[];
    crossReferences?: {
        references: CrossReference[];
        referencedBy: CrossReference[];
    };
    directoryContext?: {
        parent: string;
        siblings: string[];
        children: string[];
    };
    complexity?: {
        cognitive: number;
        cyclomatic: number;
        lines: number;
    };
    documentation?: {
        comments: number;
        jsdoc: number;
        markdown: number;
    };
    security?: {
        sensitivePatterns: string[];
        dataAccess: string[];
    };
}

export interface FileMetadata {
    fileName: string;
    relativePath: string;
    content: string;
    size: number;
    lastModified: string;
    languageId: string;
    analysis?: FileAnalysis;
}

export interface FileChunk {
    content: string;
    startLine: number;
    endLine: number;
    analysis?: {
        aiSummary?: string;
        keyPoints?: string[];
    };
}

export interface FormatOptions {
    extraSpacing?: boolean;
    enhancedSummaries?: boolean;
    chunkSize?: number;
    codeFenceLanguageMap?: { [key: string]: string };
}

export function getFileMetadata(filePath: string, content: string, languageId: string): FileMetadata {
    const stats = fs.statSync(filePath);
    return {
        fileName: path.basename(filePath),
        relativePath: filePath,
        content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        languageId,
        analysis: {
            frameworks: [],
            dependencies: [],
            crossReferences: {
                references: [],
                referencedBy: []
            }
        }
    };
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return bytes + ' B';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// File extension to language mapping
/* eslint-disable @typescript-eslint/naming-convention */
const fileExtensionMap: { [key: string]: string } = {
    '.js': 'javascript',
    '.jsx': 'javascriptreact',
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.m': 'objective-c',
    '.h': 'objective-c',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.sql': 'sql',
    '.sh': 'shellscript',
    '.bash': 'shellscript',
    '.zsh': 'shellscript',
    '.ps1': 'powershell'
};
/* eslint-enable @typescript-eslint/naming-convention */

export function getLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return fileExtensionMap[ext] || 'plaintext';
}

export function getFileExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
}

export function isTextFile(fileName: string): boolean {
    const ext = getFileExtension(fileName);
    const binaryExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.zip', '.tar', '.gz', '.7z', '.rar',
        '.exe', '.dll', '.so', '.dylib',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp',
        '.mp3', '.mp4', '.avi', '.mov',
        '.ttf', '.otf', '.woff', '.woff2'
    ];
    return !binaryExtensions.includes(ext);
}

export function shouldIgnoreFile(fileName: string): boolean {
    const ignorePatterns = [
        /node_modules/,
        /\.git\//,
        /\.DS_Store$/,
        /Thumbs\.db$/
    ];
    return ignorePatterns.some(pattern => pattern.test(fileName));
}

export function getActiveEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
}

export function getActiveEditorLanguageId(editor: vscode.TextEditor): string | undefined {
    return editor.document.languageId;
}

export function getActiveEditorText(editor: vscode.TextEditor): string | undefined {
    return editor.document.getText();
} 