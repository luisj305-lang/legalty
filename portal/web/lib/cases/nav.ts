export type NavRole = 'client' | 'staff' | 'admin' | null;

export type NavItem = { href: string; label: string; adminOnly: boolean };

// The admin-only "Clientes" entry is added here so every signed-in role gets
// the shared links while only admins see the administration directory. The
// calls availability link is for the authorized operations roles (admin/staff).
export function navItems(role: NavRole): NavItem[] {
  const items: NavItem[] = [
    { href: '/portal/cases', label: 'Resumen de casos', adminOnly: false },
  ];
  if (role === 'admin') {
    items.push({ href: '/portal/cases/clients', label: 'Clientes', adminOnly: true });
  }
  if (role === 'admin' || role === 'staff') {
    items.push({ href: '/portal/calls/availability', label: 'Disponibilidad de llamadas', adminOnly: false });
  }
  items.push(
    { href: '/portal/setup/password', label: 'Configurar contraseña', adminOnly: false },
    { href: '/portal/setup/mfa', label: 'Autenticador opcional', adminOnly: false },
  );
  return items;
}
