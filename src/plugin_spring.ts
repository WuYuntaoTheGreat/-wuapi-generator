import { $Project, $EntityType, $ReqMethod, } from "@wuapi/essential";
import { BasePlugin, ProjectProcessor } from "./plugin_base";
import { PluginDescription } from "./plugin_base";
import fs from "fs"
import path from "path"
import _ from "lodash";
import JavaPlugin from "./plugin_java";
import {capitalFirst, flatBra} from "./brace";
import ncp from "ncp";

export default class SpringPlugin extends BasePlugin {

  getDescription(): PluginDescription {
    return {
      name: "spring",
      abbreviation: "p",
      version: "1.0.0",
      description: "Generate spring boot codes.",
      arguments: [
        {
          tag: "pkg",
          withValue: true,
          description: "The package name to spring code, (default to API package)",
        },
        {
          tag: "name",
          withValue: true,
          description: "The name of the spring project.",
        },
        {
          tag: "api",
          withValue: false,
          description: "Also generate API code",
        },
      ],
    }
  }

  process(project: $Project, outputDir: string, args: {[key: string]: string}): void {
    if(args["name"] == undefined){
      console.error("ERROR! option '-p' request '--p-name <name>' argument")
      console.error("Please check with '-h'")
      return
    }

    new SpringProcessor(this, project, outputDir, args).process()
  }
}

class SpringProcessor extends ProjectProcessor {
  readonly packageDir: string
  readonly package: string

  get name(): string {
    return this.config["name"]
  }

  constructor(
    plugin: BasePlugin,
    project: $Project,
    outputDir: string,
    config: {[key: string]: string},
  ) {
    super(plugin, project, outputDir, config)

    this.package = (config["pkg"]) ? config["pkg"] : this.project.targetPackage
    this.packageDir = _.concat([ this.rootDir, "src", "main", "java" ], this.package.split('.')).join(path.sep)
  }

  /**
   * Write text into java file.
   * @param dir The path of the file.
   * @param name The name of this file (without extension).
   * @param text The content of the file
   */
  writeJavaFile(dir: string, name: string, text: string){
    fs.mkdirSync(dir, { recursive: true })
    const filePath = dir + path.sep + name + ".java"
    const file = fs.openSync(filePath, 'w')

    fs.writeFileSync(file, text)
  }

  /**
   * Write the application file
   */
  writeApplication(){
    const _name = capitalFirst(this.name)
    this.writeJavaFile(this.packageDir, `${_name}Application`, flatBra("").add((b) => {
      b(`package ${this.package};\n`)

      b("import org.springframework.boot.SpringApplication;")
      b("import org.springframework.boot.autoconfigure.SpringBootApplication;\n") 
      b("@SpringBootApplication")
      b.bra(`public class ${_name}Application `).add((b) => {
        b.bra("public static void main(String[] args)").add((b) => {
          b("SpringApplication.run(SpringBoot2RestServiceApplication.class, args);")
        }) 
      })
    }).toString())
  }

  /**
   * Write a module
   * @param mName The name of the module.
   */
  writeModule(mName: string){
    const module = this.project.modules[mName]
    const iname = `I${mName}Resource`
    let reqCount = 0
    let moduleContent = flatBra("").add((b) => {
      b(`package ${this.package}.${mName.toLowerCase()};\n`)
      b(`import ${this.project.targetPackage}.*;`)
      b("import org.springframework.web.bind.annotation.DeleteMapping;")
      b("")
      b.bra(`public interface ${iname}`).add((b) =>  {
        for(let eName in module.entities){
          const entity = module.entities[eName]
          if(entity.type != $EntityType.REQUEST){
            continue
          }
          if(entity.isAbstract){
            continue
          }
          let method = ""
          switch(entity.method ?? $ReqMethod.POST){
            case $ReqMethod.GET       : method = "Get";    break
            case $ReqMethod.POST      : method = "Post";   break
            case $ReqMethod.PUT       : method = "Put";    break
            case $ReqMethod.DELETE    : method = "Delete"; break
          }
          if(!method){
            continue
          }

          const resp = entity.response?.name
          if(!resp){
            continue
          }

          b(`@${method}Mapping("${entity.path}")`)
          b(`public ${resp} retrive${resp}(@RequestBody ${eName} req);`)
          b("")
          reqCount++
        }
      })
    })

    if(reqCount > 0){
      const dir = this.packageDir + path.sep + mName.toLowerCase()
      this.writeJavaFile(dir, iname, moduleContent.toString())
    }
  }

  /**
   * Write template.
   */
writeTemplate(){
    const map = {
      "{{project_name}}"     : this.name,
      "{{project_version}}"  : this.project.version,
      "{{project_package}}"  : this.package,
    }

    const src = [__dirname, "..", "template", "spring", "pom.xml"].join(path.sep)
    const dst = [this.rootDir, "pom.xml"].join(path.sep)

    this.plugin.rewriteFile(src, dst, map)

    const srcDir = [__dirname, "..", "template", "spring", "src"].join(path.sep)
    const dstDir = [this.rootDir, "src"].join(path.sep)

    ncp(srcDir, dstDir, (_) => {})
  }

  /**
   * Process the project.
   */
  process() {
    // Clean
    if(this.config["inc"] == undefined){
      fs.rmSync(this.rootDir, { recursive: true, force: true})
    }

    // Write API
    if(this.config["api"] != undefined){
      const javaDir = [this.rootDir, "src", "main"].join(path.sep)
      fs.mkdirSync(javaDir, { recursive: true })
      new JavaPlugin().process(this.project, javaDir, this.config)
    }

    // Write modules
    for(let mName in this.project.modules){
      this.writeModule(mName)
    }

    // Write application
    this.writeApplication()

    // Copy templates
    if(this.config["inc"] == undefined){
      this.writeTemplate()
    }
  }
}

