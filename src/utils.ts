import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { AppliedTag } from './tags';

export interface CrossReference {
    sourceFile: string;
    targetFile: string;
    type: 'import' | 'export' | 'dependency';
    location: {
        line: number;
        character: number;
    };
    symbol?: string;  // The specific symbol being referenced
}

export interface FileAnalysis {
    purpose?: string;
    frameworks: string[];
    dependencies: string[];
    imports: string[];
    exports: string[];
    aiSummary?: string;
    keyPoints?: string[];
    crossReferences?: {
        referencedBy: any[];
        references: any[];
    };
    tags?: AppliedTag[];
}

export interface FileMetadata {
    fileName: string;
    relativePath?: string;
    content: string;
    size: number;
    lastModified: string;
    languageId: string;
    chunkInfo?: string;
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
    extraSpacing: boolean;
    enhancedSummaries: boolean;
    chunkSize: number;
    includeAiSummaries?: boolean;
    includeKeyPoints?: boolean;
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    chunkSeparatorStyle?: 'double' | 'single' | 'minimal';
    codeFenceLanguageMap?: Record<string, string>;
    tailoredSummaries?: boolean;
}

export function getFileMetadata(filePath: string, content: string, languageId: string): FileMetadata {
    const stats = fs.statSync(filePath);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    // Normalize paths and ensure they use forward slashes
    const normalizedWorkspace = path.normalize(workspaceRoot).split(path.sep).join('/');
    const normalizedFilePath = path.normalize(filePath).split(path.sep).join('/');
    
    // Get the relative path by removing the workspace root
    const relativePath = normalizedFilePath.startsWith(normalizedWorkspace) 
        ? normalizedFilePath.slice(normalizedWorkspace.length + 1) 
        : path.relative(normalizedWorkspace, normalizedFilePath).split(path.sep).join('/');
    
    return {
        fileName: path.basename(filePath),
        relativePath,
        content,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        languageId,
        analysis: {
            frameworks: [],
            dependencies: [],
            imports: [],
            exports: []
        }
    };
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
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
        '.h': 'c',
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
        '.sh': 'shell',
        '.bash': 'shell',
        '.zsh': 'shell',
        '.ps1': 'powershell'
    };
    return languageMap[ext] || 'plaintext';
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