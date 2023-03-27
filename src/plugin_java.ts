import { $ElementPath, $Entity, $EntityType, $Enum, $Field, $FieldType, $Project, $TEnum, $TList, $TObject, $TUnknown } from "@wuapi/essential";
import path from "path";
import fs from 'fs'
import ncp from 'ncp'
import _ from "lodash";
import { BraceCaller, flatBra } from "./brace";
import { BasePlugin, PluginDescription, ProjectProcessor, } from "./plugin_base";
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
      arguments: [
        {
          tag: "getter",
          withValue: false,
          description: "Generate getter/setters of properties",
        },
        {
          tag: "gradle",
          withValue: false,
          description: "Generate gradle project",
        },
        {
          tag: "inc",
          withValue: false,
          description: "Increamental, NOT overriding old files (only work with 'gradle' mode)",
        },
      ],
    }
  }

  /**
   * Process gradle project.
   */
  processGradle(project: $Project, outputDir: string, skip: boolean, next: () => void){
    if(skip){
      next()
      return
    }

    const srcDir = [__dirname, "..", "template", this.getName()].join(path.sep)
    const dstDir = [outputDir, this.getName()].join(path.sep)

    ncp(srcDir, dstDir, (error) => {
      if(error) {
        return console.error(error)
      } 
      const map = {
        "{{project_name}}"     : project.name,
        "{{project_version}}"  : project.version,
        "{{project_package}}"  : project.targetPackage,
      }
      this.rewriteFile(
        [srcDir, "settings.gradle"].join(path.sep),
        [dstDir, "settings.gradle"].join(path.sep),
        map)
      this.rewriteFile(
        [srcDir, "library", "build.gradle"].join(path.sep),
        [dstDir, "library", "build.gradle"].join(path.sep),
        map)

      next()
    })
  }

  /**
   * Start process the project, and generate code.
   */
  process(project: $Project, outputDir: string, args: {[key: string]: string}): void {
    if(args["gradle"] != undefined){
      const javaDir = [outputDir, this.getName(), "library", "src", "main"].join(path.sep)
      fs.mkdirSync(javaDir, {recursive: true})

      this.processGradle(project, outputDir, args["inc"] != undefined, () => {
        new JavaPlugin().process(project, javaDir, _.omit(args, ["gradle", "inc"]))
      })
      return
    }

    new JavaProcessor(this, project, outputDir, args).process()
  }
}

/**
 * The Java project processor
 */
class JavaProcessor extends ProjectProcessor {
  readonly packageDir: string
  get useGetter() { return this.config['getter'] != undefined }

  constructor(
    plugin: BasePlugin,
    project: $Project,
    outputDir: string,
    config: {[key: string]: string},
  ) {
    super(plugin, project, outputDir, config)
    this.packageDir = _.concat([ this.rootDir ], this.project.targetPackage.split('.')).join(path.sep)
  }

  /**
   * Write text into java file.
   * @param name The name of this file (without extension).
   * @param text The content of the file
   */
  writeJavaFile(name: string, text: string){
    const filePath = this.packageDir + path.sep + name + ".java"
    const file = fs.openSync(filePath, 'w')

    fs.writeFileSync(file, dedent`
      package ${this.project.targetPackage};
      import java.util.*; `
    + '\n\n' + text)
  }

  /**
   * Write an entity.
   * @param pth The path to the entity.
   * @param entity The entity
   */
  writeEntity(pth: $ElementPath, entity: $Entity) {
    const self = this

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
        case "TDateTime"    : return "Long"
        case "TSSMap"       : return "HashMap<String, String>"
        case "TEnum"        : return (type as $TEnum).enu.name!
        case "TObject"      : return (type as $TObject).entity.name!
        case "TUnknown"     : return (type as $TUnknown).unknown
        //case "TList"        : return memberTypeName(type as $TList)
        case "TList"        : return `List<${genericTypeName((type as $TList).member)}>`
        default : throw new Error(`Unknown generic type "${type.type}" in "${pth.module}/${pth.name}"`)
      }
    }

    //
    function generateFixedValue(name: string, f: $Field): string {
      let value = ""
      const prefix = self.useGetter ? "private" : "public"
      switch(f.type.type) {
        case "TBoolean"  : value = `${f.fixedValue as boolean}` ; break
        case "TInteger"  : value = `${f.fixedValue as number}`  ; break
        case "TLong"     : value = `${f.fixedValue as number}L` ; break
        case "TID"       : value = `${f.fixedValue as number}L` ; break
        case "TDouble"   : value = `${f.fixedValue as number}`  ; break
        case "TString"   : value =`"${f.fixedValue as string}"` ; break
        case "TURL"      : value =`"${f.fixedValue as string}"` ; break
        case "TDateTime" : value = `${f.fixedValue as number}`  ; break
        default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" can NOT have fixed value!`)
      }
      return `${prefix} final ${genericTypeName(f.type)} ${name} =  ${value};`
    }

    //
    function generateOptionalValue(name: string, f: $Field): string {
      const prefix = self.useGetter ? "private" : "public"
      return `${prefix} ${genericTypeName(f.type)} ${name} = null;`
    }

    //
    function generateDefaultValue(name: string, f: $Field): string {
      let value =""
      const prefix = self.useGetter ? "private" : "public"
      switch(f.type.type) {
        case "TBoolean"     : value = ""                     ; break
        case "TInteger"     : value = ""                     ; break
        case "TLong"        : value = ""                     ; break
        case "TID"          : value = ""                     ; break
        case "TDouble"      : value = ""                     ; break
        case "TString"      : value = "= \"\""               ; break
        case "TURL"         : value = "= \"\""               ; break
        case "TDateTime"    : value = ""                     ; break
        case "TSSMap"       : value = "= new HashMap<>()"    ; break
        case "TObject"      : value = "= null"               ; break
        case "TUnknown"     : value = "= null"               ; break
        case "TList"        : value = "= new LinkedList<>()" ; break
        case "TEnum"        : {
          let fe = f.type as $TEnum
          value = `= ${fe.enu.name}.${fe.enu.asEnumOf(self.project)!.firstName()}`
          break
        }
        default: throw Error(`Type "${f.type.type}" of Field "${name}" in "${pth.module}/${pth.name}" is invalid.`)
      }
      return `${prefix} ${genericTypeName(f.type)} ${name} ${value};`
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

    //
    function generateGetterSetter(b: BraceCaller, name: string, f: $Field){
      const _name = _.camelCase(name)
      b.bra(`public ${genericTypeName(f.type)} get${_name}()`).add((b) => {
        b(`return ${name};`)
      })
      b.bra(`public void set${_name}(${genericTypeName(f.type)} value)`).add((b) => {
        b(`${name} = value;`)
      })
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
                @Override
                public String obtainPath() {
                    return "${entity.path}";
                }

                @Override
                public String obtainMethod() {
                    return ${entity.method ? `"${entity.method}"` : "null" };
                }

                @Override
                public Class<? extends ${resName}> obtainResClass() {
                    return ${resName}.class;
                }
              `)
            }
            //
            _.forIn(entity.fieldsLocal, (f, name) => {
              generateField(b, name, f)
            })
            b("")
            if(this.useGetter){
              _.forIn(entity.fieldsLocal, (f, name) => {
                generateGetterSetter(b, name, f)
              })
            }
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
            b("")
            if(this.useGetter){
              _.forIn(entity.fieldsLocal, (f, name) => {
                generateGetterSetter(b, name, f)
              })
            }
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
            b("")
            if(this.useGetter){
              _.forIn(entity.fieldsLocal, (f, name) => {
                generateGetterSetter(b, name, f)
              })
            }
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
      }`)

    this.writeJavaFile("AbsRes", dedent`
      public abstract class AbsRes {
      }`)

    this.project.flatEntities().forEach(({path, entity}) => {
      this.writeEntity(path, entity)
    })

    this.project.flatEnums().forEach(({path, enu}) => {
      this.writeEnum(path, enu)
    })
  }
}

