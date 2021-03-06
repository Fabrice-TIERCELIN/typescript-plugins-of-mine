import { moveNode } from '../src/moveNode';
import { assertProjectNoErrors, createProject, sourceFileEquals } from './testUtil';

describe('testing dependencies from libraries', () => {


  it('dependencies from libraries', () => {

    const project = createProject()

    const f2File = project.createSourceFile('f2.ts', `
import {f1} from 'a-library-f1'
function f3(a:any){}
export function f4(a){
  return f2(f1(a))
}
function f2(a:any){
  return f3(f1(2))
}
`)

    const f2 = f2File.getFunction('f2')

    const destFile = project.createSourceFile('dest.ts', '')

    assertProjectNoErrors(project, [2307])//  2307 - Cannot find module 'a-library-f1'.

    moveNode(f2, destFile, project)

    assertProjectNoErrors(project, [2307])//  2307 - Cannot find module 'a-library-f1'.

    sourceFileEquals(destFile, `
import { f1 } from "a-library-f1"; 
import { f3 } from "./f2"; 
export function f2(a: any) { 
  return f3(f1(2)) 
}
 `)


    sourceFileEquals(f2File, `
import { f1 } from 'a-library-f1'; 
import { f2 } from "./dest"; 
export function f3(a:any){} 
export function f4(a){ 
  return f2(f1(a)) 
}
`)

  })


  it('imports with multiple names - failing', () => {

    const project = createProject()
    const f1File = project.createSourceFile('f1.ts', `
export function f1(){}
export const x=1
export interface a {}
  `)

    const f2File = project.createSourceFile('f2.ts', `
import {x, f1, a} from './f1'
function f3(){
  const aux = x + 1
  return f1()
}
interface b extends a {}
  `)
    const f1 = f1File.getFunction('f1')

    const destFile = project.createSourceFile('dest.ts', '')
    assertProjectNoErrors(project)
    moveNode(f1, destFile, project)
    assertProjectNoErrors(project)
    sourceFileEquals(destFile, `
export function f1() {
}
  `)
    sourceFileEquals(f1File, `
export const x=1
export interface a {}
   `)

    sourceFileEquals(f2File, `
import {x, a} from './f1' 
import { f1 } from "./dest"; 
function f3(){ const aux = x + 1 return f1() } 
interface b extends a {}
  `)

  })



  it('default imports', () => {

    const project = createProject()
    const f1File = project.createSourceFile('f1.ts', `
export default function f1(){return 'default1'}
function aux(){return f1()}
  `)

    const f2File = project.createSourceFile('f2.ts', `
import utility1 from './f1'
export default function(){return 'default2'+utility1()}
  `)
    const f1 = f1File.getFunction('f1')

    const destFile = project.createSourceFile('dest.ts', '') // TODO What happens if dest.ts already has a default export ? we should abort

    assertProjectNoErrors(project) //  2307 - Cannot find module 'a-library-f1'.
    moveNode(f1, destFile, project)
    assertProjectNoErrors(project)

    sourceFileEquals(destFile, `
export default function f1() { return 'default1' }
  `)
    sourceFileEquals(f1File, `
import f1 from "./dest"; 
function aux(){return f1()}
   `)

    sourceFileEquals(f2File, `
import utility1 from "./dest"; 
export default function(){return 'default2'+utility1()}
 `)

  })



  it('alias imports', () => {

    const project = createProject()
    const f1File = project.createSourceFile('f1.ts', `
export interface I1 {}
export interface another {
  method(i1:I1): void
}
  `)

    const f2File = project.createSourceFile('f2.ts', `
import {I1 as Interface1} from './f1'
export interface I2 extends Interface1{}
  `)
    const i1 = f1File.getInterface('I1')

    const destFile = project.createSourceFile('dest.ts', '')
    assertProjectNoErrors(project)

    moveNode(i1, destFile, project)

    assertProjectNoErrors(project)

    sourceFileEquals(destFile, `
    export interface I1 {
    }
      `)
    sourceFileEquals(f1File, `
     import { I1 } from "./dest";
    export interface another {
      method(i1:I1): void
    }
   `)

    sourceFileEquals(f2File, ` 
    import { I1 as Interface1 } from "./dest";

    export interface I2 extends Interface1{}
 `)

  })
})
