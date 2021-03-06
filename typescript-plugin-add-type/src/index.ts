import { now } from 'hrtime-now';
import { findChild, findChildContainingRange, findIdentifier, getKindName, getTypeStringForDeclarations, hasDeclaredType, isDeclaration, positionOrRangeToRange } from 'typescript-ast-util';
import { getPluginCreate } from 'typescript-plugin-util';
import * as ts_module from 'typescript/lib/tsserverlibrary';

const PLUGIN_NAME = 'typescript-plugin-add-type'
const REFACTOR_ACTION_NAME = `${PLUGIN_NAME}-refactor-action`
let ts: typeof ts_module
let info: ts_module.server.PluginCreateInfo

const log = (msg: string) => info.project.projectService.logger.info(`${PLUGIN_NAME} ${msg}`)

const pluginDefinition = { getApplicableRefactors, getEditsForRefactor }

export = getPluginCreate(pluginDefinition, (modules, anInfo) => {
  ts = modules.typescript
  info = anInfo
  log(` created`)
})

let target: ts.Node | undefined

function getApplicableRefactors(fileName: string, positionOrRange: number | ts.TextRange, userPreferences: ts_module.UserPreferences)
  : ts.ApplicableRefactorInfo[] {
  const t0 = now()
  const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange, userPreferences) || []
  const program = info.languageService.getProgram()
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    return refactors
  }
  target = undefined
  const node = findChildContainingRange(sourceFile, positionOrRangeToRange(positionOrRange))
  if (!node) {
    log(` no getEditsForRefactor because findChildContainedRange undefined`)
    return refactors
  }
  const noFilters = false

  if (noFilters) {
    target = node
  } else {
    const predicate = function isDeclarationWithNoDeclaredType(node: ts.Node, program: ts.Program): boolean {
      return node && isDeclaration(node) && !hasDeclaredType(node, program) // declaration without a type declaration 
    }
    let child
    target = predicate(node, program) ? node :
      predicate(node.parent, program) ? node.parent :
        (child = findChild(node, c => predicate(c, program), false)) ? child :
          undefined
  }
  if (!target) {
    log(` no getEditsForRefactor because target not found undefined`)
    return refactors
  }
  const name = (node as ts.NamedDeclaration).name && (target as ts.NamedDeclaration).name.getText() || ''
  refactors.push({
    name: `${PLUGIN_NAME}-refactor-info`,
    description: 'Add type',
    actions: [
      { 
        name: REFACTOR_ACTION_NAME,
         description: 'Add type to ' + getKindName(target.kind).replace(/Declaration/gi, '').toLowerCase() + ' "' + name + '"' 
        }
    ],
  })
  log(` getApplicableRefactors took ${now() - t0}`)
  return refactors
}


function getEditsForRefactor(fileName: string, formatOptions: ts.FormatCodeSettings,
  positionOrRange: number | ts.TextRange, refactorName: string,
  actionName: string, userPreferences: ts_module.UserPreferences): ts.RefactorEditInfo | undefined {
  const t0 = now()
  const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, userPreferences)
  if (actionName != REFACTOR_ACTION_NAME || !target) {
    return refactors
  }
  const textChange = getFileTextChanges(target, info.languageService.getProgram())
  const refactorEditInfo: ts.RefactorEditInfo = {
    edits: [{
      fileName,
      textChanges: [textChange],
    }],
    renameFilename: undefined,
    renameLocation: undefined,
  }
  log(` getEditsForRefactor took ${now() - t0}`)
  return refactorEditInfo
}

function getFileTextChanges(node: ts.Node, program: ts.Program): ts.TextChange {
  let newText = ': ' + getTypeStringForDeclarations(node, program)
  let start = (findIdentifier(node) || node).getEnd() // this will work for variable declaration and non-declaration nodes
  let length = 0

  if (ts.isFunctionLike(node)) {
    start = (node as ts.FunctionDeclaration).parameters.end + 1
  }
  else/*if(!isDeclaration(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node))*/ {
    //do nothing, default value for newText seems to be doing fine

    //TODO: log
  }

  return { newText, span: { start, length } }

}

