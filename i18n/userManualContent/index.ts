/**
 * User Manual Content Resolver
 * Returns localized content for a given section ID and locale.
 */
import { en } from './en';
import { ko } from './ko';
import { jp } from './jp';
import { th } from './th';

const contentMap: Record<string, Record<string, any>> = { en, ko, jp, th };

/**
 * Get content data for a section in the given locale.
 * Falls back to English if locale content is missing.
 */
export function getManualContent(sectionId: string, locale: string): any {
  const loc = contentMap[locale]?.[sectionId] || contentMap['en']?.[sectionId] || {};
  return loc;
}

/**
 * Get a label (TIP, WARNING, etc.) in the given locale.
 */
export function getManualLabel(key: string, locale: string): string {
  const labels = contentMap[locale]?.['_labels'] || contentMap['en']?.['_labels'] || {};
  return labels[key] || key;
}
