import { ClassDeclaration, FunctionDeclaration, InterfaceDeclaration, Project, SourceFile, TypeGuards } from 'ts-simple-ast';
import { addImportsToDestFile, addImportsToReferencingFiles, safeOrganizeImports } from './moveNodeUtil';

// TODO: 
// * enumDeclaration , variable declarations
// * test with no named imports like default or alias
export type NodeType = ClassDeclaration | InterfaceDeclaration | FunctionDeclaration
export function moveNode(node: NodeType, destFile: SourceFile, project: Project) {

  // we copy all the imports from node.getSourceFile() to destFile and the organize imports so the moved declaration don't miss any import
  addImportsToDestFile(node, destFile);

  // For each sourceFile that reference node, we add an import declaration to node but specifying nodeFile. (we "move" the oriinal import declarations only changing the specifier to point to destFile).
  addImportsToReferencingFiles(node, destFile);

  // move the declaration - first add a copy of the node to destFile
  let finalNode: NodeType
  if (TypeGuards.isClassDeclaration(node)) {
    finalNode = destFile.addClass(node.getStructure())
  }
  else if (TypeGuards.isInterfaceDeclaration(node)) {
    finalNode =destFile.addInterface(node.getStructure())
  }
  else if (TypeGuards.isFunctionDeclaration(node)) {
    finalNode =destFile.addFunction(node.getStructure())
  }
  // and then remove node from its sourceFile
  node.remove()

  finalNode.setIsExported(true)
  safeOrganizeImports(destFile, project);
  safeOrganizeImports(node.getSourceFile(), project);
}
