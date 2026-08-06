import fs from 'node:fs'
import type { PlopTypes } from '@turbo/gen'

import path from 'node:path'

type Choice = Record<'name' | 'value', string>

function listDirectories(baseDir: string, dir = ''): Choice[] {
  let directories: Choice[] = []
  const fullPath = path.join(baseDir, dir)
  directories.push({ name: fullPath, value: fullPath })

  const entries = fs.readdirSync(fullPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const relativePath = path.join(dir, entry.name)
      directories = directories.concat(listDirectories(baseDir, relativePath))
    }
  }

  return directories
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator('component', {
    description: 'Adds a new react component',
    prompts: [
      {
        type: 'list',
        name: 'directory',
        message: 'What directory should the component be placed in?',
        choices: [
          ...listDirectories('apps/service-site/src/features'),
          ...listDirectories('apps/service-site/src/components'),
          ...listDirectories('packages/ui/src/components'),
        ],
      },
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the component?',
      },
    ],
    actions: [
      {
        type: 'add',
        path: '{{directory}}/{{pascalCase name}}/{{pascalCase name}}.tsx',
        templateFile: 'templates/component.tsx.hbs',
      },
      {
        type: 'add',
        path: '{{directory}}/{{pascalCase name}}/index.ts',
        templateFile: 'templates/index.ts.hbs',
      },
      {
        type: 'add',
        path: '{{directory}}/{{pascalCase name}}/{{pascalCase name}}.stories.tsx',
        templateFile: 'templates/stories.tsx.hbs',
      },
      {
        type: 'add',
        path: '{{directory}}/{{pascalCase name}}/{{pascalCase name}}.module.css',
        templateFile: 'templates/module.css.hbs',
      },
    ],
  })
}
