// Icônes reprises des maquettes validées. Toujours décoratives : le texte voisin les nomme.
type Props = { taille?: number }

function Svg({ taille = 22, epaisseur = 1.8, children }: Props & { epaisseur?: number; children: React.ReactNode }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconeAccueil = (p: Props) => (
  <Svg {...p}>
    <path d="M4 11.5 12 5l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5H9v5H5.5A1.5 1.5 0 0 1 4 19z" />
  </Svg>
)

export const IconeBibliotheque = (p: Props) => (
  <Svg {...p}>
    <path d="M5 4.5h3.5v15H5zM10.5 4.5H14v15h-3.5zM16 5.6l3.2-.9 3 14.2-3.2.8z" />
  </Svg>
)

export const IconeDecouvrir = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Svg>
)

export const IconeAjouter = (p: Props) => (
  <Svg {...p} epaisseur={2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconeFleche = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
)

export const IconeReglages = (p: Props) => (
  <Svg {...p} epaisseur={1.7}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
)

export const IconeRecherche = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
)

export const IconeFiltres = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
)

export const IconeFermer = (p: Props) => (
  <Svg {...p} epaisseur={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const IconeChevronBas = (p: Props) => (
  <Svg {...p} epaisseur={2}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const IconeRetour = (p: Props) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const IconeModifier = (p: Props) => (
  <Svg {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
  </Svg>
)

export const IconeCoche = (p: Props) => (
  <Svg {...p} epaisseur={2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)
