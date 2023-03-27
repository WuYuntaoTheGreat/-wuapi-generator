import { $Commentable, $Project } from "@wuapi/essential";
import _ from 'lodash';
import path from 'path';
import fs from 'fs'

export type PluginArgument = {
  tag: string,
  withValue: boolean,
  description: string,
}

export type PluginDescription = {
  name: string,
  version: string,
  abbreviation: string,
  description: string,
  arguments: PluginArgument[],
}

/**
 * This is the abstract parent class of all Plug-ins.
 */
export abstract class BasePlugin {

  /**
   * Convenient function to get plugin name.
   * @returns plugin name
   */
  getName(): string {
    return this.getDescription().name
  }


  /**
   * Returns the description of this plugin.
   */
  abstract getDescription(): PluginDescription

  /**
   * Start process the project, and generate code.
   * @param project The project to process.
   * @param outputDir The output dir, NOTE! this is the root to all plugins, each plugin will create it's 
   * @param args The arguments from command line.
   */
  abstract process(project: $Project, outputDir: string, args: {[key: string]: string}): void

  /**
   * Rewrite a file with texts replaced.
   * @param src The source file path.
   * @param dst The destination file path.
   * @param map The map of texts to replace.
   */
  rewriteFile(src: string, dst: string, map: {[key: string]: string}): void {
    let content = fs.readFileSync(src).toString()
    for(let key in map){
      content = content.split(key).join(map[key])
    }
    fs.writeFileSync(dst, content)
  }
}

/**
 * This is the abstract parent class for project processors.
 */
export abstract class ProjectProcessor {

  readonly rootDir: string
  readonly config: {[key: string]: string}

  /**
   * 
   * @param plugin The parent plugin.
   * @param project The project
   * @param outputDir The output dir, for All plugins.
   * @param config The configuration of this plugin.
   */
  constructor(
    public plugin: BasePlugin,
    public project: $Project,
    outputDir: string,
    config: {[key: string]: string},
  ) {
    this.config = config
    this.rootDir = [outputDir, plugin.getName()].join(path.sep)
  }

  /*
   *
   */
  abstract process(): void
}

export function toBlockComment(element: $Commentable | null | undefined): string {
  if(element && element.comment){
    return "\n/*\n" + element.comment.replace(/^/g, " * ") + "\n */"
  } else {
    return ""
  }
}

export function toLineComment(element: $Commentable | null | undefined): string {
  if(element && element.comment){
    return "\n" + element.comment.replace(/^/g, "// ")
  } else {
    return ""
  }
}

