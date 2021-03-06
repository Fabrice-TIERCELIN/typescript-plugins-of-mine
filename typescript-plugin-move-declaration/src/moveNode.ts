import { ClassDeclaration, FunctionDeclaration, InterfaceDeclaration, Project, SourceFile, TypeGuards } from 'ts-simple-ast';
import { fixExportsInReferencingFiles, fixImportsInDestFile, fixImportsInReferencingFiles, getIndexAfterLastImport } from './moveNodeUtil';

// TODO: 
// * enumDeclaration , variable declarations
// * test with no named imports like default or alias
// * issue : see importSpec, when the node is imported toghether with other names like in import {a, node, b} from 'foo' then we must isolate `node` in its own import in fixImportsInReferencingFiles()
// moving decl that is default exported to a file that already has a default exported should be aborted
export type NodeType = ClassDeclaration | InterfaceDeclaration | FunctionDeclaration
export function moveNode(node: NodeType, destFile: SourceFile, project: Project) {

  // we copy all the imports from node.getSourceFile() to destFile and the organize imports so the moved declaration don't miss any import
  fixImportsInDestFile(node, destFile)

  fixExportsInReferencingFiles(node, destFile, project)


  // For each sourceFile that reference node, we add an import declaration to node but specifying nodeFile. (we "move" the oriinal import declarations only changing the specifier to point to destFile).
  fixImportsInReferencingFiles(node, destFile)

  // move the declaration - first add a copy of the node to destFile

  let finalNode: NodeType
  const index = getIndexAfterLastImport(destFile)
  if (TypeGuards.isClassDeclaration(node)) {
    finalNode = destFile.insertClass(index, node.getStructure())
  }
  else if (TypeGuards.isInterfaceDeclaration(node)) {
    finalNode = destFile.insertInterface(index, node.getStructure())
  }
  else if (TypeGuards.isFunctionDeclaration(node)) {
    finalNode = destFile.insertFunction(index, node.getStructure())
  }
  const nodeIsDefaultExport = node.isDefaultExport()
  // and then remove node from its sourceFile
  node.remove()

  finalNode.setIsExported(true)
  finalNode.setIsDefaultExport(nodeIsDefaultExport)
  destFile.organizeImports()
  node.getSourceFile().organizeImports()
}

