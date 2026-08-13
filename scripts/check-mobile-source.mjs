import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.resolve('mobile')
const files = []
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(target)
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(target)
  }
}
visit(root)

const diagnostics = []
for (const fileName of files) {
  const source = fs.readFileSync(fileName, 'utf8')
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      isolatedModules: true,
    },
  })
  for (const diagnostic of result.diagnostics || []) {
    diagnostics.push(`${path.relative(process.cwd(), fileName)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }
}

if (diagnostics.length) {
  console.error(diagnostics.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Mobile source syntax valid: ${files.length} TypeScript files`)
}
