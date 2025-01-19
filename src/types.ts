export interface CrossReference {
    file: string;
    type: string;
    context?: string;
    sourceFile?: string;
    targetFile?: string;
    location?: {
        line: number;
        character: number;
    };
    symbol?: string;
}

export interface CrossReferences {
    references: CrossReference[];
    referencedBy: CrossReference[];
}

export interface FrameworkDetails {
    react?: {
        hooks: string[];
        components: string[];
    };
    nextjs?: {
        isServerComponent: boolean;
        routes: string[];
    };
    [key: string]: unknown;
}

export interface FileAnalysis {
    purpose?: string;
    frameworks?: string[];
    frameworkDetails?: FrameworkDetails;
    dependencies?: string[];
    crossReferences?: CrossReferences;
    aiSummary?: string;
    keyPoints?: string[];
    imports?: string[];
    exports?: string[];
    complexity?: {
        cognitive: number;
        cyclomatic: number;
        lines: number;
        functions?: number;
    };
    documentation?: {
        comments: number;
        jsdoc: number;
        markdown: number;
        readme?: boolean;
        license?: boolean;
    };
    security?: {
        sensitivePatterns: string[];
        dataAccess: string[];
        authRelated?: boolean;
    };
    relationships?: {
        imports: { file: string; symbols: string[] }[];
        exports: { file: string; symbols: string[] }[];
        dependencies: { file: string; type: string }[];
    };
    tags?: string[];
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

export interface FormatOptions {
    chunkSize?: number;
    extraSpacing?: boolean;
    codeFenceLanguageMap?: Record<string, string>;
    chunkSeparatorStyle?: 'double' | 'single' | 'minimal';
    useCodeFences?: boolean;
    enhancedSummaries?: boolean;
    tailoredSummaries?: boolean;
    includeKeyPoints?: boolean;
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    includeCrossReferences?: boolean;
    includeTags?: boolean;
    aiSummaryStyle?: 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive';
    redactSensitiveData?: boolean;
} 