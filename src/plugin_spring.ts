import { $Project, $EntityType, $ReqMethod } from "@wuapi/essential";
import { BasePlugin, ProjectProcessor } from "./plugin_base";
import { PluginDescription } from "./plugin_base";
import fs from "fs"
import path from "path"
import _ from "lodash";
import dedent from "dedent";
import JavaPlugin from "./plugin_java";
import {flatBra} from "./brace";

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
          tag: "inc",
          withValue: false,
          description: "Increamental, NOT overriding old files",
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
    if(args["api"] != undefined){
      console.log([outputDir, this.getName(), "src", "main"].join(path.sep))
      new JavaPlugin().process(
        project,
        [outputDir, this.getName(), "src", "main"].join(path.sep),
        args,
      )
    }
    new SpringProcessor(this, project, outputDir, args).process()
  }
}

class SpringProcessor extends ProjectProcessor {
  readonly packageDir: string
  readonly package: string

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
   * @param name The name of this file (without extension).
   * @param text The content of the file
   */
  writeJavaFile(name: string, text: string){
    const filePath = this.packageDir + path.sep + name + ".java"
    const file = fs.openSync(filePath, 'w')

    fs.writeFileSync(file, dedent`
      package ${this.package};

    `
    + text)
  }

  /**
   * Process the project.
   */
  process() {
    if(this.config["api"] == null){
      // NOTE: When generating api code, clean out folder will destroy the api codes.
      fs.rmSync(this.rootDir, { recursive: true, force: true})
    }
    fs.mkdirSync(this.packageDir, { recursive: true })

    for(let mName in this.project.modules){
      const iname = `I${mName}Resource`
      const module = this.project.modules[mName]

      this.writeJavaFile(iname, flatBra("").add((b) => {
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
            let method = "Post"
            switch(entity.method){
              case $ReqMethod.GET       : method = "Get";    break
              case $ReqMethod.HEAD      : method = "";       break
              case $ReqMethod.POST      : method = "Post";   break
              case $ReqMethod.PUT       : method = "Put";    break
              case $ReqMethod.DELETE    : method = "Delete"; break
              case $ReqMethod.CONNECT   : method = "";       break
              case $ReqMethod.OPTIONS   : method = "";       break
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
          }
        })
      }).toString())
    }
  }
}

