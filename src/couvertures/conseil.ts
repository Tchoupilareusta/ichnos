// Le conseil de lumière, avant de photographier une couverture. Le redressement corrige la forme,
// pas la lumière : une ombre nette ou un reflet restent sur l'image. Le conseil s'affiche sous les
// boutons de photo les trois premières fois, puis seulement replié dans le panneau de redressement.
// L'appareil ne retient qu'un compte (comme il retient le thème) : rien de personnel.

export const CONSEIL_PHOTO = 'Lumière douce, sans flash, téléphone bien à plat au-dessus du livre.'

const CLE = 'ichnos-conseil-photo'
const FOIS = 3

function photosPrises(): number {
  try {
    const compte = Number(localStorage.getItem(CLE))
    return Number.isInteger(compte) && compte > 0 ? compte : 0
  } catch {
    return 0
  }
}

/** Vrai tant que le conseil n'a pas servi trois fois. */
export const conseilAMontrer = () => photosPrises() < FOIS

/** Une photo vient d'être choisie ou prise : le conseil a servi une fois de plus. */
export function noterPhotoPrise(): void {
  try {
    localStorage.setItem(CLE, String(Math.min(FOIS, photosPrises() + 1)))
  } catch {
    // Mémoire de l'appareil indisponible (navigation privée) : le conseil restera affiché.
  }
}
