import {$Project, $ElementPath, $Entity, $Field, $FieldType, $TUnknown, $TObject, $TList, $TEnum} from "@wuapi/essential";
//import { loremIpsum } from "lorem-ipsum";
import { BraceCaller } from "../brace";
import Chance from "chance"
import _ from "lodash"

export default class DemoGenerator {
  get entity (): $Entity {
    return this.path.asEntityOf(this.project)!
  }

  chance = Chance()

  constructor(
    public project: $Project,
    public path: $ElementPath){

  }


  //
  genericTypeName(type: $FieldType): string {
    switch(type.type) {
      case "TBoolean"     : return "Boolean"
      case "TInteger"     : return "Integer"
      case "TLong"        : return "Long"
      case "TID"          : return "Long"
      case "TDouble"      : return "Double"
      case "TString"      : return "String"
      case "TURL"         : return "String"
      case "TDateTime"    : return "Long"
      case "TSSMap"       : return "HashMap<String, String>"
      case "TEnum"        : return (type as $TEnum).enu.name!
      case "TObject"      : return (type as $TObject).entity.name!
      case "TUnknown"     : return (type as $TUnknown).unknown
      case "TList"        : return `List<${this.genericTypeName((type as $TList).member)}>`
      default : throw new Error(`Unknown generic type "${type.type}".`)
    }
  }

  /**
   * Generate field value
   *
   * @param ft The $FieldType object preresenting this field.
   * @param config The demo configuration of this field.
   *
   * @returns The field value as string
   */
  generateField(ft: $FieldType, config: {[key: string]: string} | null) : String {
    let fixed = config?.["fixed"]
    if(fixed){
      return fixed
    }

    switch(ft.type){
      case "TBoolean" : return this.chance.bool().toString()
      case "TLong"    : return this.chance.integer( {min: 0,        max: 10000}   ).toString() + "L"
      case "TID"      : return this.chance.integer( {min: 1000000,  max: 9000000} ).toString() + "L"
      case "TDouble"  : return this.chance.floating({min: 0,        max: 100}     ).toString()
      case "TInteger" : 
        switch(config?.["style"]){
          case "age"  : return this.chance.age().toString()
          default     : return this.chance.integer({min     : 0, max : 100}).toString()
        }

      case "TString" :
        switch(config?.["style"]){
          case "short"    : return `"${this.chance.word()}"`
          case "long"     : return `"${this.chance.paragraph()}"`
          case "name"     : return `"${this.chance.first()}"`
          case "fullname" : return `"${this.chance.name()}"`
          case "phone"    : return `"${this.chance.phone()}"`
          case "country"  : return `"${this.chance.country()}"`
          default         : return `"${this.chance.sentence()}"`
        }

      case "TURL" :
        switch(config?.["style"]){
          case "avatar" : return `"${this.chance.avatar({protocol : 'https'})}"`
          default       : return `"${this.chance.url()}"`
        }

      case "TDateTime" :
        switch(config?.["style"]){
          case "ms" : return this.chance.hammertime().toString() + "L"
          default   : return this.chance.timestamp().toString()  + "L"
        }

      //case "TSSMap" : break

      case "TEnum" : 
        {
          let enuPath = (ft as $TEnum).enu
          let items = enuPath.asEnumOf(this.project)!.flat()
          let itemName = items[this.chance.integer({min: 0, max: items.length - 1})].name
          return `${enuPath.name}.${itemName}`
        }
      //case "TObject"      : break 
      //case "TUnknown"     : break 
      //case "TList"        : break 
      default : throw new Error(`Unknown generic type "${ft.type}".`)
    }
  }

  /**
   * Write function getter of thie field.
   *
   * @param b The BraceCaller for output
   * @param isPublic true if the output function is public, private otherwise.
   */
  asFunction(b: BraceCaller, isPublic: boolean = true) {
    b.bra(`${isPublic ? "public" : "private"} ${this.path.name} get${this.path.name}`).add((b) => {
      this.asFunctionBody(b)
    })
  }

  /**
   * Write function body to output
   *
   * @param b The BraceCaller for output
   * @param idx The index holder
   */
  asFunctionBody(b: BraceCaller, idx?: {n: number}) {
    idx = idx ?? {n: 0}
    const idxN = idx.n

    let fieldMap: {[key: string]: $Field } = {}
    let fieldRef: {[key: string]: number[]} = {}

    // 1st loop, find all fields, assemble generics
    this.entity.fromAncestorToMe(this.project, (ent) => {
      _.forIn(ent.genericMap, (f, key) => {
        const found = _.findKey(fieldMap, (o) => {
          return (o.type.type == "TUnknown") && ((o.type as $TUnknown).unknown == key)
        })
        if(found){
          fieldMap[found] = f
        }
      })

      _.forIn(ent.fieldsLocal, (f, key) => {
        fieldMap[key] = f
      })
    })

    // 2nd loop, recursively generate objects.
    _.forIn(fieldMap, (f, key) => {
      switch(f.type.type){
        case "TObject":
          fieldRef[key] = [++idx!.n]
          new DemoGenerator(this.project, (f.type as $TObject).entity).asFunctionBody(b, idx)
          break

        case "TList":
          if((f.type as $TList).member.type == "TObject") {
            let member = ((f.type as $TList).member as $TObject).entity
            fieldRef[key] = []

            for(let i = 0; i < 3; i++){
              fieldRef[key].push(++idx!.n)
              new DemoGenerator(this.project, member).asFunctionBody(b, idx)
            }
          }
          break
      }
    }) 

    // 3rd loop, write to output
    b(`${this.path.name} object${idxN} = new ${this.path.name}(); `)
    _.forIn(fieldMap, (f, key) => {
      switch(f.type.type){
        case "TSSMap":
          b(`object${idxN}.${key} = new HashMap();`)
          for(let i = 0; i < 3; i++){
            b(`object${idxN}.${key}.put("${this.chance.word()}", "${this.chance.word()}");`)
          }
          break

        case "TObject":
          b(`object${idxN}.${key} = object${fieldRef[key][0]};`)
          break

        case "TList":
          b(`object${idxN}.${key} = new ArrayList<${this.genericTypeName((f.type as $TList).member)}>();`)
          if((f.type as $TList).member.type == "TObject") {
            for(let i = 0; i < fieldRef[key].length; i++){
              b(`object${idxN}.${key}.add(object${fieldRef[key][i]});`)
            }
          } else {
            for(let i = 0; i < 3; i++){
              b(`object${idxN}.${key}.add(${this.generateField((f.type as $TList).member, f.demoConfig)});`)
            }
          }
          break

        default:
          b(`object${idxN}.${key} = ${this.generateField(f.type, f.demoConfig)};`)
          break
      }
    })

    // Finally, write return clause.
    b("")
    if(idxN == 0){
      b("return object0;")
    }
  }
}

