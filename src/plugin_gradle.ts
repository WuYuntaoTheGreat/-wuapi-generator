import { $Project } from "@wuapi/essential"
import { BasePlugin, PluginDescription } from "./plugin_base"
import JavaPlugin from "./plugin_java"
import fs from "fs";
import path from "path";
import ncp from 'ncp'

export default class GradlePlugin extends BasePlugin {
  javaPlugin = new JavaPlugin()

  getDescription(): PluginDescription {
    return {
      name: "gradle",
      abbreviation: "g",
      version: "1.0.0",
      description: "Generate Java Library using Gradle.",
      arguments: this.javaPlugin.getDescription().arguments.concat([
        {
          tag: "inc",
          withValue: false,
          description: "Increamental, NOT copying config files",
        }
      ]),
    }
  }

  process(project: $Project, outputDir: string, args: {[key: string]: string}): void {
    const srcDir = [__dirname, "..", "template", this.getName()].join(path.sep)
    const dstDir = [outputDir, this.getName()].join(path.sep)

    const javaDir = [outputDir, this.getName(), "library", "src", "main"].join(path.sep)

    if(args["inc"] != undefined){
      this.javaPlugin.process(project, javaDir, args)
    } else {
      ncp(srcDir, dstDir, (error) => {
        if(error) {
          return console.error(error)
        } else {
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

          this.javaPlugin.process(project, javaDir, args)
        }
      })
    }
  }

  rewriteFile(src: string, dst: string, map: {[key: string]: string}): void {
    let content = fs.readFileSync(src).toString()
    for(let key in map){
      content = content.replace(key, map[key])
    }
    fs.writeFileSync(dst, content)
  }

}

