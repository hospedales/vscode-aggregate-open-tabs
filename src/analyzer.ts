import * as vscode from 'vscode';
import * as path from 'path';
import { FileAnalysis, CrossReference } from './types';

interface DirectoryContext {
    parent: string;
    siblings: string[];
    children: string[];
}

export async function analyzeFile(document: vscode.TextDocument): Promise<FileAnalysis> {
    const content = document.getText();
    const filePath = document.uri.fsPath;
    const analysis: FileAnalysis = {};

    // Detect purpose
    analysis.purpose = detectPurpose(content);

    // Detect frameworks
    analysis.frameworks = detectFrameworks(content);

    // Detect dependencies
    analysis.dependencies = detectDependencies(content);

    // Analyze cross-references
    analysis.crossReferences = {
        references: findReferences(content),
        referencedBy: [] // This will be populated in the second pass
    };

    // Get directory context
    const dirContext = await getDirectoryContext(filePath);
    analysis.relationships = {
        imports: [],
        exports: [],
        dependencies: dirContext.children.map(child => ({ file: child, type: 'child' }))
    };

    // Calculate complexity metrics
    analysis.complexity = calculateComplexity(content);

    // Analyze documentation
    analysis.documentation = {
        comments: countComments(content),
        jsdoc: countJSDoc(content),
        markdown: countMarkdown(content)
    };

    // Check for sensitive patterns
    analysis.security = {
        sensitivePatterns: detectSensitivePatterns(content),
        dataAccess: detectDataAccess(content)
    };

    return analysis;
}

function detectPurpose(content: string): string {
    // Simple heuristics for now - this could be enhanced with AI
    if (content.includes('test') || content.includes('spec')) {
        return 'Test file';
    }
    if (content.includes('interface') || content.includes('type ')) {
        return 'Type definitions';
    }
    if (content.includes('component') || content.includes('React')) {
        return 'React component';
    }
    return 'Source file';
}

function detectFrameworks(content: string): string[] {
    const frameworks: string[] = [];
    
    if (content.includes('React')) {
        frameworks.push('React');
    }
    if (content.includes('angular')) {
        frameworks.push('Angular');
    }
    if (content.includes('vue')) {
        frameworks.push('Vue');
    }
    if (content.includes('express')) {
        frameworks.push('Express');
    }
    if (content.includes('next')) {
        frameworks.push('Next.js');
    }
    
    return frameworks;
}

function detectDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importRegex = /import .* from ['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        if (!dependencies.includes(match[1])) {
            dependencies.push(match[1]);
        }
    }
    
    while ((match = requireRegex.exec(content)) !== null) {
        if (!dependencies.includes(match[1])) {
            dependencies.push(match[1]);
        }
    }
    
    return dependencies;
}

function findReferences(content: string): CrossReference[] {
    const references: CrossReference[] = [];
    const importRegex = /import .* from ['"]([^'"]+)['"]/g;
    const exportRegex = /export .* to ['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        references.push({
            file: match[1],
            type: 'import',
            context: match[0]
        });
    }
    while ((match = exportRegex.exec(content)) !== null) {
        references.push({
            file: match[1],
            type: 'export',
            context: match[0]
        });
    }
    
    return references;
}

async function getDirectoryContext(filePath: string): Promise<DirectoryContext> {
    const dir = path.dirname(filePath);
    const parent = path.dirname(dir);
    
    return {
        parent: path.relative(vscode.workspace.rootPath || '', parent),
        siblings: await getSiblingFiles(dir),
        children: await getChildFiles(dir)
    };
}

async function getSiblingFiles(dir: string): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        const files = entries.map(([name]) => name);
        const filteredFiles = files.filter(f => !f.startsWith('.'));
        return filteredFiles.map(f => path.relative(vscode.workspace.rootPath || '', path.join(dir, f)));
    } catch {
        return [];
    }
}

async function getChildFiles(dir: string): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        const dirs = entries
            .filter(([, type]) => type === vscode.FileType.Directory)
            .map(([name]) => name);
        const filteredDirs = dirs.filter(d => !d.startsWith('.'));
        return filteredDirs.map(d => path.relative(vscode.workspace.rootPath || '', path.join(dir, d)));
    } catch {
        return [];
    }
}

function calculateComplexity(content: string): FileAnalysis['complexity'] {
    return {
        cognitive: calculateCognitiveComplexity(content),
        cyclomatic: calculateCyclomaticComplexity(content),
        lines: content.split('\n').length
    };
}

function calculateCognitiveComplexity(content: string): number {
    // Simple implementation - count control structures
    const controlStructures = [
        'if', 'else', 'for', 'while', 'do', 'switch', 'case',
        'try', 'catch', 'finally', '?', '&&', '||'
    ];
    
    return controlStructures.reduce((sum, structure) => {
        const regex = new RegExp(`\\b${structure}\\b`, 'g');
        const matches = content.match(regex);
        return sum + (matches ? matches.length : 0);
    }, 0);
}

function calculateCyclomaticComplexity(content: string): number {
    // Simple implementation - count decision points
    const decisionPoints = [
        'if', 'else if', 'case', 'default', 'for', 'while',
        'catch', '&&', '\\|\\|', '\\?'
    ];
    
    return decisionPoints.reduce((sum, point) => {
        const regex = new RegExp(`\\b${point}\\b`, 'g');
        const matches = content.match(regex) || [];
        return sum + matches.length;
    }, 1); // Base complexity of 1
}

function countComments(content: string): number {
    const singleLineComments = (content.match(/\/\/.*/g) || []).length;
    const multiLineComments = (content.match(/\/\*[\s\S]*?\*\//g) || []).length;
    return singleLineComments + multiLineComments;
}

function countJSDoc(content: string): number {
    return (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
}

function countMarkdown(content: string): number {
    return (content.match(/```[\s\S]*?```/g) || []).length;
}

function detectSensitivePatterns(content: string): string[] {
    const patterns = [];
    if (content.match(/password|secret|key|token|credential/i)) {
        patterns.push('potential credentials');
    }
    if (content.match(/api[_-]?key/i)) {
        patterns.push('API key');
    }
    return patterns;
}

function detectDataAccess(content: string): string[] {
    const patterns = [];
    if (content.match(/database|db\.|sql|query/i)) {
        patterns.push('database access');
    }
    if (content.match(/fetch|axios|http|request/i)) {
        patterns.push('network requests');
    }
    return patterns;
}