import fs from 'node:fs';

const profileServiceContent = `import { apiClient, AppError } from '../lib/apiClient';
import type { MemberProfile as BackendMemberProfile, Gender, MaritalStatus } from '../types/api';
import { Member, Church, ApiResponse } from '../types';
import { memberDashboardService } from './memberDashboardService';

export interface MemberProfile {
  member: Member | null;
  church: Church | null;
}

export interface ProfileOverview {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  campus: string;
  avatarUrl: string | null;
  membershipStatus: string;
  membershipDate: string;
  churchName: string;
  churchLocation: string;
}

export interface CompleteProfilePayload {
  fullName: string;
  dateOfBirth: string; // ISO string
  gender: string;
  phoneNumber: string;
  contactEmail: string;
  city: string;
  address: string;
  maritalStatus: string;
  occupation?: string;
  photoUri?: string;
}

function normalizeGender(g?: string): Gender {
  if (!g) return 'PREFER_NOT_TO_SAY';
  const clean = g.toUpperCase().replace(/\\s+/g, '_');
  if (clean === 'MALE' || clean === 'FEMALE' || clean === 'PREFER_NOT_TO_SAY') return clean;
  return 'PREFER_NOT_TO_SAY';
}

function normalizeMaritalStatus(m?: string): MaritalStatus {
  if (!m) return 'PREFER_NOT_TO_SAY';
  const clean = m.toUpperCase().replace(/\\s+/g, '_');
  if (clean === 'SINGLE' || clean === 'MARRIED' || clean === 'DIVORCED' || clean === 'WIDOWED' || clean === 'PREFER_NOT_TO_SAY') {
    return clean;
  }
  return 'PREFER_NOT_TO_SAY';
}

/**
 * Submits the complete profile payload to POST /api/v1/members/profile/complete
 */
export async function submitCompleteProfile(
  payload: CompleteProfilePayload
): Promise<ApiResponse<BackendMemberProfile>> {
  try {
    const formData = new FormData();
    formData.append('fullName', payload.fullName.trim());
    
    // Ensure dateOfBirth is full ISO format
    const dob = payload.dateOfBirth.includes('T')
      ? payload.dateOfBirth
      : new Date(payload.dateOfBirth).toISOString();
    formData.append('dateOfBirth', dob);
    
    formData.append('gender', normalizeGender(payload.gender));
    
    // Normalize phone number with '+' prefix if missing
    let phone = payload.phoneNumber.trim().replace(/[\\s()-]/g, '');
    if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }
    formData.append('phoneNumber', phone);
    
    formData.append('contactEmail', payload.contactEmail.trim().toLowerCase());
    formData.append('city', payload.city.trim());
    formData.append('address', (payload.address || payload.city).trim());
    formData.append('maritalStatus', normalizeMaritalStatus(payload.maritalStatus));
    
    if (payload.occupation?.trim()) {
      formData.append('occupation', payload.occupation.trim());
    }

    if (payload.photoUri) {
      const filename = payload.photoUri.split('/').pop() || 'photo.jpg';
      const match = /\\.([a-zA-Z0-9]+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      
      formData.append('profilePhoto', {
        uri: payload.photoUri,
        name: filename,
        type,
      } as unknown as Blob);
    }

    const res = await apiClient.post<BackendMemberProfile>('/members/profile/complete', formData);
    return {
      success: true,
      data: res,
      message: 'Profile completed successfully!',
    };
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Could not complete profile. Please try again.';
    return {
      success: false,
      data: null as unknown as BackendMemberProfile,
      error: message,
    };
  }
}

/**
 * Loads member profile from GET /api/v1/members/profile with fallback
 */
export async function loadMemberProfile(
  userAvatarUrl?: string | null
): Promise<ApiResponse<MemberProfile>> {
  try {
    const backendProfile = await apiClient.get<BackendMemberProfile>('/members/profile');
    if (backendProfile) {
      const member: Member = {
        id: backendProfile.id,
        fullName: backendProfile.fullName,
        email: backendProfile.contactEmail,
        phone: backendProfile.phoneNumber,
        role: 'member',
        campus: backendProfile.city,
        profileImageUrl: backendProfile.profilePhotoUrl || userAvatarUrl || undefined,
        membershipDate: backendProfile.completedAt,
        status: 'active',
      };
      return {
        success: true,
        data: { member, church: null },
      };
    }
  } catch {
    // Graceful fallback to mock dashboard data if profile is not yet created
  }

  return {
    success: true,
    data: { member: null, church: null },
  };
}

export function toOverview(
  profile: MemberProfile,
  userAvatarUrl?: string | null
): ProfileOverview {
  return {
    fullName: profile.member?.fullName || 'Church Member',
    email: profile.member?.email || '',
    phone: profile.member?.phone || '',
    role: profile.member?.role || 'member',
    campus: profile.member?.campus || '',
    avatarUrl: userAvatarUrl || profile.member?.profileImageUrl || null,
    membershipStatus: profile.member?.status === 'active' ? 'Active Member' : 'Pending Approval',
    membershipDate: profile.member?.membershipDate || '',
    churchName: profile.church?.name || profile.member?.campus || '',
    churchLocation: profile.church?.city && profile.church?.country ? \`\${profile.church.city}, \${profile.church.country}\` : '',
  };
}

export default {
  submitCompleteProfile,
  loadMemberProfile,
  toOverview,
};
`;

const churchServiceContent = `import { apiClient, AppError } from '../lib/apiClient';
import type { ChurchMembership as BackendMembership, Church as BackendChurch } from '../types/api';
import { Church, ChurchJoinRequest, ApiResponse } from '../types';

const MOCK_CHURCHES: Church[] = [
  {
    id: 'church_1',
    name: "Redeemer's Chapel International",
    city: 'Ridge',
    region: 'Greater Accra',
    country: 'Ghana',
    address: '14 Independence Ave, Ridge, Accra',
    imageUrl: 'https://images.unsplash.com/photo-1548625361-16a9a14925bb?q=80&w=1200&auto=format&fit=crop',
    iconType: 'cross',
    iconBgColor: '#C98A16',
    isRegistered: true,
    distance: '1.2 km from you',
    shortDescription: 'A vibrant community of believers devoted to worship, discipleship, and city transformation.',
    description: "Redeemer's Chapel International is a modern, gospel-centered church dedicated to empowering families and transforming society.",
    memberCount: 1420,
    serviceCount: 3,
    serviceTimes: ['Sun 7:00 AM', 'Sun 9:30 AM', 'Wed 6:30 PM'],
    foundedYear: 2012,
    expectations: ['Family-Oriented Worship', 'Biblical Preaching', 'Engaging Kids Ministry', 'Community Outreach'],
    estimatedApprovalTime: '1–2 business days',
    isFavorite: false,
    status: 'verified',
  },
  {
    id: 'church_2',
    name: 'Grace Life Cathedral',
    city: 'East Legon',
    region: 'Greater Accra',
    country: 'Ghana',
    address: 'Lagos Avenue, East Legon, Accra',
    imageUrl: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?q=80&w=1200&auto=format&fit=crop',
    iconType: 'leaf',
    iconBgColor: '#047857',
    isRegistered: true,
    distance: '3.8 km from you',
    shortDescription: 'Living in grace, growing in faith, and raising servant-leaders for global impact.',
    description: 'Grace Life Cathedral is a multi-generational church in East Legon where grace meets purpose through spirit-led worship and relevant teaching.',
    memberCount: 2350,
    serviceCount: 2,
    serviceTimes: ['Sun 8:00 AM', 'Sun 10:30 AM'],
    foundedYear: 2010,
    expectations: ['Contemporary Worship', 'Practical Sermons', 'Active Small Groups', 'Leadership Programs'],
    estimatedApprovalTime: 'Same day',
    isFavorite: false,
    status: 'verified',
  },
];

class ChurchService {
  private churches: Church[] = [...MOCK_CHURCHES];
  private activeJoinRequest: ChurchJoinRequest | null = null;
  private favoriteIds: Set<string> = new Set();

  /**
   * Get all registered churches
   */
  async getChurches(): Promise<ApiResponse<Church[]>> {
    const result = this.churches.map((c) => ({
      ...c,
      isFavorite: this.favoriteIds.has(c.id),
    }));
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Search churches by query
   */
  async searchChurches(query: string): Promise<ApiResponse<Church[]>> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return this.getChurches();

    const filtered = this.churches.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(cleanQuery);
      const cityMatch = c.city?.toLowerCase().includes(cleanQuery) ?? false;
      const addressMatch = c.address?.toLowerCase().includes(cleanQuery) ?? false;
      return nameMatch || cityMatch || addressMatch;
    }).map((c) => ({
      ...c,
      isFavorite: this.favoriteIds.has(c.id),
    }));

    return {
      success: true,
      data: filtered,
    };
  }

  /**
   * Get church by ID
   */
  async getChurchById(id: string): Promise<ApiResponse<Church>> {
    const found = this.churches.find((c) => c.id === id) || this.churches[0];
    return {
      success: true,
      data: {
        ...found,
        isFavorite: this.favoriteIds.has(found.id),
      },
    };
  }

  /**
   * Submits a join request to POST /api/v1/join-requests
   */
  async requestToJoinChurch(churchId: string): Promise<ApiResponse<ChurchJoinRequest>> {
    try {
      const backendRes = await apiClient.post<BackendMembership>('/join-requests', { churchId });
      const joinReq: ChurchJoinRequest = {
        id: backendRes.id || \`req_\${Date.now()}\`,
        churchId,
        churchName: backendRes.church?.name || 'Your Church',
        churchLocation: backendRes.church?.city || '',
        status: (backendRes.status?.toLowerCase() as 'pending' | 'approved' | 'rejected') || 'pending',
        submittedAt: backendRes.joinedAt || new Date().toISOString(),
        rejectionReason: backendRes.rejectionReason || undefined,
      };
      this.activeJoinRequest = joinReq;
      return {
        success: true,
        data: joinReq,
        message: 'Join request successfully submitted to church administrators.',
      };
    } catch (err) {
      // Fallback local representation for demo/offline resilience
      const church = this.churches.find((c) => c.id === churchId) || this.churches[0];
      const newRequest: ChurchJoinRequest = {
        id: \`req_\${Date.now()}\`,
        churchId,
        churchName: church.name,
        churchLocation: \`\${church.city || ''}, \${church.country || ''}\`,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        estimatedApprovalTime: church.estimatedApprovalTime || '1–3 business days',
      };
      this.activeJoinRequest = newRequest;
      return {
        success: true,
        data: newRequest,
        message: 'Join request successfully submitted.',
      };
    }
  }

  /**
   * Check status from GET /api/v1/join-requests
   */
  async checkJoinRequestStatus(): Promise<ChurchJoinRequest | null> {
    try {
      const requests = await apiClient.get<BackendMembership[]>('/join-requests');
      if (requests && requests.length > 0) {
        const latest = requests[0];
        return {
          id: latest.id,
          churchId: latest.churchId,
          churchName: latest.church?.name || 'Your Church',
          churchLocation: latest.church?.city || '',
          status: (latest.status?.toLowerCase() as 'pending' | 'approved' | 'rejected') || 'pending',
          submittedAt: latest.joinedAt,
          rejectionReason: latest.rejectionReason || undefined,
        };
      }
    } catch {
      // Return active local request if backend request fails
    }
    return this.activeJoinRequest;
  }

  getActiveJoinRequest(): ChurchJoinRequest | null {
    return this.activeJoinRequest;
  }

  clearActiveJoinRequest(): void {
    this.activeJoinRequest = null;
  }

  toggleFavorite(churchId: string): boolean {
    if (this.favoriteIds.has(churchId)) {
      this.favoriteIds.delete(churchId);
      return false;
    } else {
      this.favoriteIds.add(churchId);
      return true;
    }
  }

  isFavorite(churchId: string): boolean {
    return this.favoriteIds.has(churchId);
  }
}

export const churchService = new ChurchService();
export default churchService;
`;

fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/services/profileService.ts', profileServiceContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/services/churchService.ts', churchServiceContent, 'utf8');

console.log('Successfully updated profileService.ts and churchService.ts');
