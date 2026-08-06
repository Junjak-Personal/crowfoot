import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the target HTML file
const filePath = path.join(__dirname, '..', 'dist', 'index.html')

// Content to insert into <head>
const contentToInsertHead = `
<!-- Add meta tag to prevent search engines from indexing or following links -->
<meta name="robots" content="noindex, nofollow, noarchive">
`

// Content to insert into <body>
const contentToInsertBody = `
`

// Read the file
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Failed to read file:', err)
    return
  }

  // Insert content immediately after the <head> tag
  let updatedData = data.replace(/<head>/, `<head>\n  ${contentToInsertHead}`)

  // Insert content immediately after the <body> tag
  updatedData = updatedData.replace(
    /<body>/,
    `<body>\n  ${contentToInsertBody}`,
  )

  // Write the updated data back to the file
  fs.writeFile(filePath, updatedData, 'utf8', (err) => {
    if (err) {
      console.error('Failed to write file:', err)
      return
    }
    console.log('Content successfully inserted into <head> and <body>.')
  })
})
