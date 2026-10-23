// Data Policy for Youngie App
// A social networking and community app

export interface PolicySection {
  title: string;
  content: string;
}

export const dataPolicyData: { lastUpdated: string; sections: PolicySection[] } = {
  lastUpdated: 'February 22, 2026',
  
  sections: [
    {
      title: '1. Data We Collect',
      content: 'Youngie collects the following data to provide our service:\n\n• Account Data: Email, username, and profile information\n• Profile Content: Photos, bio, age, gender, interests\n• Communication Data: Messages, voice messages, call logs\n• Connection Data: Friend requests, follows, and connections\n• Usage Data: Features used, time spent, and how you interact with content\n• Device Data: Device type, OS version, unique identifiers (IMEI, advertising ID)\n• Location Data: City/region (for nearby discovery); precise location (opt-in)\n• Log Data: Access times, crash reports, diagnostics, IP addresses\n• Network Data: Connection type, signal strength'
    },
    {
      title: '2. How We Use Your Data',
      content: 'Your data enables our service:\n\n• Account Management: Creating and maintaining your account\n• Recommendations: Suggesting posts, communities, and people to discover\n• Messaging: Enabling direct messages with your connections\n• Calls: Providing voice and video call features\n• Notifications: Sending message, comment, like, and follow alerts\n• Personalization: Customizing your feed and recommendations\n• Analytics: Understanding app usage to improve features\n• Security: Detecting fraud and preventing abuse\n• Moderation: Enforcing community guidelines'
    },
    {
      title: '3. Discovery and Connections',
      content: 'Your data helps you find people and communities:\n\n• Your profile and activity determine what appears in your feed\n• Location determines who is shown to you as "nearby"\n• Activity (posts, likes, comments) affects who is recommended to you\n• Preferences (age, gender, distance) filter who appears in discovery\n\nYou can adjust preferences in Settings.'
    },
    {
      title: '4. Messaging and Calls',
      content: 'Communication data includes:\n\n• Text messages with people you connect with\n• Voice messages\n• Voice call logs and duration\n• Video call logs\n\nAll communications are encrypted in transit and stored securely.'
    },
    {
      title: '5. Data Storage',
      content: 'Data storage practices:\n\n• Stored on secure servers with encryption\n• Retained while your account is active\n• Messages stored until you delete them\n• Logs retained for up to 12 months\n• Some data retained for legal compliance\n\nYou can request deletion at any time.'
    },
    {
      title: '6. Your Data Rights',
      content: 'You have full control over your data:\n\n• Access: View all your profile and data\n• Edit: Update any profile information\n• Delete: Remove messages or delete your account\n• Export: Download a copy of your data\n• Objection: Opt out of certain processing\n• Withdrawal: Withdraw consent anytime\n\nTo exercise rights, go to Settings > Privacy.'
    },
    {
      title: '7. Data Sharing',
      content: 'We share data only in these situations:\n\n• Other Users: Profile visible to users; messages only to recipients\n• Service Providers: Hosting, analytics, customer support\n• Legal: When required by law or court order\n• Safety: To prevent harm to users or public\n\nWe do NOT sell your personal data to advertisers.'
    },
    {
      title: '8. Location Data',
      content: 'Location helps power nearby discovery:\n\n• City/Region: Used to show nearby users and local content (cannot be disabled for app functionality)\n• Precise Location: Optional, for more accurate nearby results\n• Location is never shared with other users explicitly\n\nYou can disable precise location in device settings.'
    },
    {
      title: '9. Cookies and Tracking',
      content: 'Data collection technologies:\n\n• Essential Cookies: Required for authentication\n• Analytics: Helps us understand app usage\n• You can control tracking in device settings\n\nSome features require cookies to function properly.'
    },
    {
      title: '10. Security Measures',
      content: 'We protect your data:\n\n• Encryption: Messages and calls encrypted in transit\n• Passwords: Stored using secure hashing\n• Access Controls: Limited employee access to data\n• Monitoring: Regular security audits\n• Incidents: Procedures for data breaches\n\nNo method of transmission is 100% secure.'
    },
    {
      title: '11. Data Retention',
      content: 'How long we keep data:\n\n• Active Account: All data retained while using the app\n• Deleted Messages: Removed from our servers\n• Deleted Account: Data deleted within 30 days\n• Logs: Kept for up to 12 months\n• Legal Holds: Some data retained longer if required'
    },
    {
      title: '12. Third-Party Services',
      content: 'We use trusted third parties:\n\n• Cloud Hosting: Data storage and processing\n• Analytics: Understanding app usage\n• Authentication: Secure login services\n• Payments: Processing subscriptions (if applicable)\n• Push Notifications: App communications\n\nThese services have their own privacy policies.'
    },
    {
      title: '13. Age-Restricted Data',
      content: 'We collect data only from our target users:\n\n• Youngie is for users between 13-29 years old\n• We collect data only from users within this age range\n• If an account outside this range is discovered, data is deleted\n\nIf you believe someone outside this age group has created an account, please contact us.'
    },
    {
      title: '14. International Transfers',
      content: 'Your data may be transferred:\n\n• To servers in different countries\n• With appropriate legal safeguards\n• In compliance with data protection laws\n\nBy using Youngie, you consent to such transfers.'
    },
    {
      title: '15. Changes to Policy',
      content: 'We may update this Data Policy:\n\n• Material changes will be communicated in-app\n• Continued use constitutes acceptance\n• Previous versions available upon request\n\nCheck back periodically for updates.'
    },
    {
      title: '16. Contact and Requests',
      content: 'For data-related questions:\n\n• Email: privacy@youngie.social\n• In-App: Settings > Help Center\n• Response Time: Within 30 days\n\nYou can make data requests through the app.'
    }
  ]
};

export default dataPolicyData;
