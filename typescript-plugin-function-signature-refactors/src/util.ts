import { findChildContainingRangeLight, positionOrRangeToRange, findAscendant } from 'typescript-ast-util';
import * as ts from 'typescript'


export function getTargetNode(sourceFile: ts.SourceFile, position: number): ts.Node {
  const target = findChildContainingRangeLight(sourceFile, positionOrRangeToRange(position));
  const predicate = p => ts.isCallSignatureDeclaration(p) || ts.isFunctionLike(p) || ts.isCallOrNewExpression(p) || ts.isMethodSignature(p) || ts.isConstructSignatureDeclaration(p)
  return findAscendant(target, predicate, true)
}

export interface TargetInfo { 
  name: string, 
  targetNode: ts.Node, 
  parameterCount: number, 
  argumentCount: number 
}

export function getTargetInfo(sourceFile: ts.SourceFile, position: number): TargetInfo | undefined {

  let targetNode = this.getTargetNode(sourceFile, position)
  if (!targetNode) {
    return
  }
  let parameterCount = 0, argumentCount = 0
  let name
  if (ts.isFunctionLike(targetNode)) {
    if (!targetNode || targetNode.parameters && targetNode.parameters.length <= 1) {
      return
    }
    name = targetNode.name ? targetNode.name.getText() : (targetNode.parent && (targetNode.parent as any).name && (targetNode.parent as any).name) ? (targetNode.parent as any).name.getText() : undefined

    if (!name) {
      return
    }
    parameterCount = targetNode.parameters.length
  }
  else if (ts.isCallExpression(targetNode)) {
    if (!targetNode || targetNode.arguments && targetNode.arguments.length <= 1) {
      return
    }
    if (!ts.isIdentifier(targetNode.expression)) {
      return
    }
    name = targetNode.expression.getText()
    argumentCount = targetNode.arguments.length
  }
  //TODO: isCallNew and others that comply with : ts.isCallSignatureDeclaration(p)||ts.isFunctionLike(p)||ts.isCallOrNewExpression(p
  else {
    // this.options.log('snippet undefined because not isCallExpression and not isFunctionLike' + targetNode.getText() + ' - ' + getKindName(targetNode))
    return
  }
  return { name, argumentCount, parameterCount, targetNode }
}