import * as tsa from 'ts-morph';
import { TypeGuards } from 'ts-morph';
import * as ts from 'typescript';
import { getKindName } from 'typescript-ast-util';
import { CodeFix, CodeFixOptions } from '../codeFixes';
import { buildRefactorEditInfo } from '../util';


/** 

# description

declares missing member in a property access expression in some interface or class that the accessed reference implements/extends. 

Note: TypeScript 3.0 has some declare method and declare property refactors, but it won't declare in object literals

# attacks
```
	"code": "2339", "message": "Property 'bar' does not exist on type '{ foo: () => number; }'.",
```

# Example: 
```
const o = {
  foo: () => { return 1 }
}
const val: string[] = o.bar(1, ['w'], true)      // <---- will add bar as method of literal object o
interface Hello {}
const hello: Hello = {}
let i: string[]
i = hello.world([[1, 2, 3], [4, 5]])             // <----- will add world as method of interface Hello
const k = hello.mama(1, 2, 3) + ' how are you?'  // will add method mama to interface hello 
function f(h: Hello) {
  h.fromFunc = true                              // will add boolean property fromFunc to interface hello 
}
var x: Date = new Date(hello.timeWhen('born'))    // will add method timeWhen to interface Hello
class C {
  hello: Hello
  m(s: number[]) { this.hello.grasp(s, [false, true]) }  // will add method grasp to interface Hello
}
const notDefined:C
const a = notDefined.foof + 9                              // will add property foof to class C
```

# TODO: 

 * use ast structures - we are not considering hasQuestion, modifiers, typeparams, etc
 * Probably we are loosing existing JSdocs ? 

 * generate jsdoc for new members added to the interface ?

 * lots of unknown situations - test more

 * declare member in other than interfaces ike classes, literal objects and type declarations: for example this doest work:

```
class C {}
new C().nonExistentMethod()
```

 * (very low priority) return type for method in some scenario

```
interface Hello{}
const hello: Hello = {}
class C {
  hello: Hello
  // here - when we apply refactor on grasp I expect that generated method to return  {modified: Date, fully: boolean} and not just any
  m(s: number[]):{modified: Date, fully: boolean} { return this.hello.grasp(s, [false, true]) } 
}
```
*/

export const declareMember: CodeFix = {

  name: 'declareMember',

  config: {},

  predicate: (arg: CodeFixOptions): boolean => {
    if (arg.containingTargetLight.kind === ts.SyntaxKind.Identifier &&
      arg.containingTargetLight.parent.kind === ts.SyntaxKind.PropertyAccessExpression &&
      arg.diagnostics.find(d => d.code === 2339 && d.start === arg.containingTargetLight.getStart())) {
      return true
    }
    else {
      arg.log('predicate false because child.kind dont match ' + getKindName(arg.containingTarget.kind))
      return false
    }
  },

  description: (arg: CodeFixOptions): string => `Declare missing member "${arg.containingTarget.getText()}"`,

  apply: (opts: CodeFixOptions) => {
    const node = opts.simpleNode
    const print = (msg) => { opts.log('apply ' + msg) }
    const typeChecker = opts.simpleProject.getTypeChecker()
    const newMemberName_ = node.getText()
    const accessExpr = node.getParent()
    if (!TypeGuards.isPropertyAccessExpression(accessExpr)) {
      return print(`WARNING !TypeGuards.isPropertyAccessExpression(accessExpr) ${accessExpr.getKindName()}`)
    }
    const expressionWithTheType = accessExpr.getParent().getKind() === ts.SyntaxKind.CallExpression ?
      accessExpr.getParent().getParent() : accessExpr.getParent()
    const newMemberType_ = typeChecker.getTypeAtLocation(expressionWithTheType).getBaseTypeOfLiteralType()
    // now we extract arguments in case is a method call, example: const k = hello.mama(1,2,3)+' how are you?'-.
    let args_
    const callExpression = accessExpr.getParent()
    if (TypeGuards.isCallExpression(callExpression)) {
      let argCounter = 0
      args_ = callExpression.getArguments().map(a => ({
        name: `arg${argCounter++}`,
        type: typeChecker.getTypeAtLocation(a).getBaseTypeOfLiteralType()
      }))
    }
    const results: tsa.ts.RefactorEditInfo[] = []
    fixTargetDecl(accessExpr, newMemberName_, newMemberType_, args_, print, results)
    return results.find(r => !!r)
  }
}


// now we need to get the target declaration and add the member. It could be an object literal decl{}, an interface decl or a class decl
const fixTargetDecl = (targetNode: tsa.Node, newMemberName: string, newMemberType: tsa.Type, args: { name: string, type: tsa.Type }[], print: (msg: string) => void, results: tsa.ts.RefactorEditInfo[]): void => {
  let decls
  if (TypeGuards.isExpressionedNode(targetNode) || TypeGuards.isLeftHandSideExpressionedNode(targetNode)) {
    let expr = targetNode.getExpression()
    if (TypeGuards.isNewExpression(expr)) {
      expr = expr.getExpression()
    }
    decls = expr.getSymbol().getDeclarations()
  } else if (targetNode && targetNode.getKindName().endsWith('Declaration')) {
    decls = [targetNode]
  } else {
    return print(`WARNING cannot recognized targetNode : ${targetNode && targetNode.getKindName()} ${targetNode && targetNode.getText()}`)
  }
  // const sourceFile = targetNode.getSourceFile()
  decls.forEach(d => {
    if (TypeGuards.isVariableDeclaration(d)) {
      const targetInit = d.getInitializer()
      // Heads up - first of all - because this is a variable declaration we try to find a clear interface or class that this 
      // variable implements and is in this and doesn't already have the new member - then we fix there and not here
      const typeDeclInThisFile = (d.getType() && d.getType().getSymbol() && d.getType().getSymbol().getDeclarations() && d.getType().getSymbol().getDeclarations() || [])
        .find(dd => (TypeGuards.isInterfaceDeclaration(dd) || TypeGuards.isClassDeclaration(dd)) && dd.getSourceFile() === d.getSourceFile()
        )
      if (typeDeclInThisFile && (TypeGuards.isInterfaceDeclaration(typeDeclInThisFile) || TypeGuards.isClassDeclaration(typeDeclInThisFile))) {
        return fixTargetDecl(typeDeclInThisFile, newMemberName, newMemberType, args, print, results)
      }
      else if (!TypeGuards.isObjectLiteralExpression(targetInit)) {
        //TODO - unknown situation - we should print in the file for discover new cases.
        return print(`WARNING  !TypeGuards.isObjectLiteralExpression(targetInit) targetInit.getKindName() === ${targetInit && targetInit.getKindName()} targetInit.getText() === ${targetInit && targetInit.getText()}  d.getKindName() === ${d && d.getKindName()} d.getText() === ${d && d.getText()}`)
      }
      else if (!args) {
        const member = targetInit.addPropertyAssignment({
          //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
          name: newMemberName,
          initializer: 'null'
        })
        pushMember(member, d.getSourceFile(), results)
      }
      else {
        const member = targetInit.addMethod({
          //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
          name: newMemberName,
          returnType: newMemberType.getText(),
          bodyText: `throw new Error('Not Implemented')`,
          parameters: args.map(a => ({
            //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
            name: a.name,
            type: a.type.getText()
          }))
        })
        pushMember(member, d.getSourceFile(), results)
      }
    }

    else if (TypeGuards.isInterfaceDeclaration(d)) {
      if (!args) {
        const member = d.addProperty({
          name: newMemberName,
          type: newMemberType.getText()
        })
        pushMember(member, d.getSourceFile(), results)
      }
      else {
        const member = d.addMethod({
          //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
          name: newMemberName,
          returnType: newMemberType.getText(),
          parameters: args.map(a => ({
            //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
            name: a.name,
            type: a.type.getText()
          }))
        })
        pushMember(member, d.getSourceFile(), results)
      }
    }

    else if (TypeGuards.isClassDeclaration(d)) {
      if (!args) {
        const member = d.addProperty({
          name: newMemberName,
          type: newMemberType.getText()
        })
        pushMember(member, d.getSourceFile(), results)
      }
      else {
        const member = d.addMethod({
          //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
          name: newMemberName,
          returnType: newMemberType.getText(),
          parameters: args.map(a => ({
            //TODO: use ast getstructure. we are not considering: jsdoc, hasquestion, modifiers, etc
            name: a.name,
            type: a.type.getText()
          })),
          bodyText: `throw new Error('Not Implemented')`
        })
        pushMember(member, d.getSourceFile(), results)
      }
    }

    else if (TypeGuards.isParameterDeclaration(d) || TypeGuards.isPropertyDeclaration(d)) {
      // we are referencing a parameter or a property - not a variable - so we need to go to the declaration's declaration
      d.getType().getSymbol().getDeclarations().map(dd => {
        fixTargetDecl(dd, newMemberName, newMemberType, args, print, results) // recursive!
      })
      //TODO: support RefactorEditInfo ? 
    }

    else {
      //TODO - unknown situation - we should print in the file for discover new cases.
      print(`WARNING: is another thing isParameterDeclaration ${d.getKindName()}`)
    }
  })
}



function pushMember(member: tsa.Node, sourceFile: tsa.SourceFile, results: tsa.ts.RefactorEditInfo[]) {
  let start: number
  const previous = member.getPreviousSibling()
  if (!previous) {
    const openBrace = member.getParent().getChildren().find(c => c.getKind() === ts.SyntaxKind.OpenBraceToken) as tsa.Node
    start = openBrace && openBrace.getEnd()// : member.getFullStart()
  }
  else {
    start = previous.getEnd()
  }
  const text = `${TypeGuards.isObjectLiteralExpression(member.getParent()) && previous ? ',' : ''}${member.getFullText()}\n`
  results.push(buildRefactorEditInfo(sourceFile.compilerNode, text, start, 0))
}
