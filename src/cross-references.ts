import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CrossReference, FileAnalysis } from './utils';

/**
 * Tracks and manages cross-references between files in the workspace
 */
export class CrossReferenceTracker {
    private crossRefMap = new Map<string, FileAnalysis['crossReferences']>();
    private workspaceRoot: string;

    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    }

    /**
     * Analyzes a file for cross-references and updates the tracking map
     */
    public async analyzeFile(document: vscode.TextDocument): Promise<FileAnalysis['crossReferences']> {
        const filePath = this.getRelativePath(document.uri.fsPath);
        const content = document.getText();
        const references: CrossReference[] = [];
        
        // Extract imports and dependencies
        const importMatches = Array.from(content.matchAll(/(?:import|require)\s*(?:{[^}]*}\s*from\s*)?['"]([^'"]+)['"]/g));
        
        for (const match of importMatches) {
            const [fullMatch, importPath] = match;
            if (!importPath.startsWith('.')) continue; // Skip non-relative imports
            
            const resolvedPath = this.resolveImportPath(filePath, importPath);
            if (!resolvedPath) continue;

            references.push({
                sourceFile: filePath,
                targetFile: resolvedPath,
                type: 'import',
                location: document.positionAt(match.index!),
                symbol: this.extractSymbols(fullMatch)
            });
        }

        // Update the cross-reference map
        this.updateCrossReferences(filePath, references);
        
        return this.crossRefMap.get(filePath);
    }

    /**
     * Updates cross-references for a file and its referenced files
     */
    private updateCrossReferences(filePath: string, references: CrossReference[]): void {
        // Initialize or update the file's references
        if (!this.crossRefMap.has(filePath)) {
            this.crossRefMap.set(filePath, { references: [], referencedBy: [] });
        }
        
        const fileRefs = this.crossRefMap.get(filePath)!;
        fileRefs.references = references;

        // Update the referencedBy arrays of target files
        for (const ref of references) {
            if (!this.crossRefMap.has(ref.targetFile)) {
                this.crossRefMap.set(ref.targetFile, { references: [], referencedBy: [] });
            }
            
            const targetRefs = this.crossRefMap.get(ref.targetFile)!;
            // Remove old references to this file
            targetRefs.referencedBy = targetRefs.referencedBy.filter(r => r.sourceFile !== filePath);
            // Add the new reference
            targetRefs.referencedBy.push(ref);
        }
    }

    /**
     * Gets cross-references for a specific file
     */
    public getCrossReferences(filePath: string): FileAnalysis['crossReferences'] | undefined {
        return this.crossRefMap.get(this.getRelativePath(filePath));
    }

    /**
     * Resolves a relative import path to an absolute workspace path
     */
    private resolveImportPath(sourceFile: string, importPath: string): string | undefined {
        try {
            const sourceDir = path.dirname(sourceFile);
            const resolvedPath = path.join(sourceDir, importPath);
            
            // Try common extensions if none provided
            const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
            for (const ext of extensions) {
                const fullPath = resolvedPath + ext;
                if (fs.existsSync(path.join(this.workspaceRoot, fullPath))) {
                    return this.getRelativePath(fullPath);
                }
            }
        } catch (error) {
            console.error('Error resolving import path:', error);
        }
        return undefined;
    }

    /**
     * Extracts imported/exported symbols from an import statement
     */
    private extractSymbols(importStatement: string): string | undefined {
        const symbolMatch = importStatement.match(/{([^}]+)}/);
        return symbolMatch ? symbolMatch[1].trim() : undefined;
    }

    /**
     * Converts an absolute path to a workspace-relative path
     */
    private getRelativePath(absolutePath: string): string {
        return path.relative(this.workspaceRoot, absolutePath).split(path.sep).join('/');
    }

    /**
     * Clears all tracked cross-references
     */
    public clear(): void {
        this.crossRefMap.clear();
    }
} 