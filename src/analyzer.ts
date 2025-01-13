import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';

interface FrameworkSignature {
    name: string;
    patterns: RegExp[];
    filePatterns?: string[];
    dependencies?: string[];
}

interface FileAnalysis {
    frameworks: string[];
    purpose: string;
    dependencies: string[];
    exports: string[];
    imports: string[];
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
    {
        name: 'React',
        patterns: [
            /import\s+.*?from\s+['"]react['"]/,
            /import\s+.*?from\s+['"]react-dom['"]/,
            /React\.(Component|useState|useEffect)/,
            /function\s+\w+\s*\(.*?\)\s*:\s*.*?React/
        ],
        dependencies: ['react', 'react-dom']
    },
    {
        name: 'Next.js',
        patterns: [
            /import\s+.*?from\s+['"]next['"]/,
            /import\s+.*?from\s+['"]next\/.*?['"]/,
            /export\s+default\s+function\s+Page/,
            /getStaticProps|getServerSideProps|getInitialProps/
        ],
        filePatterns: ['pages/**/*', 'app/**/*'],
        dependencies: ['next']
    },
    {
        name: 'Vue',
        patterns: [
            /import\s+.*?from\s+['"]vue['"]/,
            /@Vue\s*\(/,
            /createApp\s*\(/,
            /defineComponent\s*\(/
        ],
        dependencies: ['vue']
    },
    {
        name: 'Angular',
        patterns: [
            /import\s+.*?from\s+['"]@angular\/.*?['"]/,
            /@Component\s*\(/,
            /@Injectable\s*\(/,
            /implements\s+OnInit/
        ],
        dependencies: ['@angular/core']
    },
    {
        name: 'Express',
        patterns: [
            /import\s+.*?from\s+['"]express['"]/,
            /express\(\s*\)/,
            /app\.(get|post|put|delete)\s*\(/,
            /express\.Router\(\s*\)/
        ],
        dependencies: ['express']
    },
    {
        name: 'TypeORM',
        patterns: [
            /import\s+.*?from\s+['"]typeorm['"]/,
            /@Entity\s*\(/,
            /@Column\s*\(/,
            /@ManyToOne\s*\(/
        ],
        dependencies: ['typeorm']
    },
    {
        name: 'Prisma',
        patterns: [
            /import\s+.*?from\s+['"]@prisma\/client['"]/,
            /PrismaClient\s*\(/,
            /prisma\.(findMany|findUnique|create|update)/
        ],
        dependencies: ['@prisma/client']
    },
    {
        name: 'Tailwind CSS',
        patterns: [
            /className\s*=\s*["'].*?(bg-|text-|flex|grid|p-|m-)/,
            /@tailwind\s+(base|components|utilities)/
        ],
        dependencies: ['tailwindcss']
    }
];

const FILE_PURPOSE_PATTERNS = [
    {
        pattern: /export\s+default\s+function\s+Page/,
        purpose: 'Next.js page component'
    },
    {
        pattern: /export\s+default\s+function\s+layout/i,
        purpose: 'Next.js layout component'
    },
    {
        pattern: /export\s+default\s+function\s+error/i,
        purpose: 'Next.js error boundary'
    },
    {
        pattern: /export\s+default\s+function\s+loading/i,
        purpose: 'Next.js loading component'
    },
    {
        pattern: /class\s+\w+Controller\b/,
        purpose: 'API controller'
    },
    {
        pattern: /class\s+\w+Service\b/,
        purpose: 'Service layer'
    },
    {
        pattern: /class\s+\w+Repository\b/,
        purpose: 'Data repository'
    },
    {
        pattern: /interface\s+\w+/,
        purpose: 'TypeScript interface definition'
    },
    {
        pattern: /type\s+\w+\s*=/,
        purpose: 'TypeScript type definition'
    },
    {
        pattern: /function\s+\w+\s*\(/,
        purpose: 'Utility function'
    }
];

export async function analyzeFile(document: vscode.TextDocument): Promise<FileAnalysis> {
    const content = document.getText();
    const fileName = document.fileName;
    const packageJsonPath = await findPackageJson(fileName);
    
    const frameworks: string[] = [];
    const dependencies: string[] = [];
    
    // Detect frameworks from code patterns
    for (const signature of FRAMEWORK_SIGNATURES) {
        const hasFramework = signature.patterns.some(pattern => pattern.test(content)) ||
            (signature.filePatterns && signature.filePatterns.some(pattern => 
                minimatch(path.relative(vscode.workspace.rootPath || '', fileName), pattern)
            ));

        if (hasFramework) {
            frameworks.push(signature.name);
            if (signature.dependencies) {
                dependencies.push(...signature.dependencies);
            }
        }
    }

    // Detect purpose
    let purpose = 'General purpose file';
    for (const { pattern, purpose: filePurpose } of FILE_PURPOSE_PATTERNS) {
        if (pattern.test(content)) {
            purpose = filePurpose;
            break;
        }
    }

    // Extract exports and imports
    const exports = [...content.matchAll(/export\s+(default\s+)?(function|class|const|interface|type)\s+(\w+)/g)]
        .map(match => match[3]);
    
    const imports = [...content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g)]
        .map(match => match[1]);

    return {
        frameworks,
        purpose,
        dependencies,
        exports,
        imports
    };
}

async function findPackageJson(startPath: string): Promise<string | undefined> {
    let currentPath = path.dirname(startPath);
    const root = vscode.workspace.rootPath;

    while (currentPath && currentPath.startsWith(root || '')) {
        const packageJsonPath = path.join(currentPath, 'package.json');
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(packageJsonPath));
            return packageJsonPath;
        } catch {
            currentPath = path.dirname(currentPath);
        }
    }

    return undefined;
}

export function generateFilePurposeSummary(analysis: FileAnalysis): string {
    const parts: string[] = [];

    if (analysis.frameworks.length > 0) {
        parts.push(`Uses ${analysis.frameworks.join(', ')}`);
    }

    parts.push(analysis.purpose);

    if (analysis.exports.length > 0) {
        parts.push(`Exports: ${analysis.exports.join(', ')}`);
    }

    return parts.join('. ');
} 