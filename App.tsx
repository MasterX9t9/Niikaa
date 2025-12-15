import React, { useState, useEffect, useRef } from 'react';
import { 
  Tone, Length, ArticleType, ImageSize, AspectRatio, Language, 
  ArticleConfig, SavedArticle, User 
} from './types';
import { 
  streamArticleGeneration, suggestKeywords, suggestTopic, 
  generateCoverImage, editGeneratedImage, checkOriginality, generateImage,
  extractFocusKeyword
} from './services/geminiService';
import { 
  IconSparkles, IconFeather, IconSettings, IconArrowLeft, IconX, IconImage, 
  IconShield, IconChevronRight, IconPlus, IconDownload, IconFileText, 
  IconTrash, IconSun, IconMoon, IconRefresh, IconBrush, IconGoogle, IconShare,
  IconClipboard, IconFileCode, IconEdit, IconCheck, IconTag, IconGlobe, IconUser,
  IconAlert, IconCopy
} from './components/Icons';
import { MarkdownView } from './components/MarkdownView';
import { ImageMaskEditor } from './components/ImageMaskEditor';
import { CustomSelect } from './components/CustomSelect';

const USER_KEY = 'ai_writer_user';
const PREFS_KEY = 'ai_writer_prefs';
const CUSTOM_CATS_KEY = 'ai_writer_custom_categories';

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  // -- State: Auth --
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // -- State: UI & Navigation --
  const [view, setView] = useState<'login' | 'dashboard' | 'create' | 'article' | 'history' | 'settings'>('login');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // -- State: Preferences --
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(Language.ENGLISH);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // -- State: Category Modal --
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryInputValue, setEditCategoryInputValue] = useState('');

  // -- State: Article Creation --
  const [config, setConfig] = useState<ArticleConfig>({
    topic: '',
    type: ArticleType.TECH,
    keywords: '',
    tone: Tone.PROFESSIONAL,
    length: [Length.MEDIUM],
    language: Language.ENGLISH,
    additionalInstructions: '',
    generateImage: false,
    imageSize: ImageSize.S_1K,
    aspectRatio: AspectRatio.S_16_9,
    numberOfImages: 1
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [isSuggestingKeywords, setIsSuggestingKeywords] = useState(false);
  const [isSuggestingTopic, setIsSuggestingTopic] = useState(false);
  const [keywordsCopied, setKeywordsCopied] = useState(false);

  // -- State: Image Generation --
  const [generatedImageUrls, setGeneratedImageUrls] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showImageMaskEditor, setShowImageMaskEditor] = useState(false);
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  
  // -- State: Insert Image Modal --
  const [showInsertImageModal, setShowInsertImageModal] = useState(false);
  const [insertImagePrompt, setInsertImagePrompt] = useState('');
  const [insertImageCursorPos, setInsertImageCursorPos] = useState(0);

  // -- State: Analysis --
  const [originalityReport, setOriginalityReport] = useState<string | null>(null);
  const [isCheckingOriginality, setIsCheckingOriginality] = useState(false);
  const [focusKeyword, setFocusKeyword] = useState<string | null>(null);
  const [isExtractingKeyword, setIsExtractingKeyword] = useState(false);

  // -- State: History & Storage --
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  // -- Helper for current image --
  // Safely get the current image URL or null if array is empty or index invalid
  const currentImageUrl = (generatedImageUrls && generatedImageUrls[selectedImageIndex]) || null;
  
  // -- Helper for categories --
  const allCategories = [...Object.values(ArticleType), ...customCategories];

  // -- Effects --
  useEffect(() => {
    // 1. Load User
    const savedUserString = localStorage.getItem(USER_KEY);
    let foundUser: User | null = null;
    if (savedUserString) {
      foundUser = JSON.parse(savedUserString);
      setCurrentUser(foundUser);
    }

    // 2. Load History
    const savedArticlesString = localStorage.getItem('saved_articles');
    if (savedArticlesString) {
      setSavedArticles(JSON.parse(savedArticlesString));
    }

    // 3. Load Preferences
    let savedDefaultLang = Language.ENGLISH;
    const prefsString = localStorage.getItem(PREFS_KEY);
    if (prefsString) {
        try {
            const prefs = JSON.parse(prefsString);
            if (prefs.defaultLanguage) {
                savedDefaultLang = prefs.defaultLanguage;
                setDefaultLanguage(savedDefaultLang);
            }
        } catch(e) { console.error(e); }
    }
    
    // 4. Load Custom Categories
    const savedCats = localStorage.getItem(CUSTOM_CATS_KEY);
    if (savedCats) {
        try {
            setCustomCategories(JSON.parse(savedCats));
        } catch(e) { console.error(e); }
    }

    // 5. Load Auto-save Draft
    const draftString = localStorage.getItem('autosave_draft');
    if (draftString) {
      try {
        const draft = JSON.parse(draftString);
        if (draft.config) {
            // Migration for old drafts
            if (typeof draft.config.length === 'string') {
                draft.config.length = [draft.config.length];
            }
            setConfig(draft.config);
        }
        if (draft.content) setGeneratedContent(draft.content);
        
        // Handle restoration of image(s)
        if (draft.imageUrls && Array.isArray(draft.imageUrls)) {
            setGeneratedImageUrls(draft.imageUrls);
        } else if (draft.imageUrl) {
            setGeneratedImageUrls([draft.imageUrl]);
        }
        
        setSaveStatus('saved');

        // Logic for initial view restoration
        if (foundUser) {
          // If there is significant content, go straight to article view to resume
          if (draft.content && draft.content.length > 20) {
            setView('article');
          } else {
            setView('dashboard');
          }
        } else {
          setView('login');
        }
      } catch (e) {
        console.error("Failed to restore draft", e);
        if (foundUser) setView('dashboard');
      }
    } else {
      // No draft exists, initialize config with saved default language
      setConfig(prev => ({ ...prev, language: savedDefaultLang }));
      if (foundUser) setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // -- Auto-save Effect --
  useEffect(() => {
    // Only save if there's a topic configured, indicating user intent
    if (config.topic) {
        setSaveStatus('saving');
        const draft = {
          config,
          content: generatedContent,
          imageUrl: currentImageUrl, // Backward compat
          imageUrls: generatedImageUrls
        };
        localStorage.setItem('autosave_draft', JSON.stringify(draft));
        
        const timeout = setTimeout(() => {
            setSaveStatus('saved');
        }, 800);

        return () => clearTimeout(timeout);
    }
  }, [config, generatedContent, generatedImageUrls, currentImageUrl]);

  // -- Handlers --
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    
    setTimeout(() => {
      if (email && password) {
        const user: User = { id: '1', name: 'Demo User', email: email, provider: 'email' };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setCurrentUser(user);
        setView('dashboard');
      } else {
        setAuthError('Please enter valid credentials');
      }
      setIsAuthLoading(false);
    }, 1000);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setTimeout(() => {
      const user: User = { id: generateId(), name: fullName, email: email, provider: 'email' };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setCurrentUser(user);
      setView('dashboard');
      setIsAuthLoading(false);
    }, 1000);
  };

  const handleGoogleLogin = () => {
    setIsAuthLoading(true);
    setTimeout(() => {
        const user: User = { 
            id: 'google_' + generateId(), 
            name: 'Alex Chen',
            email: 'alex.chen@gmail.com', 
            provider: 'google',
            avatar: 'https://ui-avatars.com/api/?name=Alex+Chen&background=DB4437&color=fff'
        };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setCurrentUser(user);
        setView('dashboard');
        setIsAuthLoading(false);
    }, 1500);
  };

  const handleLogout = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setAuthError('');
    setIsRegisterMode(false);
    setIsAuthLoading(false);
    setCurrentUser(null);
    localStorage.removeItem(USER_KEY);
    setView('login');
  };

  const handleClearHistory = () => {
      if(window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
          setSavedArticles([]);
          localStorage.removeItem('saved_articles');
      }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser) return;
      const updatedUser = { ...currentUser, name: fullName || currentUser.name };
      setCurrentUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      alert("Profile updated!");
  };
  
  const handleUpdateDefaultLanguage = (lang: Language) => {
      setDefaultLanguage(lang);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ defaultLanguage: lang }));
      // Also update current config if user is in creation mode and hasn't started writing
      if (!config.topic && !generatedContent) {
          setConfig(prev => ({...prev, language: lang}));
      }
  };

  const handleAddCategoryClick = () => {
      setNewCategoryName('');
      setEditingCategory(null);
      setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
      const trimmed = newCategoryName.trim();
      if (!trimmed) return;
      
      // Case-insensitive duplicate check
      if (allCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
          alert("Category already exists");
          return;
      }

      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(updated));
      setConfig(prev => ({ ...prev, type: trimmed }));
      setNewCategoryName('');
      // Keep modal open to allow adding more or seeing the list
  };

  const startEditingCategory = (cat: string) => {
      setEditingCategory(cat);
      setEditCategoryInputValue(cat);
  };

  const saveEditedCategory = () => {
      if (!editingCategory || !editCategoryInputValue.trim()) return;
      const oldName = editingCategory;
      const newName = editCategoryInputValue.trim();
      
      if (oldName === newName) {
          setEditingCategory(null);
          setEditCategoryInputValue('');
          return;
      }

      // Case-insensitive duplicate check
      if (allCategories.some(c => c !== oldName && c.toLowerCase() === newName.toLowerCase())) {
          alert("Category name already exists");
          return;
      }

      const updated = customCategories.map(c => c === oldName ? newName : c);
      setCustomCategories(updated);
      localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(updated));

      // Update current config if needed
      if (config.type === oldName) {
          setConfig(prev => ({ ...prev, type: newName }));
      }
      
      // Update saved articles history
      const updatedSavedArticles = savedArticles.map(article => 
          article.type === oldName ? { ...article, type: newName } : article
      );
      setSavedArticles(updatedSavedArticles);
      localStorage.setItem('saved_articles', JSON.stringify(updatedSavedArticles));

      setEditingCategory(null);
      setEditCategoryInputValue('');
  };

  const handleDeleteCategory = (catToDelete: string) => {
      if (window.confirm(`Delete category "${catToDelete}"?`)) {
          const updated = customCategories.filter(c => c !== catToDelete);
          setCustomCategories(updated);
          localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(updated));
          // If deleted category was selected, reset to default
          if (config.type === catToDelete) {
              setConfig(prev => ({...prev, type: ArticleType.TECH}));
          }
      }
  };

  const handleSuggestTopic = async () => {
    setIsSuggestingTopic(true);
    const topic = await suggestTopic(config.type);
    if (topic) setConfig(prev => ({ ...prev, topic }));
    setIsSuggestingTopic(false);
  };

  const handleSuggestKeywords = async () => {
    if (!config.topic) return;
    setIsSuggestingKeywords(true);
    const keywords = await suggestKeywords(config.topic, config.type);
    setSuggestedKeywords(keywords);
    setIsSuggestingKeywords(false);
  };

  const addKeyword = (kw: string) => {
    setConfig(prev => ({ ...prev, keywords: prev.keywords ? `${prev.keywords}, ${kw}` : kw }));
    setSuggestedKeywords(prev => prev.filter(k => k !== kw));
  };

  const handleCopyKeywords = () => {
    // Combine typed keywords and suggested keywords
    const currentList = config.keywords 
      ? config.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0) 
      : [];
    
    // Create a unique set of keywords from both sources
    const allKeywords = Array.from(new Set([...currentList, ...suggestedKeywords])).join(', ');

    if (!allKeywords) return;
    
    navigator.clipboard.writeText(allKeywords);
    setKeywordsCopied(true);
    setTimeout(() => setKeywordsCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!config.topic) return;
    setIsGenerating(true);
    setGeneratedContent('');
    setGeneratedImageUrls([]);
    setSelectedImageIndex(0);
    setOriginalityReport(null);
    setFocusKeyword(null);
    setIsEditingContent(false);
    setView('article');
    
    try {
      let imagePromise: Promise<string[]> | null = null;
      if (config.generateImage) {
        setIsGeneratingImage(true);
        imagePromise = generateCoverImage(
            config.topic, 
            config.imageSize || ImageSize.S_1K, 
            config.aspectRatio || AspectRatio.S_16_9,
            config.numberOfImages || 1
        )
          .then(urls => { 
              if (urls.length === 0) setImageGenerationError("Could not generate image");
              else setGeneratedImageUrls(urls); 
              setIsGeneratingImage(false); 
              return urls; 
          })
          .catch(err => { 
              console.error("Cover image generation failed:", err); 
              setImageGenerationError("Failed to generate image");
              setIsGeneratingImage(false); 
              return []; 
          });
      }

      // Optimized buffering for smoother rendering (Buzz Speed optimization)
      let contentBuffer = '';
      let lastUpdateTime = 0;
      const RENDER_THROTTLE_MS = 32; // ~30fps update rate

      await streamArticleGeneration(config, (chunk) => {
        contentBuffer += chunk;
        const now = Date.now();
        if (now - lastUpdateTime > RENDER_THROTTLE_MS) {
            setGeneratedContent(contentBuffer);
            lastUpdateTime = now;
        }
      });
      // Ensure final content is set
      setGeneratedContent(contentBuffer);

      if (imagePromise) await imagePromise;
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!generatedContent) return;
    setIsCheckingOriginality(true);
    try {
      const report = await checkOriginality(generatedContent);
      setOriginalityReport(report);
    } catch (e) { console.error(e); } 
    finally { setIsCheckingOriginality(false); }
  };
  
  const handleGetFocusKeyword = async () => {
    if (!generatedContent) return;
    setIsExtractingKeyword(true);
    try {
      const keyword = await extractFocusKeyword(generatedContent);
      setFocusKeyword(keyword);
    } catch (e) {
      console.error(e);
      alert("Failed to extract keyword");
    } finally {
      setIsExtractingKeyword(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!config.topic) return;
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setGeneratedImageUrls([]); // Clear previous to show loading state correctly
    setSelectedImageIndex(0);
    try {
       const urls = await generateCoverImage(
           config.topic, 
           config.imageSize || ImageSize.S_1K, 
           config.aspectRatio || AspectRatio.S_16_9,
           config.numberOfImages || 1
        );
       if (urls.length === 0) {
           setImageGenerationError("Failed to generate images. Please try again.");
       } else {
           setGeneratedImageUrls(urls);
       }
    } catch(e) { 
        console.error(e); 
        setImageGenerationError("Error communicating with image service.");
    } 
    finally { setIsGeneratingImage(false); }
  };

  const handleInsertImage = () => {
      const textarea = textareaRef.current;
      if (!textarea) {
          alert("Please click inside the text editor first.");
          return;
      }
      setInsertImageCursorPos(textarea.selectionStart);
      setInsertImagePrompt('');
      setShowInsertImageModal(true);
  };

  const handleConfirmInsertImage = async () => {
    if (!insertImagePrompt) return;
    setIsGeneratingImage(true);
    
    try {
        // Only generate 1 image for insertion to keep it simple
        const urls = await generateImage(insertImagePrompt, config.imageSize, config.aspectRatio, 1); 
        if (urls.length === 0) {
            alert("Failed to generate image. Please try again or check your prompt.");
            setIsGeneratingImage(false);
            return;
        }
        
        const url = urls[0];
        if (url) {
            const currentContent = generatedContent;
            const position = insertImageCursorPos;
            const before = currentContent.substring(0, position);
            const after = currentContent.substring(position);
            
            const imageMarkdown = `\n\n![${insertImagePrompt}](${url})\n\n`;
            
            const newContent = before + imageMarkdown + after;
            setGeneratedContent(newContent);
            setShowInsertImageModal(false);
            setInsertImagePrompt('');

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newCursorPos = position + imageMarkdown.length;
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 100);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to generate image. Please try again.");
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const startImageEdit = () => {
      const p = prompt("What changes would you like to make?");
      if (p) {
          setImageEditPrompt(p);
          setShowImageMaskEditor(true);
      }
  };

  const handleEditImage = async (maskBase64: string) => {
    if (!currentImageUrl || !imageEditPrompt) return;
    setShowImageMaskEditor(false);
    setIsEditingImage(true);
    try {
      const newUrl = await editGeneratedImage(currentImageUrl, imageEditPrompt, maskBase64);
      if (newUrl) {
          // Update the specific image that was edited
          const newUrls = [...generatedImageUrls];
          newUrls[selectedImageIndex] = newUrl;
          setGeneratedImageUrls(newUrls);
      } else {
          alert("Failed to edit image.");
      }
    } catch (e) { 
        console.error(e); 
        alert("Error editing image.");
    } 
    finally { setIsEditingImage(false); }
  };

  const handleSaveArticle = () => {
    const newArticle: SavedArticle = {
      id: generateId(), 
      topic: config.topic, 
      content: generatedContent,
      date: Date.now(), 
      type: config.type, 
      imageUrl: currentImageUrl // Save the currently selected cover image
    };
    const newSaved = [newArticle, ...savedArticles];
    setSavedArticles(newSaved);
    localStorage.setItem('saved_articles', JSON.stringify(newSaved));
    setView('history');
  };

  const insertText = (before: string, after: string = '') => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      
      const newText = text.substring(0, start) + before + text.substring(start, end) + after + text.substring(end);
      setGeneratedContent(newText);
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + before.length, end + before.length);
      }, 0);
  };

  // Toggle Length Logic for Multi-select
  const toggleLength = (l: Length) => {
      setConfig(prev => {
          const current = prev.length;
          // If already selected
          if (current.includes(l)) {
              // Don't allow deselecting the last one
              if (current.length === 1) return prev; 
              return { ...prev, length: current.filter(x => x !== l) };
          }
          // If selecting a new one
          if (current.length >= 2) {
               // Remove first, add new
               return { ...prev, length: [...current.slice(1), l] };
          }
          return { ...prev, length: [...current, l] };
      });
  };

  const generateHtmlContent = () => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${config.topic}</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333; }
          img { max-width: 100%; height: auto; border-radius: 10px; margin-bottom: 20px; }
          h1 { color: #111; font-size: 2em; margin-bottom: 0.5em; }
          h2 { color: #333; margin-top: 20px; font-size: 1.5em; }
          h3 { color: #444; margin-top: 15px; font-size: 1.25em; }
          ul { padding-left: 20px; }
          li { margin-bottom: 5px; }
          p { margin-bottom: 1em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1em; border: 1px solid #ddd; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f9fafb; font-weight: bold; }
        </style>
      </head>
      <body>
    `;

    if (currentImageUrl) {
      html += `<img src="${currentImageUrl}" alt="Cover Image" />`;
    }

    const lines = generatedContent.split('\n');
    let inList = false;
    let inTable = false;
    let tableBuffer: string[] = [];

    const flushList = () => {
        if (inList) { html += '</ul>'; inList = false; }
    };

    const flushTable = () => {
        if (inTable && tableBuffer.length > 0) {
             html += '<table>';
             if (tableBuffer.length >= 2) {
                 const headerCells = tableBuffer[0].split('|').map(c => c.trim()).filter(c => c !== '');
                 html += '<thead><tr>';
                 headerCells.forEach(h => html += `<th>${h}</th>`);
                 html += '</tr></thead>';
                 html += '<tbody>';
                 for(let i = 2; i < tableBuffer.length; i++) {
                     const cells = tableBuffer[i].split('|').map(c => c.trim()).filter(c => c !== '');
                     if (cells.length > 0) {
                         html += '<tr>';
                         cells.forEach(c => html += `<td>${c}</td>`);
                         html += '</tr>';
                     }
                 }
                 html += '</tbody>';
             }
             html += '</table>';
             tableBuffer = [];
             inTable = false;
        }
    };

    lines.forEach(line => {
      const trimLine = line.trim();
      
      if (trimLine.startsWith('|')) {
          flushList(); 
          inTable = true;
          tableBuffer.push(trimLine);
          return;
      }
      
      if (inTable) {
          flushTable();
      }

      if (trimLine.startsWith('![')) {
          flushList();
          const match = trimLine.match(/!\[(.*?)\]\((.*?)\)/);
          if (match) {
              html += `<img src="${match[2]}" alt="${match[1]}" />`;
              if (match[1]) html += `<p style="text-align:center; font-style:italic; font-size:0.9em; color:#666;">${match[1]}</p>`;
          }
          return;
      }

      if (line.startsWith('# ')) {
        flushList();
        html += `<h1>${line.substring(2)}</h1>`;
      } else if (line.startsWith('## ')) {
        flushList();
        html += `<h2>${line.substring(3)}</h2>`;
      } else if (line.startsWith('### ')) {
        flushList();
        html += `<h3>${line.substring(4)}</h3>`;
      } else if (trimLine.startsWith('- ') || trimLine.startsWith('* ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        const text = trimLine.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<li>${text}</li>`;
      } else if (trimLine.length > 0) {
        flushList();
        const text = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html += `<p>${text}</p>`;
      }
    });

    flushList();
    flushTable();

    html += `</body></html>`;
    return html;
  };

  const handleExportMarkdown = () => {
    if (!generatedContent) return;
    const element = document.createElement("a");
    const file = new Blob([generatedContent], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${config.topic.replace(/\s+/g, '_') || 'article'}.md`;
    document.body.appendChild(element); 
    element.click();
    document.body.removeChild(element);
    setShowExportMenu(false);
  };

  const handleExportHtml = () => {
    if (!generatedContent) return;
    const htmlContent = generateHtmlContent();
    const element = document.createElement("a");
    const file = new Blob([htmlContent], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `${config.topic.replace(/\s+/g, '_') || 'article'}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    if (!generatedContent) return;
    const htmlContent = generateHtmlContent();
    try {
      const type = "text/html";
      const blob = new Blob([htmlContent], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      await navigator.clipboard.write(data);
      alert("Copied to clipboard! You can now paste into Google Docs.");
    } catch (err) {
      console.error(err);
      navigator.clipboard.writeText(generatedContent);
      alert("Copied markdown text to clipboard.");
    }
    setShowExportMenu(false);
  };

  // Calculations for Home Screen Stats
  const totalArticles = savedArticles.length;
  const totalWords = savedArticles.reduce((acc, curr) => acc + (curr.content ? curr.content.split(/\s+/).length : 0), 0);

  if (view === 'login') {
      return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
               <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
                  <div className="flex justify-center mb-6">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                          <IconFeather className="w-6 h-6" />
                      </div>
                  </div>
                  <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
                    {isRegisterMode ? 'Create Account' : 'Welcome Back'}
                  </h1>
                  <p className="text-center text-gray-600 dark:text-gray-400 mb-8">AI Content Platform</p>

                  <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-4">
                      {isRegisterMode && (
                        <div>
                          <label className="block text-sm font-medium text-gray-800 dark:text-gray-300 mb-1">Full Name</label>
                          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-300 mb-1">Email</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-800 dark:text-gray-300 mb-1">Password</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      
                      {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}

                      <button type="submit" disabled={isAuthLoading}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                        {isAuthLoading ? 'Processing...' : (isRegisterMode ? 'Sign Up' : 'Sign In')}
                      </button>
                  </form>

                  <div className="relative flex py-5 items-center">
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                    <span className="flex-shrink-0 mx-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Or continue with</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  </div>

                  <button 
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isAuthLoading}
                      className="w-full py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                  >
                      <IconGoogle className="w-5 h-5" />
                      Google
                  </button>

                  <div className="mt-6 text-center">
                    <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                      {isRegisterMode ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                    </button>
                  </div>
               </div>
          </div>
      )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 ${isDarkMode ? 'dark' : ''}`}>
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
              <button onClick={() => setView('dashboard')} className="flex items-center gap-2 group">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                      <IconFeather className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white text-lg">AI Writer</span>
              </button>
          </div>
          <div className="flex items-center gap-4">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-full transition-colors hidden sm:block">
                  {isDarkMode ? <IconSun /> : <IconMoon />}
              </button>
              <div className="flex items-center gap-2">
                  <button onClick={() => setView('settings')} className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 overflow-hidden hover:ring-2 ring-blue-500 transition-all">
                      {currentUser?.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" /> : (currentUser?.name?.charAt(0) || 'U')}
                  </button>
              </div>
          </div>
      </nav>

      <div className="flex max-w-7xl mx-auto pt-6 px-4 gap-6">
          <aside className="w-64 hidden lg:flex flex-col shrink-0 space-y-2 h-[calc(100vh-100px)] sticky top-24">
              <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'dashboard' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <IconSettings className="w-5 h-5" /> Home
              </button>
              <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'create' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <IconPlus className="w-5 h-5" /> New Article
              </button>
              <button onClick={() => setView('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'history' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <IconFileText className="w-5 h-5" /> History
              </button>
              
              <div className="flex-grow"></div>
              
              <button onClick={() => setView('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === 'settings' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <IconUser className="w-5 h-5" /> Settings
              </button>
          </aside>

          <main className="flex-1 pb-24 lg:pb-20">
              {view === 'dashboard' && (
                  <div className="space-y-8 animate-fade-in">
                      {/* Hero Section */}
                      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg">
                          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                          <div className="relative p-8 md:p-10">
                              <h2 className="text-3xl md:text-4xl font-bold mb-2">Hello, {currentUser?.name?.split(' ')[0]}! 👋</h2>
                              <p className="text-blue-100 text-lg mb-8 max-w-lg">Ignite your creativity. What masterpiece shall we write today?</p>
                              
                              <div className="flex flex-wrap gap-4">
                                  <button onClick={() => setView('create')} className="bg-white text-blue-700 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg">
                                      <IconSparkles className="w-5 h-5" /> Create New Article
                                  </button>
                                  <button onClick={() => setView('history')} className="bg-blue-800/50 backdrop-blur text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-800/70 transition-colors border border-blue-500/30">
                                      View History
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* Stats Section */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{totalArticles}</span>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Articles Created</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{(totalWords / 1000).toFixed(1)}k</span>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Words Generated</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                               <div className="mb-1 text-green-500"><IconCheck className="w-6 h-6" /></div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">System Online</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col items-center justify-center text-center">
                              <div className="mb-1 text-blue-500"><IconTag className="w-6 h-6" /></div>
                              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pro Plan</span>
                          </div>
                      </div>

                      {/* Recent Articles */}
                      <div>
                          <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Articles</h3>
                              {savedArticles.length > 0 && (
                                  <button onClick={() => setView('history')} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">View All</button>
                              )}
                          </div>

                          {savedArticles.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                  {savedArticles.slice(0, 6).map(article => (
                                      <div key={article.id} onClick={() => { setGeneratedContent(article.content); setGeneratedImageUrls(article.imageUrl ? [article.imageUrl] : []); setConfig(prev => ({...prev, topic: article.topic, type: article.type})); setFocusKeyword(null); setView('article'); }} 
                                          className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1">
                                          <div className="h-40 bg-gray-100 dark:bg-gray-900 relative overflow-hidden">
                                              {article.imageUrl ? (
                                                  <img src={article.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                              ) : (
                                                  <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                                                      <IconImage className="w-12 h-12" />
                                                  </div>
                                              )}
                                              <div className="absolute top-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 shadow-sm">
                                                  {article.type}
                                              </div>
                                          </div>
                                          <div className="p-5">
                                              <h4 className="font-bold text-gray-900 dark:text-white text-lg line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{article.topic}</h4>
                                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                                                  <span>{new Date(article.date).toLocaleDateString()}</span>
                                                  <span className="mx-2">•</span>
                                                  <span>{Math.ceil(article.content.length / 500)} min read</span>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                      <IconFeather className="w-8 h-8" />
                                  </div>
                                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No articles yet</h3>
                                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">Create your first AI-generated masterpiece today. It only takes a few seconds!</p>
                                  <button onClick={() => setView('create')} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Start Writing Now</button>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {view === 'settings' && (
                  <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
                      <div>
                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h2>
                          <p className="text-gray-500 dark:text-gray-400">Manage your account and preferences.</p>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Profile</h3>
                              <div className="flex items-center gap-4 mb-6">
                                  <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-2xl font-bold text-gray-600 dark:text-gray-300 overflow-hidden">
                                      {currentUser?.avatar ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" /> : (currentUser?.name?.charAt(0) || 'U')}
                                  </div>
                                  <div>
                                      <div className="font-bold text-gray-900 dark:text-white text-lg">{currentUser?.name}</div>
                                      <div className="text-gray-500 dark:text-gray-400 text-sm">{currentUser?.email}</div>
                                  </div>
                              </div>
                              <form onSubmit={handleUpdateProfile} className="space-y-4">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                                      <input 
                                          type="text" 
                                          value={fullName || currentUser?.name || ''} 
                                          onChange={(e) => setFullName(e.target.value)}
                                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                      />
                                  </div>
                                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">Update Profile</button>
                              </form>
                          </div>
                          
                          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Content Preferences</h3>
                              <div className="space-y-4">
                                   <CustomSelect
                                    label="Default Language"
                                    value={defaultLanguage}
                                    options={Object.values(Language)}
                                    onChange={(val) => handleUpdateDefaultLanguage(val as Language)}
                                    icon={<IconGlobe className="w-5 h-5" />}
                                  />
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This language will be selected automatically for new articles.</p>
                              </div>
                          </div>
                          
                          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Appearance</h3>
                              <div className="flex items-center justify-between">
                                  <div>
                                      <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes.</div>
                                  </div>
                                  <button 
                                      onClick={() => setIsDarkMode(!isDarkMode)} 
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                                  >
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                                  </button>
                              </div>
                          </div>

                          <div className="p-6">
                              <h3 className="font-bold text-lg text-red-500 mb-4">Danger Zone</h3>
                              <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                      <div>
                                          <div className="font-medium text-gray-900 dark:text-white">Clear History</div>
                                          <div className="text-sm text-gray-500 dark:text-gray-400">Permanently delete all saved articles.</div>
                                      </div>
                                      <button onClick={handleClearHistory} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20 rounded-lg font-medium text-sm transition-colors">Clear Data</button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                      <div>
                                          <div className="font-medium text-gray-900 dark:text-white">Sign Out</div>
                                          <div className="text-sm text-gray-500 dark:text-gray-400">Log out of your account on this device.</div>
                                      </div>
                                      <button onClick={handleLogout} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-lg font-medium text-sm transition-colors">Log Out</button>
                                  </div>
                              </div>
                          </div>
                      </div>
                      
                      <div className="text-center text-xs text-gray-400 pb-10">
                          <p>InkFlow AI Writer v1.0.0</p>
                          <p>&copy; 2024 InkFlow Inc. All rights reserved.</p>
                      </div>
                  </div>
              )}

              {view === 'create' && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-slide-up">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><IconSparkles className="text-blue-500" /> Create New Article</h2>
                      <div className="space-y-8">
                          {/* Category Selection - Custom Select */}
                          <div className="space-y-3">
                              <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Choose Category</span>
                                  </div>
                                  <button onClick={handleAddCategoryClick} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1">
                                      <IconPlus className="w-3 h-3" /> New Category
                                  </button>
                              </div>
                              <CustomSelect 
                                value={config.type} 
                                options={allCategories} 
                                onChange={(val) => setConfig({...config, type: val})}
                                icon={<IconTag className="w-5 h-5" />}
                                placeholder="Select a category"
                              />
                          </div>

                          {/* Topic & Language */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="md:col-span-2 space-y-3">
                                  <label className="block text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                     <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs">2</span>
                                     What are you writing about?
                                     <button onClick={handleSuggestTopic} disabled={isSuggestingTopic} className="ml-auto text-xs text-blue-500 hover:underline disabled:opacity-50 font-normal">{isSuggestingTopic ? 'Thinking...' : '✨ Suggest Topic'}</button>
                                  </label>
                                  <input 
                                    type="text" 
                                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-gray-400" 
                                    placeholder="e.g., The Future of Smart Home Technology" 
                                    value={config.topic} 
                                    onChange={(e) => setConfig({...config, topic: e.target.value})} 
                                  />
                              </div>
                              <div className="space-y-3">
                                  <CustomSelect
                                    label="Language"
                                    value={config.language}
                                    options={Object.values(Language)}
                                    onChange={(val) => setConfig({...config, language: val as Language})}
                                    icon={<IconGlobe className="w-5 h-5" />}
                                  />
                              </div>
                          </div>

                          {/* Keywords */}
                          <div className="space-y-3">
                               <label className="block text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs">3</span>
                                  Keywords
                                  <div className="ml-auto flex items-center gap-3">
                                      <button 
                                          onClick={handleCopyKeywords} 
                                          disabled={!config.keywords && suggestedKeywords.length === 0}
                                          className={`text-xs flex items-center gap-1 transition-colors ${keywordsCopied ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-blue-500 dark:text-gray-400'} disabled:opacity-30 disabled:hover:text-gray-500`}
                                      >
                                          {keywordsCopied ? <IconCheck className="w-3 h-3" /> : <IconCopy className="w-3 h-3" />}
                                          {keywordsCopied ? 'Copied' : 'Copy'}
                                      </button>
                                      <div className="w-px h-3 bg-gray-300 dark:bg-gray-600"></div>
                                      <button onClick={handleSuggestKeywords} disabled={isSuggestingKeywords || !config.topic} className="text-xs text-blue-500 hover:underline disabled:opacity-50 font-normal">
                                          {isSuggestingKeywords ? 'Researching...' : '✨ Suggest'}
                                      </button>
                                  </div>
                               </label>
                               <input 
                                  type="text" 
                                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500" 
                                  placeholder="Enter keywords separated by commas..." 
                                  value={config.keywords} 
                                  onChange={(e) => setConfig({...config, keywords: e.target.value})} 
                                />
                                {suggestedKeywords.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {suggestedKeywords.map(kw => (
                                            <button key={kw} onClick={() => addKeyword(kw)} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-lg flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                                                <IconPlus className="w-3 h-3" /> {kw}
                                            </button>
                                        ))}
                                    </div>
                                )}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              {/* Tone Selection - Pills */}
                              <div className="space-y-3">
                                  <label className="block text-sm font-bold text-gray-900 dark:text-white">Tone of Voice</label>
                                  <div className="flex flex-wrap gap-2">
                                      {Object.values(Tone).map((t) => (
                                          <button
                                              key={t}
                                              onClick={() => setConfig({ ...config, tone: t as Tone })}
                                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                                  config.tone === t
                                                      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-800'
                                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                              }`}
                                          >
                                              {t}
                                          </button>
                                      ))}
                                  </div>
                              </div>

                              {/* Length Selection - Cards (Multi-select) */}
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <label className="block text-sm font-bold text-gray-900 dark:text-white">Article Length</label>
                                    <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400">Select up to 2</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {Object.values(Length).map((t) => {
                                          const isSelected = config.length.includes(t as Length);
                                          const label = t.split('(')[0].trim();
                                          const subLabel = t.includes('(') ? t.match(/\((.*?)\)/)?.[1] : 'Standard';
                                          return (
                                              <button
                                                  key={t}
                                                  onClick={() => toggleLength(t as Length)}
                                                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                                                      isSelected
                                                           ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 shadow-md ring-1 ring-blue-500' 
                                                           : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                  }`}
                                              >
                                                  {isSelected && (
                                                      <div className="absolute top-2 right-2 text-blue-500">
                                                          <IconCheck className="w-4 h-4" />
                                                      </div>
                                                  )}
                                                  <div className={`font-bold text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                                                      {label}
                                                  </div>
                                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                      {subLabel}
                                                  </div>
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          </div>

                          {/* Image Toggle & Settings */}
                          <div className="p-5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${config.generateImage ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                         <IconImage className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <div className="font-bold text-gray-900 dark:text-white">AI Cover Image</div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">Generate a unique image for this article</div>
                                      </div>
                                  </div>
                                  <label className="relative inline-flex items-center cursor-pointer">
                                      <input type="checkbox" className="sr-only peer" checked={config.generateImage} onChange={(e) => setConfig({...config, generateImage: e.target.checked})} />
                                      <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:bg-blue-600 relative after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5.5 after:w-5.5 after:shadow-sm after:transition-all peer-checked:after:translate-x-5"></div>
                                  </label>
                              </div>
                              
                              {config.generateImage && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 animate-slide-up">
                                      <CustomSelect
                                        label="Quality / Size"
                                        value={config.imageSize || ImageSize.S_1K}
                                        options={Object.values(ImageSize)}
                                        onChange={(val) => setConfig({...config, imageSize: val as ImageSize})}
                                      />
                                      <CustomSelect
                                        label="Aspect Ratio"
                                        value={config.aspectRatio || AspectRatio.S_16_9}
                                        options={Object.values(AspectRatio)}
                                        onChange={(val) => setConfig({...config, aspectRatio: val as AspectRatio})}
                                      />
                                      <CustomSelect
                                        label="Number of Images"
                                        value={config.numberOfImages?.toString() || '1'}
                                        options={['1', '2', '3', '4', '5']}
                                        onChange={(val) => setConfig({...config, numberOfImages: parseInt(val)})}
                                      />
                                  </div>
                              )}
                          </div>

                          <div className="pt-6">
                              <button onClick={handleGenerate} disabled={!config.topic || isGenerating} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3 transform active:scale-[0.99]">
                                  {isGenerating ? <><IconRefresh className="animate-spin w-6 h-6" /> Writing Magic...</> : <><IconSparkles className="w-6 h-6" /> Generate Article</>}
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {view === 'article' && (
                  <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
                      <div className="flex items-center gap-4 mb-6 relative">
                          <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full dark:text-white"><IconArrowLeft /></button>
                          
                          <div className="flex-1 overflow-hidden">
                              <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1">{config.topic}</h2>
                              {saveStatus !== 'idle' && (
                                  <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                                      {saveStatus === 'saving' ? 'Saving...' : 'Saved to drafts'}
                                  </p>
                              )}
                          </div>

                          {/* Edit Toggle */}
                          <button 
                            onClick={() => setIsEditingContent(!isEditingContent)} 
                            className={`p-2 rounded-lg transition-colors hidden lg:block ${isEditingContent ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            title={isEditingContent ? "Done Editing" : "Edit Content"}
                          >
                             {isEditingContent ? <IconCheck className="w-5 h-5" /> : <IconEdit className="w-5 h-5" />}
                          </button>
                          
                          <div className="relative hidden lg:block">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Export">
                                <IconShare className="w-5 h-5" />
                            </button>
                            
                            {showExportMenu && (
                              <div className="absolute right-0 top-12 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-slide-up">
                                <button onClick={handleExportMarkdown} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                                  <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg"><IconFileCode className="w-4 h-4" /></div>
                                  <div>
                                    <div className="font-medium text-sm">Markdown (.md)</div>
                                    <div className="text-[10px] text-gray-400">Text only</div>
                                  </div>
                                </button>
                                <button onClick={handleExportHtml} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><IconFileText className="w-4 h-4" /></div>
                                  <div>
                                    <div className="font-medium text-sm">HTML Doc</div>
                                    <div className="text-[10px] text-gray-400">Text + Image</div>
                                  </div>
                                </button>
                                <button onClick={handleCopyToClipboard} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700">
                                  <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg"><IconClipboard className="w-4 h-4" /></div>
                                  <div>
                                    <div className="font-medium text-sm">Copy for Docs</div>
                                    <div className="text-[10px] text-gray-400">Direct Copy</div>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <button onClick={handleSaveArticle} className="hidden lg:flex items-center gap-2 text-green-600 hover:text-green-700 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm font-medium"><IconDownload className="w-4 h-4" /> Save</button>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm border border-gray-200 dark:border-gray-700">
                          {currentImageUrl ? (
                              <div className="space-y-4">
                                  <div className="relative group rounded-xl overflow-hidden">
                                      <img src={currentImageUrl} alt="Generated Cover" className="w-full max-h-[400px] object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                          <button onClick={startImageEdit} className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-100"><IconBrush className="w-4 h-4" /> Edit</button>
                                          <button onClick={handleGenerateImage} className="px-4 py-2 bg-white/20 text-white backdrop-blur rounded-lg font-medium flex items-center gap-2 hover:bg-white/30" title="Regenerate All"><IconRefresh className="w-4 h-4" /> Regenerate</button>
                                          <a href={currentImageUrl} download={`cover-${Date.now()}.png`} className="px-4 py-2 bg-white/20 text-white backdrop-blur rounded-lg font-medium flex items-center gap-2 hover:bg-white/30"><IconDownload className="w-4 h-4" /> Download</a>
                                      </div>
                                      {(isEditingImage || isGeneratingImage) && <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white z-10"><IconRefresh className="animate-spin w-8 h-8" /></div>}
                                  </div>
                                  
                                  {/* Thumbnail Gallery */}
                                  {generatedImageUrls.length > 1 && (
                                      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar px-1">
                                          {generatedImageUrls.map((url, idx) => (
                                              <button 
                                                  key={idx}
                                                  onClick={() => setSelectedImageIndex(idx)}
                                                  className={`relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                              >
                                                  <img src={url} alt={`Option ${idx + 1}`} className="w-full h-full object-cover" />
                                                  {selectedImageIndex === idx && <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[1px] flex items-center justify-center"><IconCheck className="w-6 h-6 text-white drop-shadow-md" /></div>}
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          ) : (
                              <div className="h-40 bg-gray-50 dark:bg-gray-900 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 relative">
                                  {imageGenerationError && (
                                      <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10 rounded-xl p-4 text-center">
                                          <div className="text-red-500 text-sm">
                                              <IconAlert className="w-6 h-6 mx-auto mb-1" />
                                              <p>{imageGenerationError}</p>
                                              <button onClick={handleGenerateImage} className="mt-2 text-blue-600 dark:text-blue-400 font-bold hover:underline">Try Again</button>
                                          </div>
                                      </div>
                                  )}
                                  {isGeneratingImage ? <span className="flex items-center gap-2 text-blue-500 animate-pulse"><IconImage className="w-5 h-5" /> Generating Images...</span> : <button onClick={handleGenerateImage} className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"><IconImage className="w-5 h-5" /> Generate Cover Image</button>}
                              </div>
                          )}
                      </div>

                      <div className="flex flex-col lg:flex-row gap-6 items-start">
                          <div className="flex-1 w-full bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-8 shadow-sm border border-gray-200 dark:border-gray-700 min-h-[500px]">
                              {/* Content Area */}
                              {isEditingContent ? (
                                  <div className="flex flex-col h-full gap-4">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-700">
                                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-2 whitespace-nowrap">Formatting:</span>
                                            <button onClick={() => insertText('**', '**')} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs min-w-[32px]" title="Bold">B</button>
                                            <button onClick={() => insertText('_', '_')} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 italic text-xs min-w-[32px]" title="Italic">I</button>
                                            <button onClick={() => insertText('\n## ')} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-xs whitespace-nowrap" title="Heading 2">H2</button>
                                            <button onClick={() => insertText('\n- ')} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-xs whitespace-nowrap" title="List">• List</button>
                                          </div>
                                          <button 
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={handleInsertImage}
                                              disabled={isGeneratingImage}
                                              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 w-full sm:w-auto"
                                          >
                                              {isGeneratingImage ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconImage className="w-4 h-4" />}
                                              Insert AI Image
                                          </button>
                                      </div>
                                      <textarea 
                                          ref={textareaRef}
                                          value={generatedContent}
                                          onChange={(e) => setGeneratedContent(e.target.value)}
                                          readOnly={isGeneratingImage}
                                          className="w-full h-full min-h-[500px] p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-base leading-relaxed text-gray-800 dark:text-gray-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                          placeholder="Article content..."
                                      />
                                  </div>
                              ) : (
                                  generatedContent ? <MarkdownView content={generatedContent} /> : <div className="h-full flex items-center justify-center text-gray-500">Waiting for generation to start...</div>
                              )}
                          </div>
                          
                          {!isEditingContent && (
                              <div className="w-full lg:w-72 space-y-4 lg:sticky lg:top-24">
                                  <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                                      <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><IconShield className="text-blue-500" /> Content Audit</h3>
                                      {!originalityReport ? <button onClick={handleAnalyze} disabled={isCheckingOriginality || !generatedContent} className="w-full py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">{isCheckingOriginality ? 'Analyzing...' : 'Check SEO & Originality'}</button> : <div className="text-sm"><MarkdownView content={originalityReport} /><button onClick={() => setOriginalityReport(null)} className="mt-4 text-xs text-blue-500 hover:underline">Re-run Analysis</button></div>}
                                  </div>
                                  
                                  {/* NEW Focus Keyword Card */}
                                  <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
                                      <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><IconTag className="text-blue-500" /> Focus Keyword</h3>
                                      {focusKeyword ? (
                                          <div className="space-y-3">
                                              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex justify-between items-center border border-blue-100 dark:border-blue-800">
                                                  <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">{focusKeyword}</span>
                                                  <button 
                                                      onClick={() => { navigator.clipboard.writeText(focusKeyword); alert('Keyword copied!'); }}
                                                      className="text-blue-500 hover:text-blue-700 p-1"
                                                  >
                                                      <IconCopy className="w-4 h-4" />
                                                  </button>
                                              </div>
                                              <button 
                                                  onClick={handleGetFocusKeyword} 
                                                  className="text-xs text-gray-500 hover:text-blue-500 flex items-center gap-1 mx-auto"
                                              >
                                                  <IconRefresh className="w-3 h-3" /> Regenerate
                                              </button>
                                          </div>
                                      ) : (
                                          <div>
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Extract the main SEO keyword from this article.</p>
                                              <button 
                                                  onClick={handleGetFocusKeyword} 
                                                  disabled={isExtractingKeyword || !generatedContent} 
                                                  className="w-full py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                              >
                                                  {isExtractingKeyword ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconTag className="w-4 h-4" />}
                                                  {isExtractingKeyword ? 'Extracting...' : 'Get Focus Keyword'}
                                              </button>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {view === 'history' && (
                  <div className="space-y-6 animate-fade-in">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your History</h2>
                      <div className="grid grid-cols-1 gap-4">
                          {savedArticles.map(article => (
                              <div key={article.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-6 items-start shadow-sm hover:shadow-md transition-all">
                                  {article.imageUrl && <img src={article.imageUrl} alt="" className="w-full sm:w-32 h-48 sm:h-24 object-cover rounded-lg bg-gray-100 flex-shrink-0" />}
                                  <div className="flex-1 w-full">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full mb-2 font-semibold">{article.type}</span>
                                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{article.topic}</h3>
                                          </div>
                                          <div className="flex gap-2">
                                              <button onClick={() => { const newSaved = savedArticles.filter(a => a.id !== article.id); setSavedArticles(newSaved); localStorage.setItem('saved_articles', JSON.stringify(newSaved)); }} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><IconTrash className="w-4 h-4" /></button>
                                          </div>
                                      </div>
                                      <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">{article.content.substring(0, 150)}...</p>
                                      <div className="flex items-center justify-between">
                                          <span className="text-xs text-gray-500">{new Date(article.date).toLocaleDateString()}</span>
                                          <button onClick={() => { setGeneratedContent(article.content); setGeneratedImageUrls(article.imageUrl ? [article.imageUrl] : []); setConfig(prev => ({...prev, topic: article.topic, type: article.type})); setFocusKeyword(null); setView('article'); }} className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1">Open Article <IconChevronRight className="w-4 h-4" /></button>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {savedArticles.length === 0 && (
                             <div className="bg-white dark:bg-gray-800 rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                  <p className="text-gray-500">No articles saved yet.</p>
                             </div>
                          )}
                      </div>
                  </div>
              )}
          </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe lg:hidden shadow-lg">
        {view === 'article' ? (
             <div className="flex justify-around items-center h-16 px-4 gap-4">
                 <button onClick={() => setView('dashboard')} className="flex flex-col items-center justify-center text-gray-500">
                     <IconArrowLeft className="w-6 h-6" />
                     <span className="text-[10px] font-medium">Back</span>
                 </button>
                 
                 {/* Mobile Edit Toggle */}
                 <button 
                    onClick={() => setIsEditingContent(!isEditingContent)} 
                    className={`flex flex-col items-center justify-center ${isEditingContent ? 'text-blue-600' : 'text-gray-500'}`}
                 >
                     {isEditingContent ? <IconCheck className="w-6 h-6" /> : <IconEdit className="w-6 h-6" />}
                     <span className="text-[10px] font-medium">{isEditingContent ? 'Done' : 'Edit'}</span>
                 </button>

                 <div className="relative">
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className={`flex flex-col items-center justify-center ${showExportMenu ? 'text-blue-600' : 'text-gray-500'}`}>
                        <IconShare className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Export</span>
                    </button>
                    {showExportMenu && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 animate-slide-up">
                            <button onClick={handleExportMarkdown} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                              <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg"><IconFileCode className="w-4 h-4" /></div>
                              <div>
                                <div className="font-medium text-sm">Markdown (.md)</div>
                                <div className="text-[10px] text-gray-400">Text only</div>
                              </div>
                            </button>
                            <button onClick={handleExportHtml} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200">
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><IconFileText className="w-4 h-4" /></div>
                              <div>
                                <div className="font-medium text-sm">HTML Doc</div>
                                <div className="text-[10px] text-gray-400">Text + Image</div>
                              </div>
                            </button>
                            <button onClick={handleCopyToClipboard} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700">
                              <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-lg"><IconClipboard className="w-4 h-4" /></div>
                              <div>
                                <div className="font-medium text-sm">Copy for Docs</div>
                                <div className="text-[10px] text-gray-400">Direct Copy</div>
                              </div>
                            </button>
                        </div>
                    )}
                 </div>

                 <button onClick={handleSaveArticle} className="flex flex-col items-center justify-center text-green-600">
                     <IconDownload className="w-6 h-6" />
                     <span className="text-[10px] font-medium">Save</span>
                 </button>
             </div>
        ) : (
            <div className="flex justify-around items-center h-16">
                <button onClick={() => setView('dashboard')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    <IconSettings className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </button>
                <button onClick={() => setView('create')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'create' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    <IconPlus className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Create</span>
                </button>
                <button onClick={() => setView('history')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'history' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    <IconFileText className="w-6 h-6" />
                    <span className="text-[10px] font-medium">History</span>
                </button>
                <button onClick={() => setView('settings')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                    <IconUser className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Settings</span>
                </button>
            </div>
        )}
      </div>

      {showCategoryModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold text-gray-900 dark:text-white">Manage Categories</h3>
                      <button onClick={() => setShowCategoryModal(false)}><IconX className="w-5 h-5 text-gray-500" /></button>
                  </div>
                  <div className="p-5 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Add New</label>
                          <div className="flex gap-2">
                              <input 
                                  type="text" 
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  placeholder="e.g. Crypto, Gardening..."
                                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                              />
                              <button 
                                  onClick={handleSaveCategory}
                                  disabled={!newCategoryName.trim()}
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm disabled:opacity-50"
                              >
                                  Add
                              </button>
                          </div>
                      </div>
                      
                      {customCategories.length > 0 && (
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">My Categories</label>
                              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                  {customCategories.map(cat => (
                                      <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm group">
                                          {editingCategory === cat ? (
                                              <div className="flex items-center gap-2 w-full">
                                                  <input 
                                                      type="text" 
                                                      value={editCategoryInputValue}
                                                      onChange={(e) => setEditCategoryInputValue(e.target.value)}
                                                      className="flex-1 px-2 py-1 rounded border border-blue-400 outline-none text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                                                      autoFocus
                                                  />
                                                  <button onClick={saveEditedCategory} className="text-green-500 hover:text-green-600 p-1"><IconCheck className="w-4 h-4" /></button>
                                                  <button onClick={() => setEditingCategory(null)} className="text-gray-400 hover:text-gray-600 p-1"><IconX className="w-4 h-4" /></button>
                                              </div>
                                          ) : (
                                              <>
                                                  <span className="text-gray-800 dark:text-gray-200 font-medium truncate flex-1">{cat}</span>
                                                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => startEditingCategory(cat)} className="text-gray-400 hover:text-blue-500 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Edit">
                                                          <IconEdit className="w-4 h-4" />
                                                      </button>
                                                      <button onClick={() => handleDeleteCategory(cat)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Delete">
                                                          <IconTrash className="w-4 h-4" />
                                                      </button>
                                                  </div>
                                              </>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {showImageMaskEditor && currentImageUrl && (
          <ImageMaskEditor 
            imageUrl={currentImageUrl}
            onCancel={() => setShowImageMaskEditor(false)}
            onSave={(mask) => handleEditImage(mask)}
          />
      )}

      {showInsertImageModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <IconImage className="w-6 h-6 text-blue-500" />
                            Generate & Insert Image
                        </h3>
                        {!isGeneratingImage && (
                            <button onClick={() => setShowInsertImageModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <IconX className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Image Description</label>
                            <textarea 
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-32"
                                placeholder="A futuristic city with flying cars at sunset..."
                                value={insertImagePrompt}
                                onChange={(e) => setInsertImagePrompt(e.target.value)}
                                disabled={isGeneratingImage}
                            />
                        </div>
                        
                        <button 
                            onClick={handleConfirmInsertImage}
                            disabled={!insertImagePrompt || isGeneratingImage}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGeneratingImage ? (
                                <>
                                    <IconRefresh className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <IconSparkles className="w-5 h-5" />
                                    Generate Image
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}