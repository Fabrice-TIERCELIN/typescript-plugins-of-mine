import { now, timeFrom } from 'hrtime-now';
import { findChildContainedRange, findChildContainingRange, getKindName, positionOrRangeToNumber, positionOrRangeToRange } from 'typescript-ast-util';
import { createSimpleASTProject, getPluginCreate } from 'typescript-plugin-util';
import * as ts_module from 'typescript/lib/tsserverlibrary';
import { CodeFixOptions, codeFixes } from './codeFixes';


const PLUGIN_NAME = 'typescript-plugin-proactive-code-fixes'
const REFACTOR_ACTION_NAME = `${PLUGIN_NAME}-refactor-action`
let ts: typeof ts_module
let info: ts_module.server.PluginCreateInfo
let log

const pluginDefinition = { getApplicableRefactors, getEditsForRefactor }

export = getPluginCreate(pluginDefinition, (modules, anInfo) => {
  ts = modules.typescript
  info = anInfo
  log = function (msg) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} ${msg}`)
  }
  info.project.projectService.logger.info(`${PLUGIN_NAME} created`)
})

//TODO use fromNow to clear the code from logging

const DEBUG = true

let target: CodeFixOptions
function getApplicableRefactors(fileName: string, positionOrRange: number | ts.TextRange)
  : ts.ApplicableRefactorInfo[] {

  const t0 = now()
  const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange) || []
  if (DEBUG) { // a debug helper that will dump pointed node 
    refactors.push({
      name: `${PLUGIN_NAME}-refactor-info`,
      description: 'Code Fixes',
      actions: [{
        name: REFACTOR_ACTION_NAME + '-' + 'debug-pointed-ast',
        description: 'debug: inspect pointed node'
      }]
    })
  }
  const program = info.languageService.getProgram()
  const sourceFile = program.getSourceFile(fileName)
  if (!sourceFile) {
    return refactors
  }
  const getDiagnosticT0 = now()
  const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile)
  info.project.projectService.logger.info(`${PLUGIN_NAME} getPreEmitDiagnostics took ${timeFrom(getDiagnosticT0)}`)

  const containingTarget = findChildContainingRange(sourceFile, positionOrRangeToRange(positionOrRange))
  const containedTarget = findChildContainedRange(sourceFile, positionOrRangeToRange(positionOrRange)) || sourceFile
  
  if (!containingTarget) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getApplicableRefactors because findChildContainedRange  target node is undefined `)
    return refactors
  }

  info.project.projectService.logger.info(`${PLUGIN_NAME} getApplicableRefactors info: containingTarget.kind == ${getKindName(containingTarget.kind)} containedTarget.kind == ${containedTarget ? getKindName(containedTarget.kind) : 'NOCONTAINEDCHILD'} `)

  const codeFixesFilterT0 = now()
  target = { diagnostics, containingTarget, containedTarget, log, program }
  const fixes = codeFixes.filter(fix => fix.predicate(target))
  info.project.projectService.logger.info(`${PLUGIN_NAME} codeFixesFilterT0 took ${timeFrom(codeFixesFilterT0)}`)

  if (!fixes || !fixes.length) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getApplicableRefactors because no codeFixes returned true for node of kind ==${getKindName(containingTarget.kind)} and diagnostics: ${diagnostics.map(d => d.code)}`)
    return refactors
  }
  refactors.push({
    name: `${PLUGIN_NAME}-refactor-info`,
    description: 'Code Fixes',
    actions: fixes.map(fix => ({
      name: REFACTOR_ACTION_NAME + '-' + fix.name,
      description: fix.description(target)
    }))
  })
  info.project.projectService.logger.info(`${PLUGIN_NAME} getApplicableRefactors took ${timeFrom(t0)}`)
  return refactors
}

function getEditsForRefactor(fileName: string, formatOptions: ts.FormatCodeSettings,
  positionOrRange: number | ts.TextRange, refactorName: string,
  actionName: string): ts.RefactorEditInfo | undefined {
  const t0 = now()
  const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName)
  if (!actionName.startsWith(REFACTOR_ACTION_NAME) || !target.containingTarget) {
    return refactors
  }




  const fixName = actionName.substring(REFACTOR_ACTION_NAME.length + 1, actionName.length)
  const fix = codeFixes.find(fix => fix.name === fixName)

  let simpleProject

  if (fix && fix.needSimpleAst !== false || DEBUG && actionName === REFACTOR_ACTION_NAME + '-' + 'debug-pointed-ast') {
    const createSimpleASTProjectT0 = now()
    simpleProject = createSimpleASTProject(info.project)
    info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor createSimpleASTProject took ${timeFrom(createSimpleASTProjectT0)}`)

    const getSourceFileT0 = now()
    target.simpleNode = simpleProject.getSourceFile(fileName).getDescendantAtPos(positionOrRangeToNumber(positionOrRange)) || simpleProject.getSourceFile(fileName)

    if (DEBUG && actionName === REFACTOR_ACTION_NAME + '-' + 'debug-pointed-ast') {
      const newText = `\n/* code fixes target nodes debug. \nsimpleNode: ${target.simpleNode ? target.simpleNode.getKindName() : 'undefined'} \ncontainingTarget: ${getKindName(target.containingTarget.kind)} \ncontainedTarget: ${target.containedTarget ? getKindName(target.containedTarget.kind) : 'undefined'}\n*/`
      return {
        edits: [{
          fileName,
          textChanges: [{
            span: { start: target.containingTarget.getSourceFile().getEnd(), length: newText.length }, // add it right after the class decl
            newText: newText
          }],
        }],
        renameFilename: undefined,
        renameLocation: undefined,
      }
    }

    if (!target.simpleNode) {
      info.project.projectService.logger.info(`${PLUGIN_NAME} no getEditsForRefactor because getDescentantAt pos returned null for fileName=== ${fileName}, actionName == ${actionName}`)
      return refactors
    }
    info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor first getSourceFile() took ${timeFrom(getSourceFileT0)} and node.kind is ${target.simpleNode.getKindName()}`)
  }
  if (!fix) {
    info.project.projectService.logger.info(`${PLUGIN_NAME} no getEditsForRefactor because no fix was found for actionName == ${actionName}`)
    return refactors
  }
  // we are ready, with or without ast-simple to perform the change
  const fixapplyT0 = now()
  fix.apply(target)
  info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor fix.apply() took ${timeFrom(fixapplyT0)}`)
  if (fix.needSimpleAst !== false) {
    const saveSyncT0 = now()
    simpleProject.saveSync()
    info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor saveSync took ${timeFrom(saveSyncT0)}`)
  }
  info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor total time took ${timeFrom(t0)}`)
  return refactors
}




