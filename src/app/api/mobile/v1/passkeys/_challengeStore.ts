declare global {
  var mobilePasskeyChallenges: Map<string, string> | undefined;
}

if (!global.mobilePasskeyChallenges) {
  global.mobilePasskeyChallenges = new Map();
}

export const mobilePasskeyChallenges = global.mobilePasskeyChallenges;
