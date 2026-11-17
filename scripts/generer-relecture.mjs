// Écrit la page de relecture du catalogue de départ dans un fichier HTML.
// Usage : node scripts/generer-relecture.mjs <fichier de sortie>
// La page n'est pas enregistrée dans le dépôt : elle est publiée à part, en privé.
import { readFileSync, writeFileSync } from 'node:fs'
import { pageRelecture } from './relecture/page.mjs'

const sortie = process.argv[2]
if (!sortie) throw new Error('Indiquer le fichier de sortie.')

const catalogue = JSON.parse(readFileSync(new URL('../catalogue/catalogue-initial.json', import.meta.url), 'utf8'))
const html = pageRelecture(catalogue)
writeFileSync(sortie, html)
console.log(`${catalogue.works.length} fiches, ${(html.length / 1024).toFixed(0)} Ko`)
