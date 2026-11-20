import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'

export const instant = false

/* 어드민 메뉴가 디자이너 하나뿐이라 진입점은 그쪽으로 넘긴다 */
export default async function AdminHomePage() {
  const user = await getAdminUser()
  redirect(user ? '/admin/designers' : '/admin/login')
}
