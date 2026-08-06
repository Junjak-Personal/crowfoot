import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const main = () => {
  const dotNextPath = path.resolve(__dirname, '../.next')
  const nodeModulesPath = path.join(dotNextPath, 'node_modules')

  if (!fs.existsSync(dotNextPath)) {
    fs.mkdirSync(dotNextPath, { recursive: true })
  }
  if (!fs.existsSync(nodeModulesPath)) {
    fs.mkdirSync(nodeModulesPath, { recursive: true })
  }

  process.chdir(nodeModulesPath)

  execSync('npm install @prisma/internals@6.8.2', { stdio: 'inherit' })

  const packageJsonPath = path.join(nodeModulesPath, 'package.json')
  const packageLockJsonPath = path.join(nodeModulesPath, '.package-lock.json')
  if (fs.existsSync(packageJsonPath)) {
    fs.unlinkSync(packageJsonPath)
  }
  if (fs.existsSync(packageLockJsonPath)) {
    fs.unlinkSync(packageLockJsonPath)
  }
}

main()
