
/**
 * Add indent to all lines of input string.
 * Empty lines are skipped.
 * @param s The string about to indent
 * @returns Intented string
 */
export function indent(s: string) {
  //const indentSpaces = 4
  //const spaces = Array(indentSpaces).join(" ")
  const spaces = "    "
  return s.replace(/^(?!$)/mg, spaces);
}

/**
 * A class to help create create blocks encapsulated with braces
 * +-----------------------------------+
 * | [prefix] {                        | Brace
 * |    [line]                         |
 * |    ...                            |
 * |    +------------+                 |
 * |    | [prefix] { | Child Brace     |
 * |    | }          |                 |
 * |    +------------+                 |
 * |    [line]                         |
 * | }                                 |
 * +-----------------------------------+
 */
export class Brace {
  /**
   * 
   * brace:       |   nobrace:   | pbrace:         
   * -------------+--------------+--------------
   *              |              |                 
   * [prefix] {   |   [prefix]   |  [prefix]
   *    [line]    |      [line]  |  [line]      
   *    [line]    |      [line]  |  [line]      
   *    ...       |      ...     |  ...         
   * }            |              | 
   *              |              |
   */
  type: "brace" | "nobrace" | "flat" = "brace"

  /**
   * The content
   */
  private list: (string | Brace)[] = []

  /**
   * 
   * @param prefix THe prefix to brance
   */
  constructor(private prefix: string){}

  /**
   * 
   * @param item
   */
  add(item: string | Brace | ((b: BraceCaller) => void)): Brace {
    if(item instanceof Function){
      const proxy = new Proxy(new BraceCaller(this), {
        apply: (target, thisArg, parameters) => {
          target._call(parameters[0])
        }
      })
      item(proxy)
    } else {
      this.list.push(item)
    }
    return this
  }

  toString(): string {
    let result = ""
    for(let s of this.list){
      if(s instanceof Brace){
        result += s.toString() + "\n"
      } else {
        result += s + "\n"
      }
    }
    
    if(this.type != "flat") {
      result = indent(result)
    }
    return this.type == "brace"
      ? `${this.prefix}{\n${result}}\n`
      : `${this.prefix}\n${result}`
  }
}

/**
 * The argument for 
 */
export class BraceCaller extends Function {
  constructor(public brace: Brace){
    super()
  }

  _call(item: string | Brace | ((b: BraceCaller) => void)){
    this.brace.add(item)
  }

  bra(prefix: string): Brace {
    const child = new Brace(prefix)
    this.brace.add(child)
    return child
  }
}

/**
 * Convenient function to create Brace instance.
 * @param prefix 
 * @returns Newly created Brace instance
 */
export function bra(prefix: string): Brace {
  return new Brace(prefix)
}

export function flatBra(prefix: string): Brace {
  const brace = new Brace(prefix)
  brace.type = "flat"
  return brace
}

export function capitalFirst(str: string): string {
  return str.substring(0, 1).toUpperCase() + ((str.length > 1) ? str.substring(1) : "")
}

export function camel2dash(str: string){
  const ret = str.replace(/([A-Z])/g, '-$1').toLowerCase() 
  console.log(ret)
}

