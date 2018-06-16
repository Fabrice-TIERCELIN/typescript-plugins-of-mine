import { CallExpression, Node, ReferenceFindableNode, SignaturedDeclaration, TypeGuards } from "ts-simple-ast";
import { getName, getChildrenForEachChild } from "typescript-plugin-util";
import { ToolConfig, create, Tool } from "typescript-plugins-text-based-user-interaction";
import { findAscendant, findChildContainingRangeLight, positionOrRangeToRange, getNextSibling, getPreviousSibling } from "typescript-ast-util";
import * as ts from 'typescript'

/**
 * collect al references of given node and returns those nodes that need to be refactored
 */
function getAllCallsExpressions(targetDeclaration: ReferenceFindableNode & Node): ((CallExpression | SignaturedDeclaration) & Node)[] {
  const referencedSymbols = targetDeclaration.findReferences()
  const calls: (Node & (CallExpression | SignaturedDeclaration))[] = []
  for (const referencedSymbol of referencedSymbols) {
    for (const reference of referencedSymbol.getReferences()) {
      const parent = reference.getNode().getParent()
      const extras = [parent, parent.getParent && parent.getParent(), targetDeclaration]
      const found = (extras
        .concat(getChildrenForEachChild(parent)))
        .filter((value, pos, arr) => arr.indexOf(value) === pos)
        .find(p =>
          (!getName(p) || getName(targetDeclaration) === getName(p)) && 
          (TypeGuards.isCallExpression(p) || TypeGuards.isSignaturedDeclaration(p))
        ) as (CallExpression | SignaturedDeclaration) & Node
      if (found) {
        calls.push(found)
      }
      else {
        console.log('getAllCallsExpressions ignoring reference parent: ' + parent.getKindName() +
          ' ref: ' + reference.getNode().getKindName() +
          'chh ' + parent.getChildren().map(c => c.getKindName()).join(', ') +
          ' ancest: ' + parent.getAncestors().map(c => c.getKindName()).join(', ')
        )
      }
    }
  }
  return calls.filter((value, pos, arr) => arr.indexOf(value) === pos)
}


/**
 * For all references that must be refactored calls changeCallArgs.
 * 
 * TODO: check that user is not removing parameters. For example, this is invalid in a three 
 * parameter function : [1, 2] 
 * because the first parameter will be removed. Or throw exception or touch the reorder argument so it contains them all 
 * @param targetDeclaration the function-like declaration to reorder its parameters
 * @param reorder [1,0] means switching the positions between first and second params
 */
export function reorderParameters(targetDeclaration: ReferenceFindableNode & Node, reorder: number[]) {
  getAllCallsExpressions(targetDeclaration).forEach(call => {
    if (TypeGuards.isCallExpression(call)) {
      changeCallArgs(reorder, call.getArguments())
    }
    else {
      changeCallArgs(reorder, call.getParameters())
    }
  })
}

function changeCallArgs(reorder: ReadonlyArray<number>, args: ReadonlyArray<Node>) {
  type T = { index: number, arg: string, name: string }

  // will use indexOccupied to reasign new positions to those nodes that must move implicitly
  let indexOccupied = new Array(args.length).fill(-1)
  reorder.forEach((r, i) => {
    if (r >= indexOccupied.length) {
      //user error provided incorrect reorder array
    }
    indexOccupied[r] = i
  })
  function findNextFreeIndexFor(index) {
    const id = indexOccupied.indexOf(-1)
    indexOccupied[id] = index
    return id
  }
  // reorderedArgs will have metadata regarding the new params/args locations
  let reorderedArgs: T[] = args.map((arg, i) => {
    if (i < reorder.length) {
      return {
        index: reorder[i],
        arg: arg.getText(),
        name: getName(arg)
      }
    }
  }).filter(a => !!a)

  // missingArgs contains  metadata regarding those nodes that must implicitly move
  const missingArgs: T[] = args.map((arg, index) => {
    if (index >= reorder.length) {
      const newIndex = findNextFreeIndexFor(index)
      return {
        index: newIndex,
        arg: arg.getText(),
        name: getName(arg)
      }
    }
  }).filter(a => !!a)

  reorderedArgs = reorderedArgs.concat(missingArgs)

  // store movements metadata here so we move all together at the end (performance - avoid conflicts)
  const replacements = []
  args.forEach((a, index) => {
    const arg = reorderedArgs.find(r => r.index === index)
    if (arg) {
      replacements.push({ node: args[arg.index], text: arg.arg })
    } else {
      console.log('changeCallArgs ignoring arg: ' + a.getKindName() + ' - text: ' + a.getText())
    }
  })
  for (const r of replacements) {
    r.node.replaceWithText(r.text)
  }
}