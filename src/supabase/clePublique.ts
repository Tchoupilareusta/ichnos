/**
 * Garde-fou : dit si une clé Supabase est une clé secrète, qui ne doit jamais entrer dans l'appli.
 * Reconnaît les clés « sb_secret_… » et les anciennes clés au format jeton dont le rôle est service_role.
 */
export function estCleSecrete(cle: string | undefined): boolean {
  if (!cle) return false
  if (cle.startsWith('sb_secret_')) return true
  const contenu = cle.split('.')[1]
  if (!contenu) return false
  try {
    const { role } = JSON.parse(atob(contenu.replace(/-/g, '+').replace(/_/g, '/')))
    return role === 'service_role'
  } catch {
    return false
  }
}
