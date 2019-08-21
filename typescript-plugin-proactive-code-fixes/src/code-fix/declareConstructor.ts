import { fromNow, now, timeFrom } from 'hrtime-now';
import { Scope, TypeGuards } from 'ts-morph';
import * as ts from 'typescript';
import { findAscendant, getKindName } from 'typescript-ast-util';
import { CodeFix, CodeFixOptions } from '../codeFixes';
import { buildRefactorEditInfo } from '../util';

let newExpr: ts.NewExpression

/**
# description

adds missing constructor

# attacks

"code": "2554","message": "Expected 0 arguments, but got 3.",

# example

```alpha2 = new Alpha('hello', 1, new Date())```

# TODO

 * should call super if class extends
 * config 
 * Issue (non critical): new Gamma('hello', 1, new Date())  if you stand at `Date` then it will suggest "create constructor Date"
 
 */
export const codeFixCreateConstructor: CodeFix = {

  name: 'Declare constructor',

  config: {
    // TODO
    variableType: 'const',
    // TODO 'none'|'private'|'public'|'protected' 
    constructorParameterScope: 'none',
    // TODO could be false|true|string
    jsdoc: true
  },

  predicate: (arg: CodeFixOptions) => {
    newExpr = ts.isNewExpression(arg.containingTarget) ? arg.containingTarget : findAscendant(arg.containingTarget, ts.isNewExpression)

    if (newExpr && arg.diagnostics.find(d => d.code === 2554 && d.start <= arg.containingTargetLight.getStart() && d.start + d.length >= arg.containingTargetLight.getEnd())) {
      return true
    } else {
      arg.log(`predicate false because no NewExpression ascendant was   und containingTarget.kind==${getKindName(arg.containingTarget.kind)}, containingTarget.parent.kind==${arg.containingTarget.parent && getKindName(arg.containingTarget.parent.kind)}`)
      return false
    }
  },

  description: (arg: CodeFixOptions): string => `Declare constructor "${newExpr.expression.getText()}"`,

  apply: (arg: CodeFixOptions) => {
    const t0 = now()

    const originalKind = arg.simpleNode.getKind()
    if (!TypeGuards.isNewExpression(arg.simpleNode)) {
      arg.simpleNode = arg.simpleNode.getFirstAncestorByKind(ts.SyntaxKind.NewExpression)
    }
    if (!arg.simpleNode || !TypeGuards.isNewExpression(arg.simpleNode)) {
      arg.log(`apply fail because couldnt find a NewExpression from node returned by sourcefile..getDescendantAtPos(positionOrRangeToNumber(positionOrRange) - returned node kind was ${getKindName(originalKind)}`)
      return
    }
    const node = arg.simpleNode
    const argTypes = fromNow(
      () => node.getArguments().map(arg => arg.getType().getBaseTypeOfLiteralType().getText()), t => arg.log(`argTypes took ${t}`))

    const classDeclaration = fromNow(
      () => TypeGuards.isNewExpression(node) && node.getExpression().getSymbol()!.getDeclarations()[0], // TODO: check if empty. log and investigate if many 
      t => `classDeclaration took ${t}`)

    if (TypeGuards.isClassDeclaration(classDeclaration)) {
      const constructorDeclaration = fromNow(
        () =>
          classDeclaration.addConstructor({
            docs: [],//['TODO: Document this autogenerated constructor'], //TODO: configurable
            scope: Scope.Public,
            parameters: argTypes.map((type, i) => ({
              name: `a${type.substring(0, 1).toUpperCase()}${type.substring(1, type.length)}${i}`,
              hasQuestionToken: false,
              type,
              isRestParameter: false,
            })),
            bodyText: `throw new Error('Not implemented');`
          }),
        t => arg.log(`addConstructor took ${t}`)
      )
      // heads up : must find openBrace to get position where to insert because constructorDeclaration.getStart() is wrong, see below - ts-morph issue
      const openBrace = classDeclaration.getChildren().find(c => c.getKind() === ts.SyntaxKind.OpenBraceToken)
      return buildRefactorEditInfo(arg.sourceFile, '\n' + constructorDeclaration.getText(), openBrace.getEnd(), 0)
    } else {
      arg.log(`apply fail because node is not ClassDeclaration is ${getKindName(classDeclaration.getKind())}`)
    }
    arg.log(`apply took ${timeFrom(t0)}`)
  }
};

// TODO : issue ts-morph  

// const constructorDeclaration = 
//         classDeclaration.addConstructor({
//           docs: ['TODO: Document this autogenerated constructor'], //TODO: configurable
//           scope: Scope.Public,
//           parameters: argTypes.map((type, i) => ({
//             name: `a${type.substring(0, 1).toUpperCase()}${type.substring(1, type.length)}${i}`,
//             hasQuestionToken: false,
//             type,
//             isRestParameter: false,
//           })),
//           bodyText: `throw new Error('Not implemented');`
//         })

//         constructorDeclaration.getStart() is wrong