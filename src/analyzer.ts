import * as vscode from 'vscode';
import { CrossReferenceTracker } from './cross-references';

// Initialize cross-reference tracker as a singleton
const crossRefTracker = new CrossReferenceTracker();

export interface AnalyzerOptions {
    includeImports?: boolean;
    includeExports?: boolean;
    includeDependencies?: boolean;
    includeKeyPoints?: boolean;
    includeCrossReferences?: boolean;
    tailored?: boolean;
    aiSummaryStyle?: 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive';
    languageMap?: Record<string, string>;
}

export async function analyzeFile(
    document: vscode.TextDocument,
    options: AnalyzerOptions = {}
): Promise<{
    frameworks: string[];
    purpose: string;
    dependencies: string[];
    exports: string[];
    imports: string[];
    aiSummary?: string;
    keyPoints?: string[];
    crossReferences?: {
        referencedBy: any[];
        references: any[];
    };
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

    // Get cross-references if requested
    let crossReferences;
    if (options.includeCrossReferences) {
        crossReferences = await crossRefTracker.analyzeFile(document);
    }

    return {
        frameworks,
        purpose,
        dependencies,
        exports: options.includeExports ? exports : [],
        imports: options.includeImports ? imports : [],
        ...(options.includeKeyPoints ? { aiSummary, keyPoints } : {}),
        ...(options.includeCrossReferences ? { crossReferences } : {})
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

export function generateAISummary(
    content: string, 
    languageId: string, 
    style: 'minimal' | 'basic' | 'standard' | 'detailed' | 'comprehensive' = 'standard'
): { aiSummary: string; keyPoints: string[] } {
    const lines = content.split('\n');
    const firstNonEmptyLine = lines.find(line => line.trim().length > 0) || '';
    
    // Detect file purpose based on patterns
    const purposes: string[] = [];
    const keyPoints: string[] = [];
    
    // Enhanced React/Next.js detection with more specific component types
    if (languageId === 'typescriptreact' || languageId === 'javascriptreact') {
        if (content.includes('use client')) {
            purposes.push('Interactive Client Component');
        } else {
            purposes.push('Server-Rendered Component');
        }
        
        // More specific component type detection - included in basic and above
        if (style !== 'minimal') {
            if (content.includes('createContext')) purposes.push('providing Context');
            if (content.includes('useContext')) purposes.push('consuming Context');
            if (/layout\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Layout Component');
            if (/page\.[tj]sx?$/.test(firstNonEmptyLine)) purposes.push('Page Component');
            if (content.includes('loading')) purposes.push('with Loading State');
            if (content.includes('error')) purposes.push('with Error Handling');
        }
        
        // Form and data fetching detection - included in standard and above
        if (style !== 'minimal' && style !== 'basic') {
            if (content.includes('onSubmit') || content.includes('handleSubmit')) {
                purposes.push('handling Form Submission');
            }
            if (content.includes('getServerSideProps') || content.includes('getStaticProps')) {
                purposes.push('with Server-side Data Fetching');
            }
            if (content.includes('useEffect') && (content.includes('fetch') || content.includes('axios'))) {
                purposes.push('with Client-side Data Fetching');
            }
        }
    }

    // Enhanced API detection - basic features for minimal/basic, all features for others
    if (content.includes('@api') || content.includes('api/') || content.includes('route.ts')) {
        purposes.push('API Route');
        const methods = [];
        if (content.includes('GET')) methods.push('GET');
        if (content.includes('POST')) methods.push('POST');
        if (content.includes('PUT')) methods.push('PUT');
        if (content.includes('DELETE')) methods.push('DELETE');
        if (methods.length > 0) {
            purposes.push(`handling ${methods.join('/')} requests`);
        }
        
        // Additional API features for standard and above
        if (style !== 'minimal' && style !== 'basic') {
            if (content.includes('middleware')) purposes.push('with Request Middleware');
            if (content.includes('validate')) purposes.push('with Input Validation');
            if (content.includes('cache')) purposes.push('with Response Caching');
        }
    }

    // Testing detection - basic info for minimal/basic, detailed for others
    if (content.includes('test(') || content.includes('describe(')) {
        purposes.push('Test Suite');
        if (style !== 'minimal') {
            if (content.includes('integration')) purposes.push('for Integration Testing');
            if (content.includes('unit')) purposes.push('for Unit Testing');
            if (content.includes('e2e')) purposes.push('for End-to-End Testing');
            if (style !== 'basic' && content.includes('mock') || content.includes('spy')) {
                purposes.push('using Test Doubles');
            }
        }
    }

    // Type definitions - basic info for all levels, details for standard+
    if (content.includes('type ') || content.includes('interface ')) {
        purposes.push('Type Definitions');
        if (style !== 'minimal') {
            if (content.includes('extends')) purposes.push('with Type Extensions');
            if (content.includes('implements')) purposes.push('with Interface Implementations');
            if (style !== 'basic' && (content.includes('generic') || content.includes('<T>'))) {
                purposes.push('using Generics');
            }
        }
    }

    // Key points generation based on depth level
    if (style !== 'minimal') {
        // State management detection - basic info for basic, detailed for others
        if (content.includes('useState')) {
            const stateVars = content.match(/useState[<(][^>)]*[>)]?\([^)]*\)/g) || [];
            if (stateVars.length > 0) {
                keyPoints.push(`Manages ${stateVars.length} state variable${stateVars.length !== 1 ? 's' : ''}`);
            }
        }

        // Effect handling - standard and above
        if (style !== 'basic' && content.includes('useEffect')) {
            const effects = content.match(/useEffect\(/g) || [];
            const effectsWithDeps = content.match(/useEffect\([^[]*\[[^\]]*\]/g) || [];
            if (effects.length > 0) {
                keyPoints.push(`Contains ${effects.length} effect${effects.length !== 1 ? 's' : ''} (${effectsWithDeps.length} with dependencies)`);
            }
        }

        // API calls - standard and above
        if (style !== 'basic' && (content.includes('fetch(') || content.includes('axios'))) {
            const fetchCalls = (content.match(/fetch\(/g) || []).length;
            const axiosCalls = (content.match(/axios\./g) || []).length;
            if (fetchCalls + axiosCalls > 0) {
                const endpoints = content.match(/(fetch|axios\.get|axios\.post|axios\.put|axios\.delete)\(['"]([^'"]+)['"]/g) || [];
                keyPoints.push(`Makes ${fetchCalls + axiosCalls} API call${fetchCalls + axiosCalls !== 1 ? 's' : ''} to ${endpoints.length} unique endpoint${endpoints.length !== 1 ? 's' : ''}`);
            }
        }

        // Database operations - detailed and comprehensive only
        if ((style === 'detailed' || style === 'comprehensive') && 
            (content.includes('createClient') || content.includes('prisma') || content.includes('supabase'))) {
            const operations = [];
            if (content.includes('select') || content.includes('findMany') || content.includes('findFirst')) operations.push('queries');
            if (content.includes('insert') || content.includes('create')) operations.push('creates');
            if (content.includes('update') || content.includes('upsert')) operations.push('updates');
            if (content.includes('delete')) operations.push('deletes');
            
            if (operations.length > 0) {
                keyPoints.push(`Performs database operations: ${operations.join(', ')}`);
            }
        }

        // Security and environment - detailed and comprehensive only
        if ((style === 'detailed' || style === 'comprehensive') && content.includes('env.')) {
            const envVars = content.match(/process\.env\.[A-Z_]+/g) || [];
            if (envVars.length > 0) {
                keyPoints.push(`Uses ${envVars.length} environment variable${envVars.length !== 1 ? 's' : ''}`);
            }
        }

        // Authentication - detailed and comprehensive only
        if ((style === 'detailed' || style === 'comprehensive') && 
            (content.includes('auth') || content.includes('session'))) {
            const authFeatures = [];
            if (content.includes('login') || content.includes('signIn')) authFeatures.push('authentication');
            if (content.includes('role') || content.includes('permission')) authFeatures.push('authorization');
            if (authFeatures.length > 0) {
                keyPoints.push(`Implements ${authFeatures.join(' and ')}`);
            }
        }

        // Error handling - comprehensive only
        if (style === 'comprehensive' && content.includes('try {')) {
            const tryCatches = (content.match(/try\s*{/g) || []).length;
            const customErrors = content.includes('throw new Error') || content.includes('new CustomError');
            if (tryCatches > 0) {
                keyPoints.push(`Contains ${tryCatches} error handling block${tryCatches !== 1 ? 's' : ''}${customErrors ? ' with custom error handling' : ''}`);
            }
        }

        // TypeScript features - comprehensive only
        if (style === 'comprehensive' && (content.includes('export type') || content.includes('export interface'))) {
            const typeExports = (content.match(/export\s+(type|interface)/g) || []).length;
            const typeImports = (content.match(/import\s+type/g) || []).length;
            if (typeExports > 0 || typeImports > 0) {
                keyPoints.push(`Defines ${typeExports} type${typeExports !== 1 ? 's' : ''} and imports ${typeImports} type${typeImports !== 1 ? 's' : ''}`);
            }
        }

        // Performance optimizations - comprehensive only
        if (style === 'comprehensive' && (content.includes('useMemo') || content.includes('useCallback'))) {
            const memos = (content.match(/useMemo\(/g) || []).length;
            const callbacks = (content.match(/useCallback\(/g) || []).length;
            if (memos + callbacks > 0) {
                keyPoints.push(`Uses ${memos + callbacks} performance optimization${memos + callbacks !== 1 ? 's' : ''} (${memos} memoized values, ${callbacks} callbacks)`);
            }
        }

        // UI/UX features - based on depth level
        if (content.includes('className=')) {
            const features = [];
            if (content.includes('dark:')) features.push('dark mode support');
            if (content.includes('md:') || content.includes('lg:')) features.push('responsive design');
            if (style !== 'basic') {
                if (content.includes('animate-') || content.includes('transition-')) features.push('animations');
                if (content.includes('hover:') || content.includes('focus:')) features.push('interactive states');
            }
            if (features.length > 0) {
                if (style === 'comprehensive') {
                    features.forEach(feature => keyPoints.push(`Implements ${feature}`));
                } else {
                    keyPoints.push(`Includes ${features.join(', ')}`);
                }
            }
        }
    }

    // Generate summary based on style
    let summary = purposes.length > 0 
        ? purposes.join(' ')
        : 'General purpose file';

    // Add key functionality to summary based on depth level
    if (style !== 'minimal') {
        const keyFunctionality = keyPoints
            .filter(point => !point.startsWith('-'))
            .map(point => point.toLowerCase());

        if (style === 'comprehensive') {
            // Include all key points in detail
            if (keyFunctionality.length > 0) {
                summary += ' that:\n- ' + keyFunctionality.join('\n- ');
            }
        } else if (style === 'detailed') {
            // Include all key points in a single paragraph
            if (keyFunctionality.length > 0) {
                summary += ' that ' + keyFunctionality.join(', ');
            }
        } else if (style === 'standard') {
            // Include up to 3 main features
            const mainFeatures = keyFunctionality.slice(0, 3);
            if (mainFeatures.length > 0) {
                summary += ' with ' + mainFeatures.join(', ');
            }
        } else if (style === 'basic') {
            // Include only the most important feature
            if (keyFunctionality.length > 0) {
                summary += ' with ' + keyFunctionality[0];
            }
        }
    }
    
    return {
        aiSummary: summary,
        keyPoints: style === 'minimal' ? [] : 
                  style === 'basic' ? keyPoints.slice(0, 2) :
                  style === 'standard' ? keyPoints.slice(0, 5) :
                  style === 'detailed' ? keyPoints.slice(0, 10) :
                  keyPoints // comprehensive includes all points
    };
} 