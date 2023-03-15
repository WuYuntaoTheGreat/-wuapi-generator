import { $ElementPath, $Entity, $EntityType, $Enum, $Field, $FieldType, $Project, $TEnum, $TList, $TObject, $TUnknown } from "@wuapi/essential";
import _ from "lodash";
import path from "path";
import { bra, BraceCaller, flatBra } from "./brace";
import { BasePlugin, PluginDescription, ProjectProcessor, toBlockComment, toLineComment } from "./plugin_base";
import fs from 'fs'
import dedent from "dedent";

/**
 * Java code plugin.
 */
export default class JavaPlugin extends BasePlugin {

  /**
   * Returns the description of this plugin.
   */
  getDescription(): PluginDescription {
    return {
      name: "java",
      abbreviation: "j",
      version: "1.0.0",
      description: "Generate Java code.",
      arguments: [],
    }
  }

  process(project: $Project, outputDir: string, args: {[key: string]: string}): void {
    new JavaProcessor(this, project, outputDir).process()
  }
}

/**
 * The Java project processor
 */
class JavaProcessor extends ProjectProcessor {
  readonly packageDir: string

  constructor(plugin: BasePlugin, project: $Project, outputDir: string) {
    super(plugin, project, outputDir)
    this.packageDir = _.concat([ this.rootDir ], this.project.targetPackage.split('.')).join(path.sep)
  }

  /**
   * Write text into java file.
   * @param name The name of this file (without extension).
   * @param text The content of the file
   */
  writeJavaFile(name: string, text: string){
    // TODO: ignoring module, all files in the same package.
    const filePath = this.packageDir + path.sep + name + ".java"

    const file = fs.openSync(filePath, 'w')
    fs.writeFileSync(file, dedent`
      package ${this.project.targetPackage};
      import java.util.*;

    `+ text)
  }

  /**
   * Write an entity.
   * @param pth The path to the entity.
   * @param entity The entity
   */
  writeEntity(pth: $ElementPath, entity: $Entity) {
    const self = this

    //
    function memberTypeName(type: $TList): string {
      switch(type.member.type) {
        case "TBoolean"     : return "Boolean"
        case "TInteger"     : return "Integer"
        case "TLong"        : return "Long"
        case "TID"          : return "Long"
        case "TDouble"      : return "Double"
        case "TString"      : return "String"
        case "TURL"         : return "String"
        case "TDateTime"    : return "String"
        case "TSSMap"       : return "HashMap<String, String>"
        case "TEnum"        : return (type.member as $TEnum).enu.name!
        case "TObject"      : return (type.member as $TObject).entity.name!
        case "TUnknown"     : return (type.member as $TUnknown).unknown
        case "TList"        : throw Error("List can not contain list!")
        default : throw new Error(`Unknown list type "${type.type}" in "${pth.module}/${pth.name}"`)
      }
    }

    //
    function genericTypeName(type: $FieldType): string {
      switch(type.type) {
        case "TBoolean"     : return "Boolean"
        case "TInteger"     : return "Integer"
        case "TLong"        : return "Long"
        case "TID"          : return "Long"
        case "TDouble"      : return "Double"
        case "TString"      : return "String"
        case "TURL"         : return "String"
        case "TDateTime"    : return "String"
        case "TSSMap"       : return "HashMap<String, String>"
        case "TEnum"        : return (type as $TEnum).enu.name!
        case "TObject"      : return (type as $TObject).entity.name!
        case "TUnknown"     : return (type as $TUnknown).unknown
        case "TList"        : return memberTypeName(type as $TList)
        default : throw new Error(`Unknown generic type "${type.type}" in "${pth.module}/${pth.name}"`)
      }
    }

    //
    function generateFixedValue(name: string, f: $Field): string {
      switch(f.type.type) {
        case "TBoolean"     : return `public final boolean ${name} = ${f.fixedValue as boolean};`
        case "TInteger"     : return `public final int ${name} = ${f.fixedValue as number};`
        case "TLong"        : return `public final long ${name} = ${f.fixedValue as number}L;`
        case "TID"          : return `public final long ${name} = ${f.fixedValue as number}L;`
        case "TDouble"      : return `public final double ${name} = ${f.fixedValue as number};`
        case "TString"      : return `public final String ${name} = "${f.fixedValue as string}";`
        case "TURL"         : return `public final String ${name} = "${f.fixedValue as string}";`
        case "TDateTime"    : return `public final String ${name} = "${f.fixedValue as string}";`
        default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" can NOT have fixed value!`)
      }
    }

    //
    function generateOptionalValue(name: string, f: $Field): string {
      switch(f.type.type) {
        case "TBoolean"     : return `public Boolean ${name} = null;`
        case "TInteger"     : return `public Integer ${name} = null;`
        case "TLong"        : return `public Long ${name} = null;`
        case "TID"          : return `public Long ${name} = null;`
        case "TDouble"      : return `public Double ${name} = null;`
        case "TString"      : return `public String ${name} = null;`
        case "TURL"         : return `public String ${name} = null;`
        case "TDateTime"    : return `public String ${name} = null;`
        case "TSSMap"       : return `public HashMap<String, String> ${name} = null;`
        case "TEnum"        : return `public ${(f.type as $TEnum).enu.name} ${name} = null;`
        case "TObject"      : return `public ${(f.type as $TObject).entity.name} ${name} = null;`
        case "TUnknown"     : return `public ${(f.type as $TUnknown).unknown} ${name} = null;`
        case "TList"        : return `public List<${memberTypeName((f.type as $TList))}> ${name} = null;`
        default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" is invalid.`)
      }
    }

    //
    function generateDefaultValue(name: string, f: $Field): string {
      switch(f.type.type) {
        case "TBoolean"     : return `public boolean ${name};`
        case "TInteger"     : return `public int ${name};`
        case "TLong"        : return `public long ${name};`
        case "TID"          : return `public long ${name};`
        case "TDouble"      : return `public double ${name};`
        case "TString"      : return `public String ${name} = \"\";`
        case "TURL"         : return `public String ${name} = \"\";`
        case "TDateTime"    : return `public String ${name} = \"\";`
        case "TSSMap"       : return `public HashMap<String, String> ${name} = new HashMap<>();`
        case "TObject"      : return `public ${(f.type as $TObject).entity.name} ${name} = null;`
        case "TUnknown"     : return `public ${(f.type as $TUnknown).unknown} ${name} = null;`
        case "TList"        : return `public List<${memberTypeName((f.type as $TList))}> ${name} = new LinkedList<>();`
        case "TEnum"        : {
          let fe = f.type as $TEnum
          return `public ${fe.enu.name} ${name} = ${fe.enu.name}.${fe.enu.asEnumOf(self.project)!.first()};`
        }
        default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" is invalid.`)
      }
    }


    //
    function calcSuffix(extra?: string): string {
      let unsolved = entity.getGenericUnsolved(self.project)
      if(extra){
        unsolved = _.concat(unsolved, [extra])
      }
      return ( unsolved.length > 0 ) ? `<${unsolved.join(", ")}>` : ""
    }

    //
    function calcExtSuffix(extra?: string): string {
      let punsolved = entity.parent?.asEntityOf(self.project)?.getGenericUnsolved(self.project) ?? []
      let unsolved: string[] = []

      punsolved.forEach((name) => {
        let solved = entity.genericMap[name]
        let item = (solved) ? genericTypeName(solved.type) : name
        unsolved.push(item)
      })

      if(extra){
        unsolved = _.concat(unsolved, [extra])
      }
      return ( unsolved.length > 0 ) ?  `<${ unsolved.join(", ") }>` : ""
    }

    //
    function generateField(b: BraceCaller, name: string, f: $Field){
      if(f.realname){
        b(`@SerializedName("${f.realname}")`)
      }
      if(f.fixedValue){
        b(generateFixedValue(name, f))
      } else if(f.isOptional){
        b(generateOptionalValue(name, f))
      } else {
        b(generateDefaultValue(name, f))
      }
    }


    this.writeJavaFile(pth.name!, flatBra("").add((b) => {
      // b(toBlockComment(entity))

      const prefix = (entity.isAbstract) ? "abstract" : ""

      switch(entity.type){
        ////////////////////
        // REQUEST
        ////////////////////
        case $EntityType.REQUEST: {
          let resName = entity.response?.name
          let pname = entity.parent?.name ?? "AbsReq"
          let suffix = calcSuffix((entity.isAbstract) ? "R extends AbsRes" : undefined)
          let extSuf = calcExtSuffix((entity.isAbstract) ? "R" : (resName ?? undefined))

          b.bra(`public ${prefix} class ${pth.name}${suffix} extends ${pname}${extSuf}`).add((b) => {
            if(!entity.isAbstract) {
              b(dedent`
                Override
                public String obtainPath() {
                  return "${entity.path}";
                }

                @Override
                public String obtainMethod() {
                    return "${entity.method}";
                }

                @Override
                public Class<? extends ${resName}> obtainResClass() {
                    return $resName.class;
                }
              `)
            }
            //
            _.forIn(entity.fieldsLocal, (f, name) => {
                generateField(b, name, f)
            })
          })

          break
        }

        ////////////////////
        // RESPONSE
        ////////////////////
        case $EntityType.RESPONSE: {
          let pname = entity.parent?.name ?? "AbsRes"
          let suffix = calcSuffix()
          let extSuf = calcExtSuffix()
          b.bra(`public ${prefix} class ${pth.name}${suffix} extends ${pname}${extSuf}`).add((b) => {
            //
            _.forIn(entity.fieldsLocal, (f, name) => {
                generateField(b, name, f)
            })
          })

          break
        }

        ////////////////////
        // OBJECT
        ////////////////////
        case $EntityType.OBJECT: {
          let extendString = (entity.parent) ? `extends ${entity.parent.name}` : ""
          let suffix = calcSuffix()
          let extSuf = calcExtSuffix()

          b.bra(`public ${prefix} class ${pth.name}${suffix} ${extendString}${extSuf}`).add((b) => {
            //
            _.forIn(entity.fieldsLocal, (f, name) => {
                generateField(b, name, f)
            })
          })

          break
        }
      }

    }).toString()) 
  }

  /**
   * Write an enumeration
   * @param pth The path to the enumeration
   * @param enu The enumeration.
   */
  writeEnum(pth: $ElementPath, enu: $Enum){ this.writeJavaFile(pth.name!, flatBra("").add((b) => {
    // b(toBlockComment(enu))

    b.bra(`public enum ${pth.name}`).add((b) => {

      enu.flat().forEach(({name, item}) => {
        // b(toLineComment(item))
        b(`${name}(${item.value}),`)
      })

      b(dedent`
          ;
          
          private int value;
          private ${pth.name}(int value) {
              this.value = value;
          }
          public int getValue() {
              return value;
          }
      `)
      b.bra(`public static ${pth.name} find(int value)`).add((b) => {
        b.bra("switch(value)").add((b) => {
          enu.flat().forEach(({name, item}) => {
            b(`case ${item.value}: return ${name};`)
          })
          b("default: return null;")
        })
      })
    })

  }).toString())}

  /**
   * Process the project.
   */
  process() {
    fs.rmSync(this.rootDir, { recursive: true, force: true})
    fs.mkdirSync(this.packageDir, { recursive: true })

    this.writeJavaFile("AbsReq", dedent`
      public abstract class AbsReq<R extends AbsRes> {
          public abstract String obtainPath();
          public abstract String obtainMethod();
          public abstract Class<? extends R> obtainResClass();
          public abstract Hashtable<String, String> obtainExtra();
      }
    `)

    this.writeJavaFile("AbsRes", dedent`
      public abstract class AbsRes {
          public abstract int obtainSuccessCode();
          public abstract Hashtable<String, String> obtainExtra();
      }
    `)

    this.project.flatEntities().forEach(({path, entity}) => {
      this.writeEntity(path, entity)
    })

    this.project.flatEnums().forEach(({path, enu}) => {
      this.writeEnum(path, enu)
    })
  }

}
