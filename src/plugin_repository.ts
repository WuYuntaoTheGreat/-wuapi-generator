import { $Project } from "@wuapi/essential";
import fs from 'fs';
import path from "path";
import { BasePlugin, PluginDescription, ProjectProcessor } from "./plugin_base";

/**
 * Generate a json repository.
 */
export default class RepositoryPlugin extends BasePlugin {

  /**
   * Returns the description of this plugin.
   */
  getDescription(): PluginDescription {
    return {
      name: "repository",
      abbreviation: "r",
      version: "1.0.0",
      description: "Generate a Json repository."
    }
  }

  process(project: $Project, outputDir: string): void {
    new RepositoryProcessor(this, project, outputDir).process()
  }

}

class RepositoryProcessor extends ProjectProcessor {
  process(){
    fs.mkdirSync(this.rootDir, { recursive: true })
    const configFilePath    = [ this.rootDir, 'list.json' ].join(path.sep)
    const projectFileName   = `project-${this.project.version}.json`
    const projectFilePath   = [ this.rootDir,  projectFileName ].join(path.sep)

    // File
    let config: any         = (fs.existsSync(configFilePath)) ?  JSON.parse(fs.readFileSync(configFilePath).toString()) : {}
    let newConfig: any      = {}
    newConfig.current       = this.project.version
    newConfig.versions      = config?.versions ?? {}
    newConfig.versions[this.project.version] = `${this.plugin.getName()}/${projectFileName}` 

    // Write file
    fs.writeFileSync(configFilePath,  JSON.stringify(newConfig,     undefined, 4))
    fs.writeFileSync(projectFilePath, JSON.stringify(this.project,  undefined, 4))
  }
}