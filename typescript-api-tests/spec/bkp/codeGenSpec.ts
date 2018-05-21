// "use strict";
// var __importDefault = (this && this.__importDefault) || function (mod) {
//     return (mod && mod.__esModule) ? mod : { "default": mod };
// };
// var __importStar = (this && this.__importStar) || function (mod) {
//     if (mod && mod.__esModule) return mod;
//     var result = {};
//     if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
//     result["default"] = mod;
//     return result;
// };
// Object.defineProperty(exports, "__esModule", { value: true });
// const shelljs_1 = require("shelljs");
// const ts_simple_ast_1 = __importDefault(require("ts-simple-ast"));
// const ts = __importStar(require("typescript"));
// let project;
// describe('method delegate interface', () => {
//     const projectPath = `assets/sampleProject1_1_copy`;
//     it(`interfaces`, () => {
//         shelljs_1.rm(`-rf`, projectPath);
//         shelljs_1.cp(`-r`, `assets/sampleProject1`, `${projectPath}`);
//         project = new ts_simple_ast_1.default({
//             tsConfigFilePath: `${projectPath}/tsconfig.json`
//         });
//         // project.saveSync()
//         // project.emit()
//         // expect(project.getDiagnostics().length).toBe(0)
//         const sourceFile = project.getSourceFiles().find(sf => sf.getFilePath().includes(`src/index.ts`));
//         const fn = sourceFile.getFunction('main');
//         // const d = sourceFile.getDiagnostics()
//         const diags = getDiagnosticsInCurrentLocation(project, sourceFile, 61);
//         if (!diags || !diags.length) {
//             return fail();
//         }
//         // console.log(diags, diags.map(d=>d.getMessageText()))// }
//         const diag = diags[0];
//         const child = sourceFile.getChildAtPos(61);
//         // const c2 = findChildContainingPosition(sourceFile, 61)
//         const childInPos = sourceFile.getDescendantAtPos(61);
//         const stmt = childInPos.getAncestors().find(anc => anc.getKind() === ts.SyntaxKind.ExpressionStatement);
//         const fixes = codeFixes.filter(fix => fix.predicate(diag, childInPos));
//         // choose one
//         if (!fixes || !fixes.length) {
//             return fail();
//         }
//         debugger;
//         fixes[0].apply(diag, child);
//         sourceFile.saveSync();
//         project.emit();
//         project.saveSync();
//         project.emit();
//         console.log('Project saved');
//     });
//     doAssert(projectPath);
// });
// const codeFixCreateVariable = {
//     name: 'create variable',
//     config: { variableType: 'const' },
//     predicate: (diag, child) => diag.getCode() === 2304 && // Cannot find name 'i'
//         child.getKind() === ts.SyntaxKind.Identifier &&
//         child.getParent().getKind() === ts.SyntaxKind.BinaryExpression &&
//         child.getParent().getParent().getKind() === ts.SyntaxKind.ExpressionStatement,
//     description: (diag, child) => `Create variable "${child.getText()}"`,
//     // apply: (diag: Diagnostic, child: Node)=>{child.getSourceFile().insertText(child.getStart(false), 'const ')}
//     apply: (diag, child) => {
//         // child.getSourceFile().insertText(child.getStart(false), 'const '); 
//         child.getSourceFile().insertText(child.getStart(), '/* sebababab */');
//         // child.getSourceFile().applyTextChanges()
//     }
// };
// const codeFixes = [
//     codeFixCreateVariable
// ];
// /** return the first diagnosis */
// function getDiagnosticsInCurrentLocation(project, sourceFile, position) {
//     const file = typeof sourceFile === 'string' ? project.getSourceFile(sourceFile) : sourceFile;
//     return file.getDiagnostics().filter(d => d.getStart() <= position && position <= d.getStart() + d.getLength());
//     // d.getSourceFile().getLineNumberFromPos() ===file.getLineNumberFromPos(position))
// }
// // export function findChildContainingPosition(sourceFile: SourceFile, position: number): Node | undefined {
// //   let found:Node
// //   function find(node:  Node, stop: ()=>void):void {
// //     if (position >= node.getStart() && position < node.getEnd()) {
// //       node.forEachChild(find)
// //       if(!found){
// //         found= node
// //         stop()
// //       }
// //     }
// //   }
// //   find(sourceFile, ()=>{})
// //   return found
// // }
// function doAssert(projectPath) {
//     it('interface should contain delegate method signatures', () => {
//         // expect(cat(`${projectPath}/src/index.ts`).toString()).toContain('getCurrentSpeed(): number;')
//     });
//     it(`project should compile OK`, () => {
//         // project.saveSync()
//         // project.emit()
//         // expect(project.getDiagnostics().length).toBe(0)
//         // // console.log(project.getDiagnostics().map(d=>d.getMessageText()).join('\n'))
//     });
// }
// //# sourceMappingURL=codeGenSpec.js.map