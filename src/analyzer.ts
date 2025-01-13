import * as vscode from 'vscode';

export async function analyzeFile(document: vscode.TextDocument): Promise<{
    frameworks: string[];
    purpose: string;
    dependencies: string[];
    exports: string[];
    imports: string[];
    aiSummary?: string;
    keyPoints?: string[];
}> {
    const content = document.getText();
    const frameworks = detectFrameworks(content);
    const purpose = determinePurpose(document.fileName, content, document.languageId);
    const { exports, imports } = extractExportsAndImports(content);
    const dependencies = extractDependencies(content);
    const { aiSummary, keyPoints } = generateAISummary(content, document.languageId);

    return {
        frameworks,
        purpose,
        dependencies,
        exports,
        imports,
        aiSummary,
        keyPoints
    };
}

function detectFrameworks(content: string): string[] {
    const frameworks: string[] = [];

    // React/Next.js detection
    if (content.includes('from \'react\'') || content.includes('from "react"')) {
        frameworks.push('React');
        if (content.includes('next/') || content.includes('from \'next\'') || content.includes('from "next"')) {
            frameworks.push('Next.js');
        }
    }

    // Tailwind detection
    if (content.includes('className=') && (
        /className=["'].*?tw-.*?["']/.test(content) ||
        /className=["'].*?(bg-|text-|flex|grid|p-|m-).*?["']/.test(content)
    )) {
        frameworks.push('Tailwind CSS');
    }

    // Shadcn/Radix detection
    if (content.includes('@radix-ui/') || content.includes('from \'@radix-ui/')) {
        frameworks.push('Radix UI');
        if (content.includes('shadcn') || content.includes('components/ui/')) {
            frameworks.push('Shadcn UI');
        }
    }

    // Supabase detection
    if (content.includes('@supabase/') || content.includes('createClient') || content.includes('supabase')) {
        frameworks.push('Supabase');
    }

    // Additional framework detection
    if (content.includes('from \'@prisma/client\'') || content.includes('PrismaClient')) {
        frameworks.push('Prisma');
    }
    if (content.includes('from \'@trpc/')) {
        frameworks.push('tRPC');
    }
    if (content.includes('from \'zod\'') || content.includes('z.object')) {
        frameworks.push('Zod');
    }
    if (content.includes('from \'@tanstack/react-query\'')) {
        frameworks.push('React Query');
    }
    if (content.includes('from \'@auth/')) {
        frameworks.push('NextAuth.js');
    }
    if (content.includes('from \'@vercel/')) {
        frameworks.push('Vercel SDK');
    }

    return frameworks;
}

function extractExportsAndImports(content: string): { exports: string[]; imports: string[] } {
    const exports: string[] = [];
    const imports: string[] = [];

    // Extract exports with improved patterns
    const exportPatterns = [
        /export\s+(default\s+)?(function|class|const|interface|type|let|var)\s+(\w+)/g,
        /export\s+{\s*([\w\s,]+)\s*}/g,
        /export\s+default\s+{\s*([\w\s,]+)\s*}/g,
        /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
        /export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
    ];

    for (const pattern of exportPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (pattern.toString().includes('export\\s+{')) {
                // Handle named exports
                exports.push(...match[1].split(',').map(name => name.trim()));
            } else if (pattern.toString().includes('export\\s+\\*')) {
                // Handle re-exports
                if (match[1]) exports.push(match[1]); // Named re-export
                if (match[2]) imports.push(match[2]); // Add the source to imports
            } else if (match[3]) {
                // Handle direct exports
                exports.push(match[3]);
            }
        }
    }

    // Extract imports with improved patterns
    const importPatterns = [
        /import\s+{?\s*([\w\s,*]+)\s*}?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+(\w+)\s*,\s*{\s*([\w\s,]+)\s*}\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+type\s+{\s*([\w\s,]+)\s*}\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g // Side-effect imports
    ];

    for (const pattern of importPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match[2] || match[1]) {
                imports.push(match[2] || match[1]);
            }
        }
    }

    return {
        exports: [...new Set(exports)],
        imports: [...new Set(imports)]
    };
}

function extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const patterns = [
        /from\s+['"]([^'"./][^'"]+)['"]/g,
        /require\(['"]([^'"./][^'"]+)['"]\)/g,
        /import\s+['"]([^'"./][^'"]+)['"]/g
    ];

    for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
            if (match[1]) {
                // Get the package name (before any path segments)
                const packageName = match[1].split('/')[0];
                dependencies.push(packageName);
            }
        }
    }

    return [...new Set(dependencies)];
}

function determinePurpose(fileName: string, content: string, languageId: string): string {
    // Check file name patterns first
    const filePatterns = [
        { pattern: /page\.[tj]sx?$/, purpose: 'Next.js page component' },
        { pattern: /layout\.[tj]sx?$/, purpose: 'Next.js layout component' },
        { pattern: /loading\.[tj]sx?$/, purpose: 'Next.js loading component' },
        { pattern: /error\.[tj]sx?$/, purpose: 'Next.js error component' },
        { pattern: /not-found\.[tj]sx?$/, purpose: 'Next.js 404 component' },
        { pattern: /route\.[tj]s$/, purpose: 'Next.js API route' },
        { pattern: /middleware\.[tj]s$/, purpose: 'Next.js middleware' },
        { pattern: /\.test\.[tj]sx?$/, purpose: 'Test file' },
        { pattern: /\.spec\.[tj]sx?$/, purpose: 'Test file' },
        { pattern: /\.d\.ts$/, purpose: 'TypeScript declarations' },
        { pattern: /types?\.[tj]s$/, purpose: 'Type definitions' },
        { pattern: /utils?\.[tj]s$/, purpose: 'Utility functions' },
        { pattern: /helpers?\.[tj]s$/, purpose: 'Helper functions' },
        { pattern: /context\.[tj]sx?$/, purpose: 'React context provider' },
        { pattern: /hooks?\.[tj]s$/, purpose: 'React custom hook' },
        { pattern: /store\.[tj]s$/, purpose: 'State management store' },
        { pattern: /api\.[tj]s$/, purpose: 'API client/service' },
        { pattern: /config\.[tj]s$/, purpose: 'Configuration file' },
        { pattern: /constants?\.[tj]s$/, purpose: 'Constants/enums file' },
        { pattern: /styles?\.[tj]s$/, purpose: 'Styles file' }
    ];

    for (const { pattern, purpose } of filePatterns) {
        if (pattern.test(fileName)) {
            return purpose;
        }
    }

    // Check content patterns
    const contentPatterns = [
        { pattern: /(export\s+type|export\s+interface)/, purpose: 'Type definitions' },
        { pattern: /createContext/, purpose: 'React context provider' },
        { pattern: /function\s+use\w+\s*\([^)]*\)\s*{[^}]*return\s*\[/, purpose: 'React custom hook' },
        { pattern: /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*:\s*.*?React/, purpose: 'React component' },
        { pattern: /(fetch|axios)\.(get|post|put|delete)/, purpose: 'API client/service' },
        { pattern: /class\s+\w+Controller/, purpose: 'API controller' },
        { pattern: /class\s+\w+Service/, purpose: 'Service layer' },
        { pattern: /class\s+\w+Repository/, purpose: 'Data repository' },
        { pattern: /describe\s*\(.*?,\s*function\s*\(/, purpose: 'Test suite' },
        { pattern: /configureStore|createStore|createSlice/, purpose: 'Redux store' },
        { pattern: /makeObservable|observable|action/, purpose: 'MobX store' },
        { pattern: /createClient|PrismaClient/, purpose: 'Database client' }
    ];

    for (const { pattern, purpose } of contentPatterns) {
        if (pattern.test(content)) {
            return purpose;
        }
    }

    // Default purpose based on language
    switch (languageId) {
        case 'typescript':
        case 'javascript':
            return 'General purpose script';
        case 'typescriptreact':
        case 'javascriptreact':
            return 'React component';
        case 'json':
            return 'Configuration file';
        case 'css':
        case 'scss':
            return 'Styles file';
        case 'markdown':
        case 'mdx':
            return 'Documentation';
        case 'yaml':
        case 'yml':
            return 'Configuration file';
        case 'sql':
            return 'Database queries';
        case 'prisma':
            return 'Prisma schema';
        default:
            return 'General purpose file';
    }
}

export function generateAISummary(content: string, languageId: string): { aiSummary: string; keyPoints: string[] } {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0) || '';
    
    // Detect file purpose based on patterns
    const purposes: string[] = [];
    
    if (languageId === 'typescriptreact' || languageId === 'javascriptreact') {
        if (content.includes('use client')) purposes.push('Client Component');
        if (!content.includes('use client')) purposes.push('Server Component');
        if (content.includes('createContext')) purposes.push('Context Provider');
        if (content.includes('useContext')) purposes.push('Context Consumer');
        if (/layout\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Layout Component');
        if (/page\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Page Component');
    }
    
    if (content.includes('@api') || content.includes('api/')) purposes.push('API Route');
    if (content.includes('test(') || content.includes('describe(')) purposes.push('Test File');
    if (content.includes('middleware')) purposes.push('Middleware');
    if (content.includes('type ') || content.includes('interface ')) purposes.push('Type Definitions');
    
    // Generate key points
    const keyPoints: string[] = [];
    
    // Check for important patterns
    if (content.includes('fetch(')) keyPoints.push('Makes API calls');
    if (content.includes('useEffect')) keyPoints.push('Has side effects');
    if (content.includes('useState')) keyPoints.push('Manages local state');
    if (content.includes('createClient')) keyPoints.push('Creates database client');
    if (content.includes('env.')) keyPoints.push('Uses environment variables');
    if (content.includes('throw new Error')) keyPoints.push('Has error handling');
    if (content.includes('try {')) keyPoints.push('Uses try-catch blocks');
    if (content.includes('async')) keyPoints.push('Contains asynchronous operations');
    if (content.includes('export type') || content.includes('export interface')) keyPoints.push('Exports type definitions');
    if (content.includes('import type')) keyPoints.push('Imports type definitions');
    if (content.includes('extends ')) keyPoints.push('Uses inheritance/type extensions');
    if (content.includes('implements ')) keyPoints.push('Implements interfaces');
    if (content.includes('private ') || content.includes('protected ')) keyPoints.push('Uses access modifiers');
    if (content.includes('static ')) keyPoints.push('Contains static members');
    if (content.includes('readonly ')) keyPoints.push('Uses readonly properties');
    if (content.includes('as const')) keyPoints.push('Uses const assertions');
    if (content.includes('satisfies ')) keyPoints.push('Uses type satisfaction');
    
    // Generate a concise summary
    const summary = purposes.length > 0 
        ? `${purposes.join(' and ')} that ${keyPoints.length > 0 ? keyPoints.join(', ').toLowerCase() : 'provides core functionality'}`
        : `Utility file that ${keyPoints.length > 0 ? keyPoints.join(', ').toLowerCase() : 'provides helper functions'}`;
    
    return {
        aiSummary: summary,
        keyPoints
    };
} 