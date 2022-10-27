const _ = require("lodash");
const { TemplatesGenConfig } = require("./configuration");
const { FileSystem } = require("../../util/file-system");
const { Logger } = require("../../util/logger");
const path = require("path");

class TemplatesGenProcess {
  /**
   * @type {TemplatesGenConfig}
   */
  config;
  /**
   * @type {FileSystem}
   */
  fileSystem;
  /**
   * @type {Logger}
   */
  logger;

  rootDir = path.resolve(__dirname, "../../../");

  paths = {
    baseTemplates: "templates/base",
    httpClientTemplates: "templates/base/http-clients",
    moduleApiTemplates: "templates/modular",
    defaultApiTemplates: "templates/default",
  };

  importTemplatePrefixes = ["@base", "@modular", "@default"];

  constructor(config) {
    this.config = new TemplatesGenConfig(config);
    this.logger = new Logger(this.config);
    this.fileSystem = new FileSystem();
  }

  /**
   * @return {Promise<GenerateTemplatesOutput>}
   */
  async start() {
    this.logger.event('start generating source templates ".ejs" for code generator');

    const templates = this.getTemplates();

    if (this.config.output) {
      this.logger.log("preparing output directory for source templates");
      const outputPath = path.resolve(process.cwd(), this.config.output);

      if (this.fileSystem.pathIsExist(outputPath)) {
        if (this.config.cleanOutput) {
          this.fileSystem.cleanDir(outputPath);
        }
      } else {
        this.fileSystem.createDir(outputPath);
      }

      templates.forEach((template) => {
        const templateExist = this.fileSystem.pathIsExist(path.resolve(outputPath, template.name));
        if (!templateExist || this.config.rewrite) {
          this.fileSystem.createFile({
            path: outputPath,
            fileName: template.name,
            content: template.content,
            withPrefix: false,
          });
        }
      });
      this.logger.success(`source templates has been successfully created in "${outputPath}"`);
    }

    return {
      files: templates,
      configuration: this.config,
      createFile: this.fileSystem.createFile,
    };
  }

  getTemplates = () => {
    const outputFiles = [];
    const baseTemplates = this.getTemplateNamesFromDir(this.paths.baseTemplates);
    const httpClientTemplates = this.getTemplateNamesFromDir(this.paths.httpClientTemplates);
    const apiTemplatesPath = this.config.modular ? this.paths.moduleApiTemplates : this.paths.defaultApiTemplates;
    const apiTemplates = this.getTemplateNamesFromDir(apiTemplatesPath);

    for (const fileName of baseTemplates) {
      outputFiles.push({
        name: fileName,
        content: this.fixTemplateContent(this.getTemplateContent(`${this.paths.baseTemplates}/${fileName}`)),
      });
    }

    const usingHttpClientTemplate = httpClientTemplates.find((template) =>
      template.startsWith(`${this.config.httpClientType}-`),
    );

    if (usingHttpClientTemplate) {
      outputFiles.push({
        name: usingHttpClientTemplate,
        content: this.fixTemplateContent(
          this.getTemplateContent(`${this.paths.httpClientTemplates}/${usingHttpClientTemplate}`),
        ),
      });
    }

    for (const fileName of apiTemplates) {
      outputFiles.push({
        name: fileName,
        content: this.fixTemplateContent(this.getTemplateContent(`${apiTemplatesPath}/${fileName}`)),
      });
    }

    return outputFiles;
  };

  fixTemplateContent = (content) => {
    // includeFile("@base/
    const importsRegExp1 = new RegExp(
      `includeFile\\\("(${this.importTemplatePrefixes.map((v) => `(${v})`).join("|")})\/`,
      "g",
    );
    // includeFile(`@base/
    const importsRegExp2 = new RegExp(
      `includeFile\\\(\`(${this.importTemplatePrefixes.map((v) => `(${v})`).join("|")})\/`,
      "g",
    );
    // includeFile('@base/
    const importsRegExp3 = new RegExp(
      `includeFile\\\(\'(${this.importTemplatePrefixes.map((v) => `(${v})`).join("|")})\/`,
      "g",
    );

    return content
      .replace(importsRegExp1, 'includeFile("./')
      .replace(importsRegExp2, "includeFile(`./")
      .replace(importsRegExp3, "includeFile('./");
  };

  getTemplateNamesFromDir = (dir) => {
    return this.fileSystem.readDir(path.resolve(this.rootDir, dir)).filter((file) => file.endsWith(".ejs"));
  };

  getTemplateContent = (pathToFile) => {
    return this.fileSystem.getFileContent(path.resolve(this.rootDir, pathToFile));
  };
}

module.exports = {
  TemplatesGenProcess,
};