// Community Guidelines for Youngie App
// A social networking and community app

export interface PolicySection {
  title: string;
  content: string;
}

export const communityGuidelinesData: { lastUpdated: string; sections: PolicySection[] } = {
  lastUpdated: 'February 22, 2026',
  
  sections: [
    {
      title: '1. Our Community',
      content: 'Youngie is a community where people come to connect, share, and find their community. We expect all members to treat each other with kindness and respect. These guidelines help keep Youngie a safe and welcoming place for everyone.'
    },
    {
      title: '2. Be Respectful',
      content: 'Treat all members with respect:\n\n• Be polite and courteous in messages\n• Accept that not everyone will connect\n• Respect different backgrounds and perspectives\n• No discrimination or hate speech\n• No harassment or bullying\n\nRemember: Behind every profile is a real person.'
    },
    {
      title: '3. Be Authentic',
      content: 'Be yourself on Youngie:\n\n• Use real photos of yourself (not stock photos)\n• Be honest about your age and information\n• Do not impersonate others\n• Create only one account\n• Represent yourself accurately\n\nAuthenticity leads to better connections.'
    },
    {
      title: '4. Keep It Appropriate',
      content: 'Content on Youngie must be appropriate:\n\n• No sexually explicit photos or content\n• No nudity\n• No violence or gore\n• No illegal content\n• No spam or commercial advertising\n\nInappropriate content will be removed. Repeated violations lead to account suspension.'
    },
    {
      title: '5. Messaging Guidelines',
      content: 'When messaging on Youngie:\n\n• Only message people you connect with\n• Do not send unsolicited messages\n• No harassment or threats\n• No spam or repetitive messages\n• Respect when someone does not respond\n\nIf someone asks you to stop messaging, respect their wishes.'
    },
    {
      title: '6. Safety First',
      content: 'Protect yourself on Youngie:\n\n• Do not share personal information (address, phone, bank details) with strangers\n• Be cautious about sharing identifying photos\n• Be careful with video calls - they can be recorded\n• Meet in public places if you decide to meet in person\n• Tell someone you trust where you are going\n• Trust your instincts - if something feels wrong, it probably is'
    },
    {
      title: '7. Meeting In Person',
      content: 'If you decide to meet someone:\n\n• Meet in a public place (cafe, restaurant, mall)\n• Tell a friend or family member where you are going\n• Keep your phone charged and accessible\n• Consider a video call first to verify identity\n• Do not bring the person to your home on first meeting\n• Trust your instincts and leave if you feel uncomfortable\n\nYour safety is your responsibility.'
    },
    {
      title: '8. Money and Gifts',
      content: 'Never:\n\n• Send money to someone you have not met in person\n• Share financial information (bank accounts, credit cards)\n• Accept money or gifts from strangers\n• Engage in any form of financial fraud\n\nScammers may try to build trust before asking for money. Be wary of anyone who asks for financial assistance.'
    },
    {
      title: '9. Blocking and Reporting',
      content: 'Use available tools to protect yourself:\n\n• Block users who make you uncomfortable\n• Mute users to hide their content without blocking\n• Report users who violate guidelines\n\nWe take reports seriously and review all of them. Help us keep the community safe by reporting inappropriate behavior.'
    },
    {
      title: '10. What Happens When Guidelines Are Violated',
      content: 'Violating guidelines may result in:\n\n• Warning message\n• Content removal\n• Limited account features\n• Temporary suspension\n• Permanent account termination\n\nThe severity of consequences depends on the nature and frequency of violations.'
    },
    {
      title: '11. Appealing Decisions',
      content: 'If you believe a decision was made in error:\n\n• You can appeal through Help Center\n• Provide detailed information about your case\n• We will review and respond\n\nWe aim to make fair decisions, but we may not always get it right.'
    },
    {
      title: '12. Working Together',
      content: 'Building a positive community is a shared responsibility:\n\n• Lead by example\n• Support other members\n• Help newcomers understand the rules\n• Celebrate diversity and inclusion\n• Report issues rather than engaging\n\nTogether, we can make Youngie a great place to find connections.'
    },
    {
      title: '13. Questions?',
      content: 'Need help or have questions?\n\n• Visit Settings > Help Center\n• Contact us through the app\n• Check FAQ for common questions\n\nWe are here to help you have a positive experience on Youngie.'
    }
  ]
};

export default communityGuidelinesData;
