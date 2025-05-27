import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { MessageSquare, ArrowUpRight, ExternalLink } from 'lucide-react';
import { RedditPost as RedditPostType } from '../../types';
import { formatDate } from './sentimentUtils';

interface RedditPostProps {
  post: RedditPostType;
}

const RedditPost: React.FC<RedditPostProps> = ({ post }) => {
  const { title, author, upvotes, commentCount, content, url, created, subreddit } = post;
  
  // Get theme context
  const { theme } = useTheme();
  const isLight = theme === 'light';
  
  // Theme-specific styling
  const cardBgColor = isLight ? 'bg-stone-300' : 'bg-gray-800';
  // Use subtle hover effects with opacity for both light and dark modes
  const cardHoverEffect = isLight 
    ? 'hover:bg-stone-400/20' // 20% opacity for subtle light mode hover
    : 'hover:bg-gray-600/20';  // 20% opacity for subtle dark mode hover
  const borderColor = isLight ? 'border-stone-400' : 'border-gray-700';
  const headingTextColor = isLight ? 'text-stone-800' : 'text-white';
  const textColor = isLight ? 'text-stone-700' : 'text-gray-400';
  const mutedTextColor = isLight ? 'text-stone-600' : 'text-gray-500';
  const linkHoverColor = 'hover:text-blue-500';
  
  return (
    <div className={`${cardBgColor} rounded-lg p-4 ${cardHoverEffect} transition-colors duration-200 border ${borderColor} cursor-pointer overflow-hidden w-full`}>
      <div className="flex justify-between items-start gap-2">
        <h3 className={`text-md font-semibold ${headingTextColor} line-clamp-2 flex-1 break-words`}>{title}</h3>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`${textColor} ${linkHoverColor} transition-colors shrink-0`}
        >
          <ExternalLink size={16} />
        </a>
      </div>
      
      <p className={`text-sm ${textColor} mt-2 line-clamp-3 break-words whitespace-normal`}>{content}</p>
      
      <div className={`flex flex-wrap items-center gap-2 mt-3 text-xs ${mutedTextColor}`}>
        <span className={`font-medium ${textColor}`}>r/{subreddit}</span>
        <span className="hidden sm:inline">•</span>
        <span>{formatDate(created)}</span>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="flex items-center">
          <span className={`text-xs ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>by </span>
          <span className={`text-xs font-medium ${isLight ? 'text-blue-600' : 'text-blue-400'} ml-1`}>{author}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            <ArrowUpRight size={16} className="text-green-500" />
            <span className="text-xs ml-1">{upvotes}</span>
          </div>
          
          <div className={`flex items-center ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
            <MessageSquare size={16} />
            <span className="text-xs ml-1">{commentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedditPost;