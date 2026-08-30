import fs from 'node:fs';

const webOnboardingApiContent = `import { apiClient } from "@/lib/apiClient";
import type { ChurchOnboardingDraft, CongregationSize, ChurchLanguage } from "@/types/api";

export interface Step1Payload {
  firstName: string;
  lastName: string;
  churchName: string;
  denomination: string;
  congregationSize: CongregationSize;
  foundedYear?: number;
}

export interface Step2Payload {
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  primaryLanguage: ChurchLanguage;
  timeZone: string;
}

export interface ServiceTimeInput {
  label: string;
  dayOfWeek: number;
  time: string;
}

export interface CustomMinistryInput {
  name: string;
  type: "MINISTRY" | "DEPARTMENT";
  description?: string;
  icon?: string;
}

export interface Step4Payload {
  ministryIds: string[];
  customMinistries: CustomMinistryInput[];
}

export async function saveStep1(payload: Step1Payload) {
  return apiClient.patch<{ status: string }>("/onboarding/church/step-1", payload);
}

export async function saveStep2(payload: Step2Payload) {
  return apiClient.patch<{ status: string }>("/onboarding/church/step-2", payload);
}

export async function saveStep3(serviceTimes: ServiceTimeInput[], logoFile?: File | null) {
  const formData = new FormData();
  formData.append("serviceTimes", JSON.stringify(serviceTimes));
  if (logoFile) {
    formData.append("logo", logoFile);
  }
  return apiClient.patch<{ status: string }>("/onboarding/church/step-3", formData);
}

export async function saveStep4(payload: Step4Payload) {
  return apiClient.patch<{ status: string }>("/onboarding/church/step-4", payload);
}

export async function getDraft(): Promise<ChurchOnboardingDraft | null> {
  try {
    return await apiClient.get<ChurchOnboardingDraft>("/onboarding/church/draft");
  } catch {
    return null;
  }
}

export async function completeOnboarding() {
  return apiClient.post<{ status: string; message: string }>("/onboarding/church/complete");
}
`;

const webProfileAndJoinApiContent = `import { apiClient } from "@/lib/apiClient";
import type { MemberProfile, ChurchMembership, Gender, MaritalStatus, MembershipStatus } from "@/types/api";

export interface CompleteProfileInput {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phoneNumber: string;
  contactEmail: string;
  city: string;
  address: string;
  maritalStatus: MaritalStatus;
  occupation?: string;
  profilePhoto?: File | null;
}

export async function completeMemberProfile(input: CompleteProfileInput): Promise<MemberProfile> {
  const formData = new FormData();
  formData.append("fullName", input.fullName);
  formData.append("dateOfBirth", input.dateOfBirth);
  formData.append("gender", input.gender);
  formData.append("phoneNumber", input.phoneNumber);
  formData.append("contactEmail", input.contactEmail);
  formData.append("city", input.city);
  formData.append("address", input.address);
  formData.append("maritalStatus", input.maritalStatus);
  if (input.occupation) {
    formData.append("occupation", input.occupation);
  }
  if (input.profilePhoto) {
    formData.append("profilePhoto", input.profilePhoto);
  }
  return apiClient.post<MemberProfile>("/members/profile/complete", formData);
}

export async function getMemberProfile(): Promise<MemberProfile | null> {
  try {
    return await apiClient.get<MemberProfile>("/members/profile");
  } catch {
    return null;
  }
}

export async function submitJoinRequest(churchId: string): Promise<ChurchMembership> {
  return apiClient.post<ChurchMembership>("/join-requests", { churchId });
}

export async function getJoinRequests(filters?: { status?: MembershipStatus; churchId?: string }): Promise<ChurchMembership[]> {
  return apiClient.get<ChurchMembership[]>("/join-requests", { params: filters });
}

export async function approveJoinRequest(membershipId: string) {
  return apiClient.post<{ status: string; message: string }>("/join-requests/approve", { membershipId });
}

export async function rejectJoinRequest(membershipId: string, rejectionReason?: string) {
  return apiClient.post<{ status: string; message: string }>("/join-requests/reject", {
    membershipId,
    rejectionReason,
  });
}
`;

fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib/onboarding-api.ts', webOnboardingApiContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib/profile-api.ts', webProfileAndJoinApiContent, 'utf8');

console.log('Created onboarding-api.ts and profile-api.ts for ChurchEden-Web');
