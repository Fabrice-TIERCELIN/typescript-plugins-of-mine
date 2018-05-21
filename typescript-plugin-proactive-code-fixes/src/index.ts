import { now } from 'hrtime-now';
import { findChildContainingRange, getKindName, positionOrRangeToNumber, positionOrRangeToRange, getDiagnosticsInCurrentLocation } from 'typescript-ast-util';
import { createSimpleASTProject, getPluginCreate } from 'typescript-plugin-util';
import * as ts_module from 'typescript/lib/tsserverlibrary';
import { codeFixes } from './codeFixes';
import { createWrappedNode, TypeGuards } from 'ts-simple-ast';
import { createLogicalNot } from 'typescript';


const PLUGIN_NAME = 'typescript-plugin-proactive-code-fixes'
const REFACTOR_ACTION_NAME = `${PLUGIN_NAME}-refactor-action`
let ts: typeof ts_module
let info: ts_module.server.PluginCreateInfo

const pluginDefinition = { getApplicableRefactors, getEditsForRefactor }

export = getPluginCreate(pluginDefinition, (modules, anInfo) => {
  ts = modules.typescript
  info = anInfo
  info.project.projectService.logger.info(`${PLUGIN_NAME} created`)
})

let target: ts.Node | undefined
let log
let diagnostics: ts.Diagnostic[]

function getApplicableRefactors(fileName: string, positionOrRange: number | ts.TextRange)
  : ts.ApplicableRefactorInfo[] {
  const t0 = now()
  const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange) || []
  const program = info.languageService.getProgram()
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    return refactors
  }

  diagnostics = getDiagnosticsInCurrentLocation(program, sourceFile, positionOrRangeToNumber(positionOrRange)) || []

  if (!log) {
    log = function (msg) {
      info.project.projectService.logger.info(`${PLUGIN_NAME} ${msg}`)
    }
  }
  // const diagnostic = dignostics[0]; // TODO: forced the first - what with the others ? why this takes priority ? I guess because is first - but perhaps in the same line there are more priority ones?

  target = findChildContainingRange(sourceFile, positionOrRangeToRange(positionOrRange))
  if (!target) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getApplicableRefactors because findChildContainedRange  target node is undefined `)
    return refactors
  }

  // const child = sourceFile.getDescendantAtPos(cursorPosition);
  const fixes = codeFixes.filter(fix => fix.predicate(diagnostics, target, log));
  if (!fixes || !fixes.length) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getApplicableRefactors because no codeFixes returned true for node of kind ==${getKindName(target.kind)} and diagnostics: ${diagnostics.map(d=>d.code)}`)
    return refactors
  }
  const actions = fixes
  refactors.push({
    name: `${PLUGIN_NAME}-refactor-info`,
    description: 'Add type',
    actions: fixes.map(fix => ({
      name: REFACTOR_ACTION_NAME + '-' + fix.name,
      description: fix.description(diagnostics, target)
    }))
  })
  info.project.projectService.logger.info(`${PLUGIN_NAME} getApplicableRefactors took ${now() - t0}`)
  return refactors
}

function getEditsForRefactor(fileName: string, formatOptions: ts.FormatCodeSettings,
  positionOrRange: number | ts.TextRange, refactorName: string,
  actionName: string): ts.RefactorEditInfo | undefined {
  const t0 = now()
  const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName)
  if (!actionName.startsWith(REFACTOR_ACTION_NAME) || !target) {
    return refactors
  }
  const fixName = actionName.substring(REFACTOR_ACTION_NAME.length + 1, actionName.length)
  const fix = codeFixes.find(fix => fix.name === fixName)
  if (!fix) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getEditsForRefactor because no fix was found for actionName == ${actionName}`)
    return refactors
  }
  const simpleProject = createSimpleASTProject(info.project)
  let node = simpleProject.getSourceFile(fileName).getDescendantAtPos(positionOrRangeToNumber(positionOrRange))
  
  fix.apply(diagnostics, node, log)
  simpleProject.saveSync();
  simpleProject.emit();

  info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor took ${now() - t0}`)
  return refactors
}



