import { ClassDeclaration, ExpressionWithTypeArguments, FunctionLikeDeclaration, InterfaceDeclaration, MethodSignature, Node, ParameterDeclaration, ParameterDeclarationStructure, SyntaxKind, Type, TypeGuards, StringLiteral, NoSubstitutionTemplateLiteral, SourceFile, MethodDeclaration, StructureKind } from "ts-morph";
import * as ts from 'typescript'

export const buildParameterStructure = (p: ParameterDeclaration): ParameterDeclarationStructure => ({
  name: p.getName(),
  hasQuestionToken: p.hasQuestionToken(),
  type: p.getTypeNode() == null ? undefined : p.getTypeNodeOrThrow().getText(),
  isRestParameter: p.isRestParameter(),
  scope: p.hasScopeKeyword() ? p.getScope() : undefined,
  kind: StructureKind.Parameter
})


/** fix given function-like declaration parameters and type to implement given signature */
export function fixSignature(decl: FunctionLikeDeclaration, signature: MethodSignature | MethodDeclaration): void {
  decl.setReturnType(signature.getReturnType().getText())
  // add missing params and fix exiting param types
  let memberParams = decl.getParameters()
  let signatureParams = signature.getParameters()
  for (let i = 0; i < signatureParams.length; i++) {
    const signatureParam = signatureParams[i]
    if (memberParams.length <= i) {
      decl.addParameter(buildParameterStructure(signatureParam))
    } else {
      const memberParam = memberParams[i]
      if (!areTypesEqual(memberParam.getType(), signatureParam.getType())) {
        memberParam.set({ ...buildParameterStructure(signatureParam), name: memberParam.getName() })
      }
    }
  }
  // remove extra non optional params member signature might have
  memberParams = decl.getParameters()
  signatureParams = signature.getParameters()
  if (memberParams.length > signatureParams.length) {
    for (let i = signatureParams.length; i < memberParams.length; i++) {
      if (!(memberParams[i].hasInitializer() || memberParams[i].isOptional())) {
        memberParams[i].remove()
      }
    }
  }
}

/** dirty way of checking if two types are compatible */
export function areTypesEqual(t1: Type, t2: Type): boolean { return t1.getText().replace(/\s+/gi, '') === t2.getText().replace(/\s+/gi, '') }


/**
 * returns all implements clauses of this class and its super classes both things recursively 
 */
export const getImplementsAll = (cl: ClassDeclaration): ExpressionWithTypeArguments[] => {
  let result: ExpressionWithTypeArguments[] = []
  cl.getImplements().forEach(impl => {
    // TODO: types like A|B
    result.push(impl)
    impl.getType().getSymbolOrThrow().getDeclarations().forEach(d => {
      if (TypeGuards.isInterfaceDeclaration(d)) {
        result = result.concat(getExtendsRecursively(d))
      }
    })
  });
  getExtendsRecursively(cl).forEach(ext => {
    ext.getType().getSymbolOrThrow().getDeclarations().forEach(d => {
      if (TypeGuards.isClassDeclaration(d)) {
        result = result.concat(getImplementsAll(d))
      }
    })
  })
  return result
}

export const getExtendsRecursively = (decl: ClassDeclaration | InterfaceDeclaration): ExpressionWithTypeArguments[] => {
  let extendExpressions = TypeGuards.isClassDeclaration(decl) ? (decl.getExtends() ? [decl.getExtends()] : []) : decl.getExtends()
  extendExpressions.forEach(expr => {
    expr.getType().getSymbol().getDeclarations().forEach(d => {
      if (TypeGuards.isInterfaceDeclaration(d) || TypeGuards.isClassDeclaration(d)) {
        extendExpressions = extendExpressions.concat(getExtendsRecursively(d))
      }
    })
  })
  return extendExpressions
}


export const findInterfacesWithPropertyNamed = (decl: ClassDeclaration, memberName: string): InterfaceDeclaration[] =>
  getImplementsAll(decl)
    .map(expr => expr.getType().getSymbolOrThrow().getDeclarations())
    .reduce((a, v) => a.concat(v), [])
    .filter(TypeGuards.isInterfaceDeclaration)
    .filter(d => d.getMembers().find(m => TypeGuards.isPropertyNamedNode(m) && m.getName() === memberName))
    .filter((value, pos, arr) => arr.indexOf(value) === pos) // union

/**
 * returns a default representation of given type, for example `''` for `string`, `[]` for `Array`, etc. 
 * TODO: this should support recursion in case it references another interface - we can recreate the whole thing recursively... 
 */
export function getDefaultValueForType(t: Type): string {
  if (!t) {
    return 'null'
  } else if (t.getText() === 'string') {
    return '\'\''
  } else if (t.getText() === 'boolean') {
    return 'false'
  } else if (t.getText() === 'number') {
    return '0'
  } else if (t.getText() === 'Date') {
    return 'new Date()'
  } else if (t.getText() === 'RegExp') {
    return '//ig'
  } else if (t.isArray()) {
    return '[]'
  } else {
    return 'null'
  }
}

export function getName(node: Node, defaultName: string = 'unknown_name'): string {
  const a = node as any
  let id
  return a && a.getName && a.getName() || (id = node.getDescendantsOfKind(SyntaxKind.Identifier)) && id.getText() || defaultName
}

export function quote(s, q) {
  const newLiteral = s.replace(new RegExp(`${q}`, 'gmi'), `\\${q}`)
  return q + newLiteral + q
}
export function changeQuoteChar(node: StringLiteral | NoSubstitutionTemplateLiteral, newQuoteChar: string) {
  const newText = quote(node.getLiteralText(), newQuoteChar)
  node.replaceWithText(newText)
}

export function buildRefactorEditInfo(sourceFile: ts.SourceFile, newText: string, start: number = 0, length: number = 0): ts.RefactorEditInfo {
  return {
    edits: [
      {
        fileName: sourceFile.fileName,
        textChanges: [
          {
            newText,
            span: { start, length }
          }
        ]
      }
    ]
  }
}