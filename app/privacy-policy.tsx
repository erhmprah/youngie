// Privacy Policy for Youngie App
// A social networking and dating app

export interface PolicySection {
  title: string;
  content: string;
}

export const privacyPolicyData: { lastUpdated: string; sections: PolicySection[] } = {
  lastUpdated: 'February 22, 2026',
  
  sections: [
    {
      title: '1. Introduction',
      content: 'Youngie is a social networking and dating app that helps people connect, chat, and build relationships. This Privacy Policy explains how we collect, use, and protect your personal information when you use our app.'
    },
    {
      title: '2. Information You Provide',
      content: 'When you create a Youngie account, we collect:\n\n• Profile Information: Name, age, gender, bio, photos, and interests\n• Account Credentials: Email address and password\n• Location: Your city/region for matching purposes\n• Messages: Chat messages, voice messages, and video call data\n• Content: Photos, videos, and posts you share on the app'
    },
    {
      title: '3. Information We Collect Automatically',
      content: 'When you use Youngie, we automatically collect:\n\n• Device Information: Device type, operating system, version, unique device identifiers (like IMEI or advertising ID)\n• Usage Data: Features used, time spent on the app, tap patterns, swipe behavior\n• Location Data: General location (city/region level) for matching; precise location with your consent\n• Log Data: App crashes, performance diagnostics, access times, referring URLs\n• Network Information: IP address, connection type, signal strength\n• Analytics Data: Pages viewed, time spent, features interacted with'
    },
    {
      title: '4. How We Use Your Information',
      content: 'We use your information to:\n\n• Create and manage your account\n• Show you potential matches based on preferences and location\n• Enable messaging, voice calls, and video chat\n• Personalize your experience and recommendations\n• Send you notifications (matches, messages, likes)\n• Moderate content and enforce community guidelines\n• Protect against fake accounts and abuse\n• Improve our services through analytics'
    },
    {
      title: '5. Matchmaking and Discovery',
      content: 'Youngie helps you find connections:\n\n• Your profile is shown to other users based on preferences, location, and activity\n• We use algorithms to suggest potential matches\n• You can Like, Pass, or Super Like other users\n• Mutual likes result in a match, enabling messaging\n• Location is used to show users nearby (city/region level only)'
    },
    {
      title: '6. Communication Features',
      content: 'Our app offers various ways to communicate:\n\n• Text messaging with matched users\n• Voice messages and voice calls\n• Video chat for face-to-face conversations\n• In-app calls and video calls\n\nAll communications are encrypted and stored securely.'
    },
    {
      title: '7. Who Can See Your Information',
      content: 'Your profile visibility depends on settings:\n\n• Public Profile: Visible to all users within your preferences\n• Matched Only: Only users you have matched with can message you\n• Private Mode: Hide your profile from certain sections\n\nYou control who can see your profile through privacy settings.'
    },
    {
      title: '8. Information Sharing',
      content: 'We share your information only with:\n\n• Other Users: Profile is visible per your privacy settings; messages shared only with recipients\n• Service Providers: Companies hosting our servers, providing analytics\n• Legal: When required by law or to protect safety\n\nWe do NOT sell your personal data to advertisers or third parties.'
    },
    {
      title: '9. Blocking and Muting',
      content: 'You have control over interactions:\n\n• Block Users: Prevent someone from seeing your profile or contacting you\n• Mute Users: Hide content from specific users without blocking\n• Report: Report inappropriate behavior to our moderation team\n\nBlocked users are notified they have been blocked, but not the reason.'
    },
    {
      title: '10. Data Retention',
      content: 'We keep your data while your account is active:\n\n• Messages: Stored until you delete them or your account\n• Profile: Available until account deletion\n• Logs: Retained for security and analytics\n\nYou can delete your account anytime in Settings.'
    },
    {
      title: '11. Security',
      content: 'We protect your data with:\n\n• Encryption of messages and calls\n• Secure storage of passwords\n• Regular security audits\n• Moderation of content and behavior\n\nWhile we take security seriously, no app is 100% secure. Use caution when sharing sensitive information.'
    },
    {
      title: '12. Your Rights',
      content: 'You can control your data:\n\n• Access: View your profile and data\n• Edit: Update your profile anytime\n• Delete: Delete your account and associated data\n• Export: Download your data\n• Opt-out: Disable certain features in settings'
    },
    {
      title: '13. Age Requirement',
      content: 'Youngie is for users between 13-29 years old. We collect data only from users within this age range. If we discover an account outside this age group, we will delete it immediately.'
    },
    {
      title: '14. Changes to This Policy',
      content: 'We may update this Privacy Policy occasionally. We will notify you of material changes through the app. Your continued use of Youngie means you accept the updated terms.'
    },
    {
      title: '15. Contact Us',
      content: 'Questions about privacy? Contact us:\n\nEmail: privacy@youngieapp.com\nIn-App: Settings > Help Center'
    }
  ]
};

export default privacyPolicyData;
