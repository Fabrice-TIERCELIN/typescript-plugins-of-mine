export interface IThing { }
export interface ITransport extends IThing { }

export class Transport implements ITransport {
  maxSpeed: number = 1
  go(to: { x: number, y: number }): Promise<number> { return Promise.resolve(1) }
}

const o : Object = {};

/**
 * the description for a Vehicle
 */
export class Vehicle extends Transport {
  constructor(iron: number) {
    super()
  }
  engine: { iron: number, gas: Array<string> } = { iron: 3, gas: [] }
  /**
   * 
   * @param strong will start the engines of this vehicle which is necessary to start moving
   */
  public async startEngine(strong: string[]): Promise<boolean> {
    return false
  }
  private p1(): boolean {
    return false
  }
  static s1(): boolean {
    return false
  }
  none(): void {
    if (new Date().getTime()) {
      console.log();
    }
    else {
      console.error();
    }
  }
}
class Car extends Vehicle {
  
}