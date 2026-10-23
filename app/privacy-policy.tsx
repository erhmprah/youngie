// Privacy Policy for Youngie App
// A social networking and community app

export interface PolicySection {
  title: string;
  content: string;
}

export const privacyPolicyData: { lastUpdated: string; sections: PolicySection[] } = {
  lastUpdated: 'February 22, 2026',

  sections: [
    {
      title: '1. Introduction',
      content: 'Youngie is a social networking and community app that helps people connect, share, and find their community. This Privacy Policy explains how we collect, use, and protect your personal information when you use our app.'
    },
    {
      title: '2. Information You Provide',
      content: 'When you create a Youngie account, we collect:\n\n• Profile Information: Name, username, age, gender, bio, profile photo, cover photo, and interests\n• Account Credentials: Email address\n• Location: Your city/region for nearby discovery\n• Messages: Chat messages, voice messages, and video call data\n• Content: Photos, videos, posts, and stories you share on the app'
    },
    {
      title: '3. Information We Collect Automatically',
      content: 'When you use Youngie, we automatically collect:\n\n• Device Information: Device type, operating system, version, unique device identifiers\n• Usage Data: Features used, time spent on the app, and how you interact with posts and stories\n• Location Data: General location (city/region level) for nearby discovery and local content; precise location with your consent\n• Log Data: App crashes, performance diagnostics, access times, referring URLs\n• Network Information: IP address, connection type, signal strength\n• Analytics Data: Pages viewed, time spent, features interacted with'
    },
    {
      title: '4. How We Use Your Information',
      content: 'We use your information to:\n\n• Create and manage your account\n• Personalize your feed, stories, and recommendations\n• Enable messaging, voice calls, and video chat\n• Recommend posts, communities, and people to discover\n• Send you notifications (new posts, messages, likes, comments, and follow activity)\n• Moderate content and enforce community guidelines\n• Protect against fake accounts and abuse\n• Improve our services through analytics'
    },
    {
      title: '5. Discovery and Connections',
      content: 'Youngie helps you find and connect with people and communities:\n\n• Your activity determines what appears in your feed and who is recommended to you\n• Discover people nearby (city/region level only) and search for users and communities\n• Follow people and send friend requests; once accepted, you are connected\n• Some communities are anonymous, hiding your identity from other members\n• You control what is shown to others through privacy settings'
    },
    {
      title: '6. Communication Features',
      content: 'Our app offers various ways to communicate:\n\n• Direct messages with people you connect with\n• Community posts and comments\n• Voice messages, voice calls, and video chat\n• Story replies and reactions\n\nAll communications are encrypted in transit and stored securely.'
    },
    {
      title: '7. Who Can See Your Information',
      content: 'Your profile visibility depends on settings:\n\n• Public Profile: Visible to users who discover you or search for you\n• Private Account: Only people you approve can see your photos and videos\n• Community Visibility: Control what you share in each community\n• Anonymous Mode: Browse the anonymous feed without your activity appearing on your profile\n\nYou control who can see your profile through privacy settings.'
    },
    {
      title: '8. Information Sharing',
      content: 'We share your information only with:\n\n• Other Users: Profile is visible per your privacy settings; messages shared only with recipients\n• Service Providers: Companies hosting our servers, providing analytics, and supporting authentication, notifications, and advertising\n• Legal: When required by law or to protect safety\n\nWe do NOT sell your personal data to advertisers or third parties.'
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
      content: 'We protect your data with:\n\n• Encryption of messages and calls in transit\n• Secure storage of passwords\n• Regular security audits\n• Moderation of content and behavior\n\nWhile we take security seriously, no app is 100% secure. Use caution when sharing sensitive information.'
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
      content: 'Questions about privacy? Contact us:\n\nEmail: privacy@youngie.social\nIn-App: Settings > Help Center'
    }
  ]
};

export default privacyPolicyData;
