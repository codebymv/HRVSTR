import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Github, Twitter, Linkedin, Mail, ExternalLink } from 'lucide-react';

const Footer: React.FC = () => {
  const { theme } = useTheme();
  
  // Theme-specific styling matching the project patterns
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-stone-300' : 'bg-gray-900';
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-800';
  const textColor = isLight ? 'text-stone-800' : 'text-gray-300';
  const secondaryTextColor = isLight ? 'text-stone-600' : 'text-gray-400';
  const hoverTextColor = isLight ? 'text-stone-900' : 'text-white';
  const hoverBgColor = isLight ? 'hover:bg-stone-400' : 'hover:bg-gray-800';
  
  // Logo filter for theme switching
  const logoFilter = isLight ? 'invert(1) brightness(0)' : 'none';

  const currentYear = new Date().getFullYear();

  const footerLinks = [
    // {
    //   title: 'Product',
    //   links: [
    //     { name: 'Sentiment Analysis', href: '/sentiment' },
    //     { name: 'SEC Filings', href: '/sec-filings' },
    //     { name: 'Earnings Monitor', href: '/earnings' },
    //     { name: 'Watchlist', href: '/watchlist' }
    //   ]
    // },
    // {
    //   title: 'Us',
    //   links: [
    //     { name: 'HRVSTR Team', href: '/about' },
    //     { name: 'Terms', href: '/terms' }
    //   ]
    // },
    {
      title: 'Resources',
      links: [
        { name: 'Help/Getting Started', href: '/help' },,
        { name: 'Status', href: '/status' }
      ]
    }
  ];

  const socialLinks = [
    { name: 'GitHub', icon: Github, href: 'https://github.com/codebymv' },
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com/codebymv' },
    { name: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/in/codebymv/' },
    { name: 'Email', icon: Mail, href: 'mailto:codebymv@gmail.com' }
  ];

  return (
    <footer className={`${bgColor} border-t ${borderColor} mt-auto`}>
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <img 
                src="/hrvstr_icon.png" 
                alt="HRVSTR" 
                className="h-8 w-8 mr-3" 
                style={{ filter: logoFilter }}
              />
              <span className={`text-xl font-bold ${textColor}`}>HRVSTR</span>
            </div>
            {/* <p className={`${secondaryTextColor} mb-4 max-w-md`}>
              Strategic web scraping, simplified. Your comprehensive platform for market sentiment analysis and financial monitoring.
            </p> */}
            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-full ${hoverBgColor} transition-colors group`}
                    aria-label={social.name}
                  >
                    <IconComponent 
                      size={20} 
                      className={`${secondaryTextColor} group-hover:${hoverTextColor.split(' ')[0].replace('text-', '')}`} 
                    />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Footer Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h3 className={`text-sm font-semibold ${textColor} uppercase tracking-wider mb-4`}>
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className={`${secondaryTextColor} hover:${hoverTextColor.split(' ')[0].replace('text-', '')} transition-colors text-sm flex items-center group`}
                    >
                      {link.name}
                      <ExternalLink size={12} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className={`pt-8 border-t ${borderColor} flex flex-col md:flex-row justify-between items-center`}>
          <div className={`${secondaryTextColor} text-sm mb-4 md:mb-0`}>
            © {currentYear} HRVSTR. All rights reserved.
          </div>
          {/* <div className="flex items-center space-x-6">
            <a 
              href="/privacy" 
              className={`${secondaryTextColor} hover:${hoverTextColor.split(' ')[0].replace('text-', '')} transition-colors text-sm`}
            >
              Privacy
            </a>
            <a 
              href="/terms" 
              className={`${secondaryTextColor} hover:${hoverTextColor.split(' ')[0].replace('text-', '')} transition-colors text-sm`}
            >
              Terms
            </a>
            <a 
              href="/cookies" 
              className={`${secondaryTextColor} hover:${hoverTextColor.split(' ')[0].replace('text-', '')} transition-colors text-sm`}
            >
              Cookies
            </a>
          </div> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer; 