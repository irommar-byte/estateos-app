import { userHasOfficePartnerPro } from '@/lib/officePartnerPro';
import { shapeMobileUser, type MobileUserCore } from '@/lib/mobileUserShape';

/** Tylko serwer — nie importować z client components (Prisma / office membership). */
export async function shapeMobileUserEntitled(
  user: MobileUserCore,
  opts?: { displayImage?: string | null },
) {
  const officePro = await userHasOfficePartnerPro(user.id);
  return shapeMobileUser(user, { ...opts, officePro });
}
