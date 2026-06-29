export async function saveProfile(profile) {
  return chrome.storage.local.set({ userProfile: profile });
}

export async function getProfile() {
  return chrome.storage.local.get('userProfile');
}