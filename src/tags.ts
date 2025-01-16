import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents a tag that can be applied to files or directories
 */
export interface Tag {
    id: string;           // Unique identifier for the tag
    name: string;         // Display name
    color?: string;       // Optional color (hex code)
    description?: string; // Optional description
    scope: 'file' | 'directory' | 'both';  // What the tag can be applied to
    icon?: string;        // Optional VS Code icon identifier
}

/**
 * Represents a tag applied to a specific file or directory
 */
export interface AppliedTag extends Tag {
    appliedTo: string;    // Relative path of the file/directory
    appliedAt: string;    // ISO timestamp
    appliedBy?: string;   // Optional username
}

/**
 * Configuration for tag inheritance in directories
 */
export interface TagInheritanceConfig {
    enabled: boolean;     // Whether children inherit parent directory tags
    override: boolean;    // Whether child tags override parent tags
}

/**
 * Manages the tagging system for files and directories
 */
export class TagManager {
    private tags = new Map<string, Tag>();
    private appliedTags = new Map<string, AppliedTag[]>();
    private workspaceRoot: string;
    private configPath: string;
    private inheritanceConfig: TagInheritanceConfig;

    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.configPath = path.join(this.workspaceRoot, '.vscode', 'file-tags.json');
        this.inheritanceConfig = {
            enabled: true,
            override: false
        };
        this.loadTags();
    }

    /**
     * Loads tags from the workspace configuration
     */
    private loadTags(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.tags = new Map(config.tags.map((tag: Tag) => [tag.id, tag]));
                this.appliedTags = new Map(Object.entries(config.appliedTags));
                this.inheritanceConfig = config.inheritance || this.inheritanceConfig;
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }

    /**
     * Saves the current tag configuration
     */
    private saveTags(): void {
        try {
            const config = {
                tags: Array.from(this.tags.values()),
                appliedTags: Object.fromEntries(this.appliedTags),
                inheritance: this.inheritanceConfig
            };
            
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving tags:', error);
        }
    }

    /**
     * Creates a new tag
     */
    public createTag(tag: Omit<Tag, 'id'>): Tag {
        const id = this.generateTagId(tag.name);
        const newTag: Tag = { ...tag, id };
        this.tags.set(id, newTag);
        this.saveTags();
        return newTag;
    }

    /**
     * Applies a tag to a file or directory
     */
    public applyTag(tagId: string, targetPath: string): AppliedTag | undefined {
        const tag = this.tags.get(tagId);
        if (!tag) return undefined;

        const relativePath = this.getRelativePath(targetPath);
        const isDirectory = fs.statSync(path.join(this.workspaceRoot, relativePath)).isDirectory();
        
        if ((tag.scope === 'file' && isDirectory) || (tag.scope === 'directory' && !isDirectory)) {
            return undefined;
        }

        const appliedTag: AppliedTag = {
            ...tag,
            appliedTo: relativePath,
            appliedAt: new Date().toISOString(),
            appliedBy: process.env.USER
        };

        const existing = this.appliedTags.get(relativePath) || [];
        this.appliedTags.set(relativePath, [...existing, appliedTag]);
        this.saveTags();
        
        return appliedTag;
    }

    /**
     * Gets all tags applied to a file or directory, including inherited tags
     */
    public getAppliedTags(targetPath: string): AppliedTag[] {
        const relativePath = this.getRelativePath(targetPath);
        const directTags = this.appliedTags.get(relativePath) || [];

        if (!this.inheritanceConfig.enabled) {
            return directTags;
        }

        // Get inherited tags from parent directories
        const parentTags: AppliedTag[] = [];
        let currentPath = path.dirname(relativePath);
        
        while (currentPath !== '.') {
            const parentDirectoryTags = this.appliedTags.get(currentPath) || [];
            parentTags.push(...parentDirectoryTags);
            currentPath = path.dirname(currentPath);
        }

        if (this.inheritanceConfig.override) {
            // Child tags override parent tags with the same ID
            const usedIds = new Set(directTags.map(tag => tag.id));
            return [
                ...directTags,
                ...parentTags.filter(tag => !usedIds.has(tag.id))
            ];
        }

        return [...directTags, ...parentTags];
    }

    /**
     * Removes a tag from a file or directory
     */
    public removeTag(tagId: string, targetPath: string): boolean {
        const relativePath = this.getRelativePath(targetPath);
        const existing = this.appliedTags.get(relativePath) || [];
        const filtered = existing.filter(tag => tag.id !== tagId);
        
        if (filtered.length === existing.length) {
            return false;
        }

        if (filtered.length === 0) {
            this.appliedTags.delete(relativePath);
        } else {
            this.appliedTags.set(relativePath, filtered);
        }

        this.saveTags();
        return true;
    }

    /**
     * Gets all available tags
     */
    public getAllTags(): Tag[] {
        return Array.from(this.tags.values());
    }

    /**
     * Updates the inheritance configuration
     */
    public updateInheritanceConfig(config: Partial<TagInheritanceConfig>): void {
        this.inheritanceConfig = { ...this.inheritanceConfig, ...config };
        this.saveTags();
    }

    /**
     * Generates a unique tag ID from a name
     */
    private generateTagId(name: string): string {
        const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        let id = base;
        let counter = 1;
        
        while (this.tags.has(id)) {
            id = `${base}-${counter++}`;
        }
        
        return id;
    }

    /**
     * Converts an absolute path to a workspace-relative path
     */
    private getRelativePath(absolutePath: string): string {
        return path.relative(this.workspaceRoot, absolutePath).split(path.sep).join('/');
    }
} 