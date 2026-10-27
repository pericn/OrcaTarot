// CSS unicode ranges select only the question glyph subsets needed by this text.
// Canvas must wait for the supplied face rather than silently snapshotting fallback glyphs.
export async function loadQuestionFont(text){
  if(!text)return [];
  if(![...document.fonts].some(face=>face.family.replace(/["']/g,'')==='OrcaQuestionWoodblock'))throw new Error('Question woodblock faces were not registered');
  const faces=await document.fonts.load('400 22px OrcaQuestionWoodblock',text);
  if(faces.some(face=>face.status!=='loaded'))throw new Error('Question woodblock font was not loaded');
  return faces;
}
