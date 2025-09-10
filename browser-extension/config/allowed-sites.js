// Social media platforms where HumanReplies context.js should be active
export const SOCIAL_MEDIA_SITES = [
  'x.com',
  'twitter.com',
  'linkedin.com',
  'facebook.com'
];

// Function to check if current site is a social media platform
export function isSocialMediaSite(hostname) {
  if (!hostname) return false;
  
  const normalizedHostname = hostname.toLowerCase();
  
  return SOCIAL_MEDIA_SITES.some(site => 
    normalizedHostname.includes(site)
  );
}

// Function to get current site status
export function getCurrentSiteInfo() {
  const hostname = window.location.hostname.toLowerCase();
  
  return {
    hostname,
    isSocialMedia: isSocialMediaSite(hostname),
    matchedSite: SOCIAL_MEDIA_SITES.find(site => hostname.includes(site)) || null
  };
}