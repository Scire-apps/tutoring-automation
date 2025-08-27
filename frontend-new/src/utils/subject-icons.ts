// Subject icon mapping utility
export const getSubjectIcon = (subjectName: string): string | null => {
  if (!subjectName) return null;
  
  // Normalize subject name to lowercase for matching
  const normalizedSubject = subjectName.toLowerCase();
  
  // Subject to icon mapping
  const iconMap: Record<string, string> = {
    // Math subjects
    'math': '/maths.svg',
    'mathematics': '/maths.svg',
    'maths': '/maths.svg',
    
    // Science subjects
    'biology': '/biology.svg',
    'physics': '/physics.svg',
    'chemistry': '/Science.svg',
    'science': '/Science.svg',
    
    // Social studies
    'history': '/history.svg',
    'geography': '/geography.svg',
    
    // Languages
    'english': '/languages.svg',
    'french': '/languages.svg',
    'spanish': '/languages.svg',
    'german': '/languages.svg',
    
    // Business/Economics
    'business': '/globe.svg',
    'economics': '/globe.svg',
  };
  
  // Check for exact match first
  if (iconMap[normalizedSubject]) {
    return iconMap[normalizedSubject];
  }
  
  // Check for partial matches (for subjects like "Math HL", "English SL", etc.)
  for (const [key, icon] of Object.entries(iconMap)) {
    if (normalizedSubject.includes(key)) {
      return icon;
    }
  }
  
  // Return null if no icon found (will fall back to letter circle)
  return null;
};

// Get fallback letter for subjects without icons
export const getSubjectLetter = (subjectName: string): string => {
  if (!subjectName) return 'S';
  return subjectName.charAt(0).toUpperCase();
};

// Get background color for subject (for consistency)
export const getSubjectColor = (subjectName: string): string => {
  if (!subjectName) return 'bg-blue-500';
  
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-purple-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-pink-500',
    'bg-teal-500',
  ];
  
  // Use subject name to consistently assign colors
  const hash = subjectName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};