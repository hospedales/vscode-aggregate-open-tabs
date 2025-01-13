import * as vscode from 'vscode';

export interface AnalyzeOptions {
    tailored?: boolean;
    includeKeyPoints?: boolean;
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    aiSummaryStyle?: 'concise' | 'detailed';
    languageMap?: Record<string, string>;
}

export async function analyzeFile(
    document: vscode.TextDocument,
    options: AnalyzeOptions = {}
): Promise<{
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
    
    // Only extract imports/exports/dependencies if requested
    const { exports, imports } = options.includeImports || options.includeExports ? 
        extractExportsAndImports(content) : 
        { exports: [], imports: [] };
    
    const dependencies = options.includeDependencies ? 
        extractDependencies(content) : 
        [];

    // Generate AI summary with specified style
    const { aiSummary, keyPoints } = options.includeKeyPoints ? 
        generateAISummary(content, document.languageId, options.aiSummaryStyle) : 
        { aiSummary: undefined, keyPoints: undefined };

    return {
        frameworks,
        purpose,
        dependencies,
        exports: options.includeExports ? exports : [],
        imports: options.includeImports ? imports : [],
        ...(options.includeKeyPoints ? { aiSummary, keyPoints } : {})
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

export function generateAISummary(content: string, languageId: string, style: 'concise' | 'detailed' = 'detailed'): { aiSummary: string; keyPoints: string[] } {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0) || '';
    
    // Detect file purpose based on patterns
    const purposes: string[] = [];
    
    // Enhanced React/Next.js detection
    if (languageId === 'typescriptreact' || languageId === 'javascriptreact') {
        if (content.includes('use client')) {
            purposes.push('Interactive Client Component');
        } else {
            purposes.push('Server-Rendered Component');
        }
        
        // Component type detection
        if (content.includes('createContext')) purposes.push('with Context Management');
        if (content.includes('useContext')) purposes.push('using Context');
        if (/layout\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Layout Component');
        if (/page\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Page Component');
        if (content.includes('loading')) purposes.push('Loading State Handler');
        if (content.includes('error')) purposes.push('Error Boundary');
    }
    
    // Enhanced API detection
    if (content.includes('@api') || content.includes('api/')) {
        purposes.push('API Route');
        if (content.includes('GET')) purposes.push('handling GET requests');
        if (content.includes('POST')) purposes.push('handling POST requests');
        if (content.includes('PUT')) purposes.push('handling PUT requests');
        if (content.includes('DELETE')) purposes.push('handling DELETE requests');
    }

    // Enhanced testing detection
    if (content.includes('test(') || content.includes('describe(')) {
        purposes.push('Test Suite');
        if (content.includes('integration')) purposes.push('for Integration Tests');
        if (content.includes('unit')) purposes.push('for Unit Tests');
        if (content.includes('e2e')) purposes.push('for E2E Tests');
    }

    // Enhanced type detection
    if (content.includes('type ') || content.includes('interface ')) {
        purposes.push('Type Definitions');
        if (content.includes('extends')) purposes.push('with Type Extensions');
        if (content.includes('implements')) purposes.push('with Interface Implementations');
    }
    
    // Generate detailed key points
    const keyPoints: string[] = [];
    
    // State management
    if (content.includes('useState')) {
        const stateVars = content.match(/useState[<(][^>)]*[>)]?\([^)]*\)/g) || [];
        keyPoints.push(`Manages ${stateVars.length} state variable${stateVars.length !== 1 ? 's' : ''}`);
    }

    // Effect handling
    if (content.includes('useEffect')) {
        const effects = content.match(/useEffect\(/g) || [];
        keyPoints.push(`Has ${effects.length} side effect${effects.length !== 1 ? 's' : ''}`);
    }

    // API calls
    if (content.includes('fetch(') || content.includes('axios')) {
        const fetchCalls = (content.match(/fetch\(/g) || []).length;
        const axiosCalls = (content.match(/axios\./g) || []).length;
        keyPoints.push(`Makes ${fetchCalls + axiosCalls} API call${fetchCalls + axiosCalls !== 1 ? 's' : ''}`);
    }

    // Database operations
    if (content.includes('createClient') || content.includes('prisma') || content.includes('supabase')) {
        keyPoints.push('Performs database operations');
        if (style === 'detailed') {
            if (content.includes('select')) keyPoints.push('- Queries data');
            if (content.includes('insert')) keyPoints.push('- Inserts records');
            if (content.includes('update')) keyPoints.push('- Updates records');
            if (content.includes('delete')) keyPoints.push('- Deletes records');
        }
    }

    // Security and environment
    if (content.includes('env.')) keyPoints.push('Uses environment variables for configuration');
    if (content.includes('auth') || content.includes('session')) keyPoints.push('Implements authentication/authorization');

    // Error handling
    if (content.includes('try {')) {
        const tryCatches = (content.match(/try\s*{/g) || []).length;
        keyPoints.push(`Contains ${tryCatches} error handling block${tryCatches !== 1 ? 's' : ''}`);
    }

    // TypeScript features
    if (content.includes('export type') || content.includes('export interface')) {
        const typeExports = (content.match(/export\s+(type|interface)/g) || []).length;
        if (style === 'detailed') {
            keyPoints.push(`Exports ${typeExports} type definition${typeExports !== 1 ? 's' : ''}`);
        } else {
            keyPoints.push('Exports type definitions');
        }
    }

    // Performance optimizations
    if (content.includes('useMemo') || content.includes('useCallback')) {
        const memos = (content.match(/useMemo\(/g) || []).length;
        const callbacks = (content.match(/useCallback\(/g) || []).length;
        if (style === 'detailed') {
            keyPoints.push(`Uses ${memos + callbacks} performance optimization${memos + callbacks !== 1 ? 's' : ''}`);
        } else {
            keyPoints.push('Includes performance optimizations');
        }
    }

    // UI/UX features
    if (content.includes('className=')) {
        const features = [];
        if (content.includes('dark:')) features.push('dark mode support');
        if (content.includes('md:') || content.includes('lg:')) features.push('responsive design');
        if (content.includes('animate-') || content.includes('transition-')) features.push('animations');
        if (features.length > 0) {
            if (style === 'detailed') {
                features.forEach(feature => keyPoints.push(`Implements ${feature}`));
            } else {
                keyPoints.push(`Includes ${features.join(', ')}`);
            }
        }
    }
    
    // Generate a summary based on style
    let summary = purposes.length > 0 
        ? purposes.join(' ')
        : 'Utility file';

    if (style === 'detailed') {
        // Add key functionality to summary
        const keyFunctionality = keyPoints
            .filter(point => !point.startsWith('-')) // Filter out sub-points
            .map(point => point.toLowerCase())
            .join(', ');

        if (keyFunctionality) {
            summary += ` that ${keyFunctionality}`;
        }
    } else {
        // For concise style, keep only the main purpose and most important features
        const mainFeatures = keyPoints
            .filter(point => !point.startsWith('-'))
            .slice(0, 2) // Take only the first two main features
            .map(point => point.toLowerCase());

        if (mainFeatures.length > 0) {
            summary += ` with ${mainFeatures.join(' and ')}`;
        }
    }
    
    return {
        aiSummary: summary,
        keyPoints: style === 'detailed' ? keyPoints : keyPoints.filter(point => !point.startsWith('-'))
    };
} 