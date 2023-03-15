import { $ElementPath, $Enum, $Entity, $Project, $EntityType, $FieldType, $TObject, $TEnum, $TList, $TUnknown, $Field } from "@wuapi/essential";
import { BasePlugin, PluginDescription, ProjectProcessor } from "./plugin_base";
import fs from 'fs'
import path from "path";
import { BraceCaller, flatBra } from "./brace";
import dedent from "dedent";
import _ from "lodash";

/**
 * Swift code plugin.
 */
export default class SwiftPlugin extends BasePlugin {

  /**
   * Returns the description of this plugin.
   */
  getDescription(): PluginDescription {
    return {
      name: "swift",
      abbreviation: "s",
      version: "1.0.0",
      description: "Generate Swift code.",
      arguments: [],
    }
  }

  process(project: $Project, outputDir: string, args: {[key: string]: string}): void {
    new SwiftProcessor(this, project, outputDir).process()
  }
}

/**
 * The Swift project processor
 */
class SwiftProcessor extends ProjectProcessor {

  /**
   * Write entity
   */
  writeEntity(b: BraceCaller, pth: $ElementPath, entity: $Entity) {
    const self = this

    //
    function calcSuffix(extra?: string): string {
      let unsolved = entity.getGenericUnsolved(self.project)
      if(extra){
        unsolved = _.concat(unsolved, [extra])
      }
      return (unsolved.length > 0) ? `<${unsolved.join(", ")}>` : ""
    }

    //
    function calcExtSuffix(extra?: string): string {
        let punsolved = entity.parent?.asEntityOf(self.project)?.getGenericUnsolved(self.project) ?? []
        let result: string[] = []

        punsolved.forEach((name) => {
          let solved = entity.genericMap[name]
          let item = (solved) ? genericTypeName(solved.type) : name
          result.push(item)
        })

        if(extra){
          result.push(extra)
        }

        return (result.length > 0) ? `<${result.join(", ")}>` : ""
    }

    //
    function memberTypeName(type: $TList): string {
      switch(type.member.type) {
        case "TBoolean"  : return "Bool"
        case "TInteger"  : return "Int"
        case "TLong"     : return "Int64"
        case "TID"       : return "Int64"
        case "TDouble"   : return "Double"
        case "TString"   : return "String"
        case "TURL"      : return "String"
        case "TDateTime" : return "String"
        case "TSSMap"    : return "[String: String]"
        case "TEnum"     : return (type.member as $TEnum).enu.name!
        case "TObject"   : return (type.member as $TObject).entity.name!
        case "TUnknown"  : return (type.member as $TUnknown).unknown
        case "TList"     : throw Error("List can not contain list!")
        default : throw new Error(`Unknown list type "${type.member.type}" in "${pth.module}/${pth.name}"`)
      }
    }

    //
    function genericTypeName(type: $FieldType): string {
      switch(type.type) {
        case "TBoolean"  : return "Bool"
        case "TInteger"  : return "Int"
        case "TLong"     : return "Int64"
        case "TID"       : return "Int64"
        case "TDouble"   : return "Double"
        case "TString"   : return "String"
        case "TURL"      : return "String"
        case "TDateTime" : return "String"
        case "TSSMap"    : return "[String: String]"
        case "TEnum"     : return (type as $TEnum).enu.name!
        case "TObject"   : return (type as $TObject).entity.name!
        case "TList"     : return memberTypeName(type as $TList)
        default : throw new Error(`Unknown generic type "${type.type}" in "${pth.module}/${pth.name}"`)
      }
    }

    //
    function generateField(name: string, f: $Field): string {
      // b(f.comments.toLineComment()

      if(f.fixedValue){ 
        switch(f.type.type) {
          case "TBoolean"  : return `public var ${name}: Bool = ${f.fixedValue};`
          case "TInteger"  : return `public var ${name}: Int = ${f.fixedValue};`
          case "TLong"     : return `public var ${name}: Int64 = ${f.fixedValue};`
          case "TID"       : return `public var ${name}: Int64 = ${f.fixedValue};`
          case "TDouble"   : return `public var ${name}: Double = ${f.fixedValue};`
          case "TString"   : return `public var ${name}: String = "${f.fixedValue}";`
          case "TURL"      : return `public var ${name}: String = "${f.fixedValue}";`
          case "TDateTime" : return `public var ${name}: String = "${f.fixedValue}";`
          default: throw Error(`Field '${name}' in "${pth.module}/${pth.name}" with type ${f.type.type} can NOT have fixed value!`)
        }
      } else if(f.isOptional) {
        switch(f.type.type){
          case "TBoolean"  : return `public var ${name}: Bool? = nil`
          case "TInteger"  : return `public var ${name}: Int? = nil`
          case "TLong"     : return `public var ${name}: Int64? = nil`
          case "TID"       : return `public var ${name}: Int64? = nil`
          case "TDouble"   : return `public var ${name}: Double? = nil`
          case "TString"   : return `public var ${name}: String? = nil`
          case "TURL"      : return `public var ${name}: String? = nil`
          case "TDateTime" : return `public var ${name}: String? = nil`
          case "TSSMap"    : return `public var ${name}: [String: String]? = nil`
          case "TEnum"     : return `public var ${name}: ${(f.type as $TEnum).enu.name}? = nil`
          case "TObject"   : return `public var ${name}: ${(f.type as $TObject).entity.name}? = nil`
          case "TList"     : return `public var ${name}: [${memberTypeName(f.type as $TList)}]? = nil`
          case "TUnknown"  : return `public var ${name}: ${(f.type as $TUnknown).unknown}? = nil`
          default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" is invalid.`)
        }
      } else {
        switch(f.type.type) {
          case "TBoolean"  : return `public var ${name}: Bool = false`
          case "TInteger"  : return `public var ${name}: Int = 0`
          case "TLong"     : return `public var ${name}: Int64 = 0`
          case "TID"       : return `public var ${name}: Int64 = 0`
          case "TDouble"   : return `public var ${name}: Double = 0`
          case "TString"   : return `public var ${name}: String = ""`
          case "TURL"      : return `public var ${name}: String = ""`
          case "TDateTime" : return `public var ${name}: String = ""`
          case "TSSMap"    : return `public var ${name}: [String: String] = [:]()`
          case "TEnum"     : {
            let fe = f.type as $TEnum
            return `public var ${name}: ${fe.enu.name} = ${fe.enu.name}.${fe.enu.asEnumOf(self.project)!.first()}`
          }
          case "TObject"   : {
            let fo = f.type as $TObject
            return `public var ${name}: ${fo.entity.name} = ${fo.entity.name}()`
          }
          case "TList"     : {
            let fl = f.type as $TList
            if(fl.member.type == "TUnknown") {
              return `public var ${name}: [${(fl.member as $TUnknown).unknown}] = [${(fl.member as $TUnknown).unknown}]()`
            } else {
              return `public var ${name}: [${memberTypeName(fl)}] = [${memberTypeName(fl)}]()`
            }
          }
          case "TUnknown" : throw Error(`Field '${name}' in "${pth.module}/${pth.name}" can NOT be unknown!`)
          default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" is invalid.`)
        }
      }
    }

    // b(toBlockComment(entity))

    let suffix = ""
    let pname = ""
    let extSuf = ""

    switch(entity.type){
      case $EntityType.REQUEST: {
        let resName = entity.response?.name
        pname = entity.parent?.name ?? 'AbsReq'
        suffix = calcSuffix(entity.isAbstract ? "R: AbsRes" : undefined)
        extSuf = calcExtSuffix(entity.isAbstract ? "R" : (resName ?? undefined))
        break
      }

      case $EntityType.RESPONSE: {
        pname = entity.parent?.name ?? 'AbsRes'
        suffix = calcSuffix()
        extSuf = calcExtSuffix()
        break
      }

      case $EntityType.OBJECT: {
        pname = entity.parent?.name ?? 'AbsBase'
        suffix = calcSuffix()
        extSuf = calcExtSuffix()
        break
      }
    }

    b.bra(`public class ${pth.name}${suffix}: ${pname}${extSuf}`).add((b) => {
      if (entity.type == $EntityType.REQUEST && !entity.isAbstract) {
        b(dedent`
          public override func obtainPath() -> String {
            return "${entity.path}"
          }
        `)

        b(dedent`
          public override func obtainMethod() -> String {
            return "${entity.method}"
          }
        `)
      }

      b(dedent`
        public required init?(map: Map) {
          super.init(map: map)
        }
        public required init(){
            super.init()
        }\n
      `)


      _.forIn(entity.fieldsLocal, (f, name) => {
        b(generateField(name, f))
      })

      b.bra("public override func mapping(map: Map)").add((b) => {
        b("super.mapping(map: map)")

        _.forIn(entity.fieldsLocal, (f, name) => {
          // TODO: filter out generics ?
          let realname = f.realname ?? pth.name 
          b(`${pth.name} <- map["${realname}"]`)
        })

      })
    })
  }


  /**
   * Write enum class
   */
  writeEnum(b: BraceCaller, pth: $ElementPath, enu: $Enum) {
      b.bra(`public enum ${pth.name}: String`).add((b) => {
        // enu.intMap.keys.sorted().forEach {
        enu.flat().forEach(({name, item}) => {
            b(`case ${name}`)
        })
        b("")

        b.bra("public func code() -> Int").add((b) => {
          b.bra("switch self").add((b) => {
            enu.flat().forEach(({name, item}) => {
                b(`case .${name}: return ${item.value}`)
            })
          })
        })
      })
  }

  /**
   * Process the project.
   */
  process(): void {
    fs.rmSync(this.rootDir, { recursive: true, force: true})
    fs.mkdirSync(this.rootDir, { recursive: true })
    const filePath = this.rootDir + path.sep + `${this.project.name}Entities.swift`

    const file = fs.openSync(filePath, 'w')
    fs.writeFileSync(file, flatBra("").add((b) => {
      b(dedent`
        public class AbsBase: NSObject, Mappable {
            public required init?(map: Map){}
            public override required init(){}
            public func mapping(map: Map){}
            public func obtainExtra() -> [String:String] { return [String:String]() }
        }

        public class AbsReq<T: AbsRes>: AbsBase {
            public func obtainPath() -> String{ return "" }
            public func obtainMethod() -> String {return "" } 
            public func obtainRes(json: String) -> T? { return Mapper<T>().map(JSONString: json) }
            
            public required init?(map: Map) {
                super.init(map: map)
            }
            
            public required init() {
                super.init()
            }
            
            public override func mapping(map: Map) {
                super.mapping(map: map)
            }
        }
        
        public class AbsRes: AbsBase {
            public func obtainSuccessCode() -> Int { return 200 }
            
            public required init?(map: Map) {
                super.init(map: map)
            }
            
            public required init() {
                super.init()
            }
            
            public override func mapping(map: Map) {
                super.mapping(map: map)
            }
        }
      `)

      this.project.flatEntities().forEach(({path, entity}) => {
        this.writeEntity(b, path, entity)
      })

      this.project.flatEnums().forEach(({path, enu}) => {
        this.writeEnum(b, path, enu)
      })

    }).toString())
  }
}
