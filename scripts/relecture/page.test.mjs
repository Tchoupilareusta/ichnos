import catalogue from '../../catalogue/catalogue-initial.json'
import { origine, pageRelecture } from './page.mjs'

const oeuvre = (cle) => catalogue.works.find((o) => o.key === cle)
const page = pageRelecture(catalogue)
const ficheHtml = (cle) => page.slice(page.indexOf(`<article class="fiche" id="${cle}">`)).split('</article>')[0]

describe('page de relecture du catalogue', () => {
  it('écrit « de l’ » devant une voyelle et « du » devant une consonne', () => {
    expect(origine(oeuvre('momo'))).toContain('traduit de l’allemand')
    expect(origine(oeuvre('le-baron-perche'))).toContain('traduit de l’italien')
    expect(origine(oeuvre('un-psaume-pour-les-recycles-sauvages'))).toContain('traduit de l’anglais')
    expect(origine(oeuvre('vinland-saga'))).toContain('traduit du japonais')
    expect(origine(oeuvre('crime-et-chatiment'))).toContain('traduit du russe')
    expect(origine(oeuvre('lettres-a-lucilius'))).toContain('traduit du latin')
  })

  it('n’écrit nulle part « du » devant une voyelle après « traduit »', () => {
    expect(page).not.toMatch(/traduit du [aàâeéèêiîoôuûy]/i)
    expect(page).not.toMatch(/traduit de l['’][^aàâeéèêiîoôuûyh]/i)
  })

  it('ne parle pas de traduction pour une œuvre écrite en français', () => {
    expect(origine(oeuvre('la-chute')).join(' ')).not.toMatch(/traduit/)
  })

  it('ne dit pas « traduit de l’allemand » pour une traduction faite depuis l’anglais', () => {
    const frankl = oeuvre('decouvrir-un-sens-a-sa-vie')
    expect(frankl.original_language).toBe('de')
    expect(origine(frankl).join(' ')).not.toMatch(/traduit/)
    expect(ficheHtml('decouvrir-un-sens-a-sa-vie')).toContain('Traduit en français à partir de la version anglaise.')
  })

  it('affiche « Nous » sous son nouveau titre, avec le rappel de l’ancien', () => {
    expect(ficheHtml('nous')).toContain('<h2>Nous</h2>')
    expect(ficheHtml('nous')).toContain('Aussi connu sous le titre « Nous autres »')
  })

  it('met le titre original en premier quand l’édition est en anglais', () => {
    expect(ficheHtml('1984')).toContain('<h2>Nineteen Eighty-Four</h2>')
    expect(origine(oeuvre('1984'))).toEqual(['1984', 'édition en anglais, la langue d’origine', 'première parution en 1949'])
    expect(ficheHtml('la-ferme-des-animaux')).toContain('<h2>Animal Farm</h2>')
    expect(origine(oeuvre('la-ferme-des-animaux'))[0]).toBe('La Ferme des animaux')
  })

  it('met le titre français en premier pour une édition française', () => {
    expect(ficheHtml('le-meilleur-des-mondes')).toContain('<h2>Le Meilleur des mondes</h2>')
    expect(origine(oeuvre('le-meilleur-des-mondes'))[0]).toBe('Brave New World')
  })

  it('présente une fiche par œuvre, synopsis en français compris', () => {
    for (const o of catalogue.works) {
      expect(page, o.key).toContain(`<article class="fiche" id="${o.key}">`)
      expect(ficheHtml(o.key), o.key).toContain('class="synopsis"')
    }
  })
})
