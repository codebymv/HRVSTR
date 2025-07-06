import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronRight, Home, Search, FileText, Folder, Menu, X, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { docsService, DocStructure } from '../../services/docsService';

interface Breadcrumb {
  name: string;
  path: string;
}

const HelpPage: React.FC = () => {
  const { '*': pathParam } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [docStructure, setDocStructure] = useState<DocStructure[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme classes
  const isLight = theme === 'light';
  const bgColor = isLight ? 'bg-white' : 'bg-gray-900';
  const textColor = isLight ? 'text-gray-900' : 'text-gray-100';
  const borderColor = isLight ? 'border-gray-200' : 'border-gray-700';
  const sidebarBg = isLight ? 'bg-gray-50' : 'bg-gray-800';
  const searchBg = isLight ? 'bg-white' : 'bg-gray-700';
  const searchBorder = isLight ? 'border-gray-300' : 'border-gray-600';
  const linkColor = isLight ? 'text-blue-600' : 'text-blue-400';
  const linkHoverColor = isLight ? 'text-blue-800' : 'text-blue-300';
  const mutedTextColor = isLight ? 'text-gray-500' : 'text-gray-400';
  const buttonBgColor = 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700';

  const location = useLocation();
  console.log('Current path:', location.pathname);
  // Show back button on all pages except the root path
  const isHomePage = ['/', ''].includes(location.pathname);
  const showBackButton = !isHomePage;
  console.log('Show back button:', showBackButton, 'for path:', location.pathname, 'isHomePage:', isHomePage);

  // Load document structure on component mount
  useEffect(() => {
    const loadDocStructure = async () => {
      try {
        const structure = await docsService.getDocStructure();
        setDocStructure(structure);
      } catch (error) {
        console.error('Failed to load doc structure:', error);
      }
    };

    loadDocStructure();
  }, []);

  // Load markdown content
  const loadMarkdownContent = async (path: string) => {
    try {
      setLoading(true);
      // If path is empty (root /help) or 'getting-started', fetch 'getting-started.md'
      const effectivePath = (!path || path === '/') ? 'getting-started' : path;
      
      // Check if this path is a folder in our structure
      const structure = await docsService.getDocStructure();
      const isFolder = findItemByPath(structure, effectivePath)?.type === 'folder';
      
      let markdownContent: string;
      if (isFolder) {
        // Generate folder content listing
        markdownContent = docsService.generateFolderContent(effectivePath);
      } else {
        // Load actual markdown content
        markdownContent = await docsService.getDocContent(effectivePath);
      }
      
      setContent(markdownContent);
    } catch (error) {
      setContent('## Error\n\nUnable to load documentation content.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find an item by path in the structure
  const findItemByPath = (items: DocStructure[], path: string): DocStructure | null => {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children) {
        const found = findItemByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  // Update path and breadcrumbs
  useEffect(() => {
    const path = pathParam || ''; // Default to empty string if undefined, which means /help
    const pathSegments = path.split('/').filter(Boolean);
    setCurrentPath(pathSegments);

    // Generate breadcrumbs
    const crumbs: Breadcrumb[] = [{ name: 'Help', path: '/help' }];
    let currentCrumbPath = '/help';

    pathSegments.forEach((segment) => {
      currentCrumbPath += `/${segment}`;
      crumbs.push({
        name: segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        path: currentCrumbPath
      });
    });

    setBreadcrumbs(crumbs);
    loadMarkdownContent(path);
    
    // Close sidebar on mobile when content changes
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathParam]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('docs-sidebar');
      const menuButton = document.getElementById('mobile-menu-button');
      
      if (
        isSidebarOpen &&
        sidebar &&
        !sidebar.contains(event.target as Node) &&
        menuButton &&
        !menuButton.contains(event.target as Node)
      ) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSidebarOpen]);

  // Render document tree
  const renderDocTree = (items: DocStructure[], level = 0) => {
    return items.map((item) => (
      <div key={item.path} className={`ml-${level * 3}`}>
        <Link
          to={`/help/${item.path}`}
          className={`flex items-center px-3 py-2 rounded-md text-sm transition-colors ${
            (pathParam === item.path || (pathParam === '' && item.path === 'getting-started')) 
              ? (theme === 'dark' ? 'bg-gray-700 text-blue-300' : 'bg-gray-200 text-blue-700') 
              : (theme === 'dark' 
                  ? 'text-gray-300 hover:bg-gray-700 hover:text-blue-300' 
                  : 'text-gray-700 hover:bg-gray-200 hover:text-blue-700'
                )
          }`}
          onClick={() => {
            // Close sidebar on mobile when link is clicked
            if (window.innerWidth < 1024) {
              setIsSidebarOpen(false);
            }
          }}
        >
          {item.type === 'folder' ? (
            <Folder className={`h-4 w-4 mr-2 flex-shrink-0 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
            }`} />
          ) : (
            <FileText className={`h-4 w-4 mr-2 flex-shrink-0 ${
              theme === 'dark' ? 'text-green-400' : 'text-green-500'
            }`} />
          )}
          <span className="truncate">{item.name}</span>
        </Link>
        {item.children && (
          <div className="ml-3">
            {renderDocTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  // Filter docs for search
  const getFilteredDocs = (items: DocStructure[], searchTerm: string): DocStructure[] => {
    if (!searchTerm) return items;

    const filtered: DocStructure[] = [];
    
    items.forEach(item => {
      if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered.push(item);
      }
      if (item.children) {
        const filteredChildren = getFilteredDocs(item.children, searchTerm);
        if (filteredChildren.length > 0) {
          if (!filtered.find(f => f.path === item.path)) {
            filtered.push({
              ...item,
              children: filteredChildren
            });
          } else {
             const existingItem = filtered.find(f => f.path === item.path);
             if(existingItem && existingItem.children) {
                existingItem.children = [...existingItem.children, ...filteredChildren].filter((v,i,a)=>a.findIndex(t=>(t.path === v.path))===i);
             } else if (existingItem) {
                existingItem.children = filteredChildren;
             }
          }
        }
      }
    });

    return filtered;
  };

  const filteredDocs = getFilteredDocs(docStructure, searchTerm);

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} transition-colors duration-200`} style={{ WebkitTapHighlightColor: 'transparent' }}>

      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <div
          id="docs-sidebar"
          className={`
            ${sidebarBg} ${borderColor} border-r flex flex-col flex-shrink-0
            lg:w-80 lg:relative lg:translate-x-0
            fixed inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b ${borderColor}">
            <div className="flex items-center justify-between lg:justify-center">
              <h2 className="text-lg font-semibold">Documentation</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-4 flex flex-col flex-grow overflow-hidden">
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className={`h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${searchBorder} ${searchBg} focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    theme === 'dark' 
                      ? 'text-gray-100 placeholder-gray-400 focus:border-blue-400' 
                      : 'text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            {/* Navigation Tree */}
            <div className="space-y-1 overflow-y-auto flex-grow">
              {renderDocTree(filteredDocs)}
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop: Back button aligned with content */}
          <div className="hidden lg:block py-4">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <div className="w-64">
                  {showBackButton && (
                    <button 
                      onClick={() => navigate(-1)}
                      className={`flex items-center ${buttonBgColor} text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm hover:shadow-md transition-colors`}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet: Back and Menu in same row */}
          <div className="lg:hidden px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button 
                  onClick={() => navigate(-1)}
                  className={`flex items-center justify-center ${buttonBgColor} text-white px-4 py-2.5 rounded-md text-sm font-medium shadow-sm hover:shadow-md transition-colors whitespace-nowrap`}
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  <span>Back</span>
                </button>
              )}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-md border shadow-sm hover:shadow-md transition-colors ${
                  theme === 'dark' 
                    ? 'bg-gray-800 text-white border-gray-600 hover:bg-gray-700' 
                    : 'bg-white text-gray-900 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Menu className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium truncate">Documentation Menu</span>
              </button>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto w-full">
            <div className="px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
              
              {/* Breadcrumbs */}
              <nav className="flex mb-6 lg:mb-8" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 flex-wrap">
                  {breadcrumbs.map((crumb, index) => (
                    <li key={crumb.path} className="flex items-center">
                      {index === 0 && breadcrumbs.length > 1 && pathParam !== '' ? (
                         <Link
                          to={crumb.path}
                          className={`${linkColor} hover:${linkHoverColor} transition-colors flex items-center text-sm lg:text-base`}
                        >
                           <Home className="h-4 w-4 mr-1" /> 
                           <span className="hidden sm:inline">{crumb.name}</span>
                           <span className="sm:hidden">Help</span>
                         </Link>
                      ) : index === 0 && (pathParam === '' || breadcrumbs.length === 1) ? (
                        <span className={`${mutedTextColor} flex items-center text-sm lg:text-base`}>
                          <Home className="h-4 w-4 mr-1" /> 
                          <span className="hidden sm:inline">{crumb.name}</span>
                          <span className="sm:hidden">Help</span>
                        </span>
                      ) : (
                        <ChevronRight className={`h-4 w-4 mx-1 lg:mx-2 ${mutedTextColor} flex-shrink-0`} />
                      )}
                      {index > 0 && (
                        index === breadcrumbs.length - 1 ? (
                          <span className={`${mutedTextColor} text-sm lg:text-base truncate max-w-xs lg:max-w-none`}>{crumb.name}</span>
                        ) : (
                          <Link
                            to={crumb.path}
                            className={`${linkColor} hover:${linkHoverColor} transition-colors text-sm lg:text-base truncate max-w-xs lg:max-w-none`}
                          >
                            {crumb.name}
                          </Link>
                        )
                      )}
                    </li>
                  ))}
                </ol>
              </nav>

              {/* Content */}
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/6"></div>
                  </div>
                </div>
              ) : (
                <div className={`
                  prose prose-sm sm:prose lg:prose-lg max-w-none 
                  ${theme === 'dark' 
                    ? 'prose-invert prose-headings:text-gray-100 prose-p:text-gray-200 prose-li:text-gray-200 prose-td:text-gray-200 prose-th:text-gray-200' 
                    : 'prose-headings:text-gray-900 prose-p:text-gray-800 prose-li:text-gray-800 prose-td:text-gray-800 prose-th:text-gray-800'
                  }
                  prose-headings:font-semibold prose-headings:tracking-tight
                  ${theme === 'dark' 
                    ? 'prose-a:text-blue-400 hover:prose-a:text-blue-300' 
                    : 'prose-a:text-blue-600 hover:prose-a:text-blue-800'
                  }
                  prose-strong:font-semibold
                  ${theme === 'dark' 
                    ? 'prose-strong:text-gray-100 prose-code:text-blue-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded' 
                    : 'prose-strong:text-gray-900 prose-code:text-blue-700 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded'
                  }
                  prose-pre:text-sm prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border
                  ${theme === 'dark' 
                    ? 'prose-pre:bg-gray-900 prose-pre:border-gray-700 prose-pre:text-gray-200' 
                    : 'prose-pre:bg-gray-50 prose-pre:border-gray-200 prose-pre:text-gray-800'
                  }
                  prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic
                  ${theme === 'dark' 
                    ? 'prose-blockquote:border-blue-400 prose-blockquote:text-gray-300' 
                    : 'prose-blockquote:border-blue-500 prose-blockquote:text-gray-600'
                  }
                  prose-img:rounded-lg prose-img:shadow-md prose-img:border
                  ${theme === 'dark' ? 'prose-img:border-gray-700' : 'prose-img:border-gray-200'}
                  prose-table:text-sm
                  ${theme === 'dark' 
                    ? 'prose-th:bg-gray-800 prose-td:border-gray-700 prose-th:border-gray-700' 
                    : 'prose-th:bg-gray-50 prose-td:border-gray-200 prose-th:border-gray-200'
                  }
                  prose-hr:border-gray-300 dark:prose-hr:border-gray-600
                  prose-ul:list-disc prose-ol:list-decimal
                  prose-li:my-1
                  ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}
                `}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage; 