
/**
 * Simple content moderation utility for filtering profanity and offensive language.
 * Focuses on common Korean profanity, insults, and derogatory terms.
 */

const PROFANITY_LIST = [
  // Common Korean profanity
  '시발', '씨발', '시발놈', '씨발놈', '시발년', '씨발년', '시바', '씨바', '시발롬', '씨발롬',
  '개새끼', '개새기', '개세끼', '개세끼', '개새', '개세', '개색기',
  '존나', '졸라', '좆', '좆같', '좆까', '좆나',
  '병신', '븅신', '빙신',
  '미친', '미친놈', '미친년',
  '닥쳐', '아가리', '주둥이',
  '꺼져', '뒤져', '뒈져',
  
  // Slurs and derogatory remarks
  '한남', '한녀', '맘충', '틀딱', '급식충', '설명충',
  '정공', '면제', '정신병자',
  '게이', '레즈', '똥꼬충',
  
  // "Paedrip" (Parental insults) patterns are handled by substrings/combinations usually
  '니애미', '느금마', '느금', '니엠', '느비', '니비', '애미', '애비',
  
  // English common profanity (just in case)
  'fuck', 'shit', 'asshole', 'bitch', 'bastard'
];

/**
 * Checks if the text contains any prohibited words.
 */
export const containsProfanity = (text: string): boolean => {
  const cleanText = text.replace(/\s/g, '').toLowerCase();
  return PROFANITY_LIST.some(word => cleanText.includes(word));
};

/**
 * Masks prohibited words with asterisks.
 */
export const maskProfanity = (text: string): string => {
  let maskedText = text;
  PROFANITY_LIST.forEach(word => {
    const regex = new RegExp(word.split('').join('\\s*'), 'gi');
    maskedText = maskedText.replace(regex, (match) => '*'.repeat(match.length));
  });
  return maskedText;
};

/**
 * Validates a name for profanity.
 */
export const isValidName = (name: string): boolean => {
  if (!name.trim()) return false;
  return !containsProfanity(name);
};
