// CSS unicode ranges select only the question glyph subsets needed by this text.
// Canvas must wait for the supplied face rather than silently snapshotting fallback glyphs.
export async function loadQuestionFont(text){
  if(!text)return [];
  if(![...document.fonts].some(face=>face.family.replace(/["']/g,'')==='OrcaQuestionSong'))throw new Error('Question Song faces were not registered');
  const faces=await document.fonts.load('600 22px OrcaQuestionSong',text);
  if(faces.some(face=>face.status!=='loaded'))throw new Error('Question Song font was not loaded');
  return faces;
}
