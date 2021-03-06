import { Project, SourceFile } from 'ts-simple-ast';
import { moveNode } from '../src/moveNode';
import { printSourceFile, printProjectDiagnostics, assertProjectNoErrors, createProject } from './testUtil';


describe('moveNode', ()=>{
  it('basic', ()=>{

    const project = createProject()

    const lionFile = project.createSourceFile('src/animal/lion/Lion.ts', `
    import {Food} from '../../food/Food'
    import {Animal} from '../Animal'
    export class Lion extends Animal{
      eat(meat: Food){}
    }
    `)
    const animalFile = project.createSourceFile('src/animal/Animal.ts', `
    export class Animal {
      breath(air: number){}
    }
    `)
    const energyFile = project.createSourceFile('src/energy/Energy.ts', `
    export class Energy {
      burn(): number {return 1}
    }
    `)
    
    const foodFile = project.createSourceFile('src/food/Food.ts', `
    import {Animal} from '../animal/Animal'
    import {Energy} from '../energy/Energy'
    export class Food {
      energy: Energy
      canEatBy: Animal[]
    }
    `)
    
    const Food = foodFile.getClass('Food')
    const tmpFile = project.createSourceFile('tmp.ts', '')
    
    // printProjectDiagnostics(project);
    assertProjectNoErrors(project)
    moveNode(Food, animalFile, project)
    // console.log(printSourceFile(lionFile));
    assertProjectNoErrors(project)
    
    expect(printSourceFile(foodFile)).toEqual('')
    expect(printSourceFile(animalFile)).toEqual('import { Energy } from "../energy/Energy"; export class Food { energy: Energy; canEatBy: Animal[]; } export class Animal { breath(air: number){} }')
    expect(printSourceFile(lionFile)).toEqual(`import {Animal} from '../Animal' import { Food } from "../Animal"; export class Lion extends Animal{ eat(meat: Food){} }`)
  
  })
})

