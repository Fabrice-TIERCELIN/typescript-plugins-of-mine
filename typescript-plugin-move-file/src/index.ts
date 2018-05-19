import { lstatSync } from 'fs';
import { now } from 'hrtime-now';
import { basename, dirname, join, isAbsolute } from 'path';
import Project from 'ts-simple-ast';
import { LanguageServiceOptionals, getPluginCreate } from 'typescript-plugin-util';
// import { findChildContainingRange, positionOrRangeToRange, isDeclaration, hasDeclaredType, positionOrRangeToNumber, getKindName } from 'typescript-ast-util';
import * as ts_module from 'typescript/lib/tsserverlibrary';





const PLUGIN_NAME = 'typescript-plugin-move-file'
const REFACTOR_ACTION_NAME = `${PLUGIN_NAME}-refactor-action`

let ts: typeof ts_module
let info: ts_module.server.PluginCreateInfo

const pluginDefinition: LanguageServiceOptionals = {
  getApplicableRefactors, getEditsForRefactor
}

export = getPluginCreate(pluginDefinition, (modules, anInfo) => {
  ts = modules.typescript
  info = anInfo
  info.project.projectService.logger.info(`${PLUGIN_NAME} created`)
})

let selectedAction: Action
function getApplicableRefactors(fileName: string, positionOrRange: number | ts.TextRange)
  : ts.ApplicableRefactorInfo[] {

  const t0 = now()
  const refactors = info.languageService.getApplicableRefactors(fileName, positionOrRange) || []
  const program = info.languageService.getProgram()
  const sourceFile = program.getSourceFile(fileName)

  if (!sourceFile) {
    return refactors
  }

  const actions: Action[] = findActions(sourceFile, pluginConfig)

  if (!actions || actions.length === 0) {
    return refactors
  }
  selectedAction = actions[0]

  const refactorActions = [{ name: REFACTOR_ACTION_NAME + '-' + selectedAction.action, description: printAction(selectedAction) }]
  // if(lastMove){
  //   refactorActions.push({ name: REFACTOR_ACTION_NAME+'-undoLastMove', description: printAction(selectedAction) })
  // }
  refactors.push({
    name: `${PLUGIN_NAME}-refactor-info`,
    description: 'move-file-action',
    actions: refactorActions
  })

  info.project.projectService.logger.info(`${PLUGIN_NAME} getApplicableRefactors took ${(now() - t0) / 1000000}`)
  return refactors
}



let lastMove: Action

function getEditsForRefactor(fileName: string, formatOptions: ts.FormatCodeSettings,
  positionOrRange: number | ts_module.TextRange, refactorName: string,
  actionName: string): ts.RefactorEditInfo | undefined {
  const t0 = now()

  const refactors = info.languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName)

  if (!actionName.startsWith(REFACTOR_ACTION_NAME) || !selectedAction) {
    return refactors
  }

  // now we create a ts-simple-ast project from current one and call move operation on corresponding file
  // according to selectedAction

  const simpleProject = createSimpleASTProject(info.project)
  // TODO: could we maintain a simple-ast Project in a variable and next time just refresh it so is faster ? 

  if ((selectedAction.action === 'moveThisFileTo' || selectedAction.action === 'moveThisFolderTo') && selectedAction.args.dest) {
    try {
      
      selectedAction.args.dest = isAbsolute(selectedAction.args.dest) ? selectedAction.args.dest : 
        join(basename(fileName), selectedAction.args.dest)

      let dest:string

      if (lstatSync(selectedAction.args.dest).isDirectory()) {
        dest = join(selectedAction.args.dest, basename(fileName))
      }
      else if (lstatSync(dirname(selectedAction.args.dest)).isFile()) {
        throw new Error(`File ${selectedAction.args.dest} already exists - we don't override`)
      }
      else if (!lstatSync(selectedAction.args.dest).isDirectory() || !lstatSync(dirname(selectedAction.args.dest)).isDirectory()) {
        //ERROR
        throw new Error(`${selectedAction.args.dest} parent folder does not exists - we don't create folders automatically`)
      }
      if (dest) {
        info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor moving file ${fileName} to ${dest}`)
        if(selectedAction.action === 'moveThisFileTo'){
          simpleProject.getSourceFileOrThrow(fileName).moveImmediatelySync(dest)
        }
        if(selectedAction.action === 'moveThisFolderTo'){
          simpleProject.getDirectoryOrThrow(fileName).moveImmediatelySync(dest)
        }
        simpleProject.saveSync()
        lastMove = { action: 'undoLastMove', args: { dest, source: fileName } }
      }
    } catch (error) {
      info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor error ${error + '' + ' - ' + error.stack}`)
      return refactors
    }
  }
  else if (selectedAction.action === 'undoLastMove' && lastMove) {
    //not implemented yet
  }
  info.project.projectService.logger.info(`${PLUGIN_NAME} getEditsForRefactor took ${(now() - t0) / 1000000}`)
}




function findActions(sourceFile: ts_module.SourceFile, config: Config): Action[] {
  const actions: Action[] = []
  const fileStr = sourceFile.getText()
  const lines = fileStr.split('\n') //TODO: use new line format in tsconfig
  lines.forEach(line => {
    const i = line.indexOf(config.prefix)
    if (i === -1) {
      return
    }
    const userCall = line.substr(i + config.prefix.length, line.length)
    try {
      const result = eval(config.allActionsEvalPrefix + ';' + userCall)
      if (result && typeof result === 'object') {
        actions.push(result)
      }
    } catch (ex) {
    }
  })
  return actions
}

function printAction(action: Action): string {
  if (action.action === 'moveThisFileTo') {
    return 'Move this file to ' + action.args.dest
  }
  else {
    return 'Move this folder to ' + action.args.dest
  }
}

const pluginConfig = {
  prefix: '&%&%', // TODO: from info.config
  allActionsEvalPrefix: `
function moveThisFileTo(path){return {action: 'moveThisFileTo', args: {dest: path} }};
function moveThisFolderTo(path){return {action: 'moveThisFolderTo', args: {dest: path} }};
function undoLastMove(){return {action: 'undoLastMove', args: {} }};
`
}

interface Config {
  prefix: string,
  allActionsEvalPrefix: string
}
interface Action {
  action: string
  args: { [key: string]: string }
}


/**dirty way of getting path to config file of given program */
function getConfigFilePath(project: ts_module.server.Project) {
  // TODO: better find current project tsconfig file
  return project.getFileNames().find(p => basename(p.toString()) === 'tsconfig.json')
}
/** dirty way of creating a ts-simple-ast Project from an exiting ts.server.Project */
function createSimpleASTProject(project: ts_module.server.Project): Project {
  return new Project({
    tsConfigFilePath: getConfigFilePath(info.project)
  });
}
// const project = new Project({
//   tsConfigFilePath: getConfigFilePath(info.project)
// });