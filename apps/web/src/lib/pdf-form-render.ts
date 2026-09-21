/**
 * pdf.js AnnotationMode.ENABLE_FORMS (2): keep PDF corrections, stamps and
 * other artwork, but omit interactive widgets drawn by our field overlays.
 * DISABLE (0) also hides whiteout annotations and exposes the original text.
 * Kept separate from the lazy pdf.js import so print and preview share it.
 */
export const PDF_FORM_ANNOTATION_MODE = 2;
