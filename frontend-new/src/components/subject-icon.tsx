import Image from 'next/image';
import { getSubjectIcon, getSubjectLetter, getSubjectColor } from '@/utils/subject-icons';

interface SubjectIconProps {
  subjectName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SubjectIcon({ subjectName, size = 'md', className = '' }: SubjectIconProps) {
  const iconPath = getSubjectIcon(subjectName);
  
  // Size classes
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10', 
    lg: 'w-12 h-12'
  };
  
  const sizeClass = sizeClasses[size];
  
  if (iconPath) {
    // Show SVG icon
    return (
      <div className={`${sizeClass} flex items-center justify-center ${className}`}>
        <Image
          src={iconPath}
          alt={`${subjectName} icon`}
          width={size === 'sm' ? 24 : size === 'md' ? 40 : 48}
          height={size === 'sm' ? 24 : size === 'md' ? 40 : 48}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }
  
  // Fallback to colored circle with letter
  const bgColor = getSubjectColor(subjectName);
  const letter = getSubjectLetter(subjectName);
  
  return (
    <div className={`${sizeClass} ${bgColor} rounded-full flex items-center justify-center ${className}`}>
      <span className="text-white font-medium text-sm">
        {letter}
      </span>
    </div>
  );
}