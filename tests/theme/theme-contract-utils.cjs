const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function walkFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target, predicate) : predicate(target) ? [target] : [];
  });
}

function parseShopifyJson(source) {
  return JSON.parse(source.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

function parseSectionSchema(source, filename) {
  const match = source.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid section schema in ${filename}: ${error.message}`);
  }
}

function schemaContract(schema) {
  return {
    settings: (schema.settings || []).map((setting) => ({ id: setting.id || null, type: setting.type || null })),
    blocks: (schema.blocks || []).map((block) => ({
      type: block.type || null,
      settings: (block.settings || []).map((setting) => ({ id: setting.id || null, type: setting.type || null })),
    })),
    max_blocks: schema.max_blocks ?? null,
  };
}

function buildSchemaSignatures(root) {
  const sectionsDirectory = path.join(root, 'sections');
  return Object.fromEntries(
    walkFiles(sectionsDirectory, (filename) => filename.endsWith('.liquid'))
      .sort()
      .flatMap((filename) => {
        const source = fs.readFileSync(filename, 'utf8');
        const schema = parseSectionSchema(source, filename);
        if (!schema) return [];
        const signature = crypto.createHash('sha256').update(JSON.stringify(schemaContract(schema))).digest('hex');
        return [[path.basename(filename), signature]];
      })
  );
}

module.exports = {
  buildSchemaSignatures,
  parseSectionSchema,
  parseShopifyJson,
  walkFiles,
};
