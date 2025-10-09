/**
 * Unused Exports Finder
 *
 * Analyzes TypeScript/JavaScript files to identify exports that are not imported anywhere in the codebase.
 * Uses the TypeScript compiler API to parse AST and track exports vs imports.
 *
 * Usage:
 *   bun run find-unused-exports.ts [directory]
 *
 * Examples:
 *   bun run find-unused-exports.ts ./src
 *   bun run find-unused-exports.ts
 */

import * as fs from 'fs';
import * as ts from 'typescript';
import * as glob from 'glob';

const rootDir = process.argv[2] || './src';
const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

interface Export {
  name: string;
  filePath: string;
}

interface Import {
  name: string;
  sourceFilePath: string;
}

/**
 * Recursively finds all TypeScript/JavaScript files in a directory
 * @param directory - Root directory to search
 * @returns Array of file paths matching configured extensions
 */
function getAllFiles(directory: string): string[] {
  const pattern = `${directory}/**/*{${fileExtensions.join(',')}}`;
  return glob.sync(pattern, { ignore: 'node_modules/**' });
}

// Parse exports from a file
function getExportsFromFile(filePath: string): Export[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: Export[] = [];

  function visit(node: ts.Node) {
    // Export declarations (export { x, y })
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          exports.push({
            name: element.name.text,
            filePath,
          });
        });
      }
    }
    // Export assignments (export = x, export default x)
    else if (ts.isExportAssignment(node)) {
      if (node.expression && ts.isIdentifier(node.expression)) {
        exports.push({
          name: node.expression.text,
          filePath,
        });
      } else {
        exports.push({
          name: 'default',
          filePath,
        });
      }
    }
    // Variable/function/class declarations with export keyword
    else if (
      (ts.isVariableStatement(node) || 
       ts.isFunctionDeclaration(node) || 
       ts.isClassDeclaration(node)) &&
      node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(declaration => {
          if (ts.isIdentifier(declaration.name)) {
            exports.push({
              name: declaration.name.text,
              filePath,
            });
          }
        });
      } else if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && 
        node.name
      ) {
        exports.push({
          name: node.name.text,
          filePath,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

// Parse imports from a file
function getImportsFromFile(filePath: string): Import[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  const imports: Import[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (node.importClause) {
        // Default import
        if (node.importClause.name) {
          imports.push({
            name: node.importClause.name.text,
            sourceFilePath: filePath,
          });
        }

        // Named imports
        const namedBindings = node.importClause.namedBindings;
        if (namedBindings) {
          if (ts.isNamedImports(namedBindings)) {
            namedBindings.elements.forEach(element => {
              imports.push({
                name: element.propertyName?.text || element.name.text,
                sourceFilePath: filePath,
              });
            });
          } else if (ts.isNamespaceImport(namedBindings)) {
            // Namespace imports (import * as x) are harder to track
            // We'll skip for simplicity
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

// Find unused exports
function findUnusedExports(): string[] {
  const files = getAllFiles(rootDir);
  
  const allExports: Export[] = [];
  const allImports: Import[] = [];
  
  files.forEach(filePath => {
    allExports.push(...getExportsFromFile(filePath));
    allImports.push(...getImportsFromFile(filePath));
  });

  // Find unused exports
  const usedExportNames = new Set(allImports.map(imp => imp.name));
  const unusedExports = allExports.filter(exp => !usedExportNames.has(exp.name));
  
  // Group by file path
  const unusedExportFiles = new Set<string>();
  unusedExports.forEach(exp => unusedExportFiles.add(exp.filePath));
  
  return Array.from(unusedExportFiles);
}

// Run the script
const unusedExportFiles = findUnusedExports();
console.log('Files with unused exports:');
unusedExportFiles.forEach(filePath => {
  console.log(`- ${filePath}`);
});