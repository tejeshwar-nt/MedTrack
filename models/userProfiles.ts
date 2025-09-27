export type UserRole = 'patient' | 'provider';

export type BaseProfile = {
  uid: string;
  role: UserRole;
  displayName: string;
  email: string;
};

export type PatientProfile = BaseProfile & {
  role: 'patient';
};

export type ProviderProfile = BaseProfile & {
  role: 'provider';
  license?: string;
};

export type AnyProfile = PatientProfile | ProviderProfile;

export function createPatientProfile(init: {
  uid: string; displayName: string; email: string;
}): PatientProfile {
  return {
    uid: init.uid,
    role: 'patient',
    displayName: init.displayName,
    email: init.email,
  };
}

export function createProviderProfile(init: {
  uid: string; displayName: string; email: string; license?: string;
}): ProviderProfile {
  const profile: ProviderProfile = {
    uid: init.uid,
    role: 'provider',
    displayName: init.displayName,
    email: init.email,
  };
  
  // Only add license field if it has a value
  if (init.license && init.license.trim()) {
    profile.license = init.license.trim();
  }
  
  return profile;
}

