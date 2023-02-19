import { $Commentable, $Project } from "@wuapi/essential";
import _, { replace } from 'lodash';
import path from 'path';

export type PluginDescription = {
  name: string,
  version: string,
  abbreviation: string,
  description: string,
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
   */
  abstract process(project: $Project, outputDir: string): void
}

/**
 * This is the abstract parent class for project processors.
 */
export abstract class ProjectProcessor {

  readonly rootDir: string

  /**
   * 
   * @param plugin The parent plugin.
   * @param project The project
   * @param outputDir The output dir, for All plugins.
   */
  constructor(
    public plugin: BasePlugin,
    public project: $Project,
    outputDir: string) {

    this.rootDir = [outputDir, plugin.getDescription().name].join(path.sep)
  }

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